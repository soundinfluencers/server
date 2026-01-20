import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException,} from '@nestjs/common';
import mongoose, {ClientSession, PipelineStage, Types} from 'mongoose';
import {SocialMediaType} from "../../common/types/social-media.types";
import sendMail from "../../integrations/nodemailer/nodemailer";
import {
    InfluencerDetailedPromo,
    InfluencerGetDashboardPromosQueryDto,
    InfluencerGetDetailedPromosQueryDto,
    InfluencerGetPastPromoQueryDto,
    InfluencerUpdatePromoReqBodyDto,
    InfluencerUpdatePromoResponseUpdateDto
} from "./dto/influencer-get-promos.dto";
import {
    InfluencerCompletedPromo,
    InfluencerConfirmationStatusEnum,
    InfluencerConfirmationStatusType,
    InfluencerDashboardPromo,
    InfluencerDashboardPromoStatusRequest,
    InfluencerDetailedPromoStatusRequest,
    InfluencerNewPromoRequest,
    InfluencerOngoingPromo,
    InfluencerPromoClosedStatusType,
} from "../../common/types/influencer/promo.types";
import {SocialAccountMigrationContext} from "../migrations/types/migrations.types";
import {CampaignRepository} from "../../database/repositories/campaigns/campaign.repository";
import {CompletedCampaignRepository} from "../../database/repositories/campaigns/completed-campaign.repository";
import {formatDate} from 'src/common/utils/formatters';
import {SocialMediaValidationStrategyFactory} from "./strategies/social-media-validation.factory";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {CampaignStatusEnum} from "../../common/types/client/campaign.types";

mongoose.Promise = global.Promise;

@Injectable()
export class PromosService {
    constructor(
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
        private readonly campaignRepo: CampaignRepository,
        private readonly completedCampaignRepo: CompletedCampaignRepository,
        private readonly validationStrategyFactory: SocialMediaValidationStrategyFactory,
        private readonly influencerActionsHistoryService: InfluencerActionsHistoryService,
    ) {
    }

    /// -------------- ORCHESTRATORS ----------------


    // orchestrator for getting array of detailed promos with specific type (ongoing, completed, etc.)
    async getDetailedPromosByType(data: InfluencerGetDetailedPromosQueryDto): Promise<InfluencerDetailedPromo[]> {
        let promos: InfluencerDetailedPromo[];

        switch (data.status) {
            case InfluencerDetailedPromoStatusRequest.ongoing:
                promos = await this.getOngoingPromos({
                    limit: data.limit,
                    page: data.page,
                    influencerId: data.influencerId
                });
                break;
            case InfluencerDetailedPromoStatusRequest.close:
                promos = await this.getCompletedPromos({
                    limit: data.limit,
                    page: data.page,
                    influencerId: data.influencerId
                });
                break;
            default:
                throw new Error('Unsupported promo status')
        }

        return promos;
    }

    // orchestrator for getting one detailed promo with specific type (ongoing, completed, etc.)
    async getDetailedPromoByType(data: any) {
    }


    /// -------------- UTILS ------------------


    // helper for creating pipeline for influencerGetDashboardPromos
    private buildInfluencerDashboardPipeline(
        influencerId: string,
        status: InfluencerDashboardPromoStatusRequest,
        limit: number = 12,
        skip: number = 0
    ): PipelineStage[] {
        const pipeline: PipelineStage[] = [
            {
                $match: {
                    'addedAccounts.influencerId': new Types.ObjectId(influencerId),
                },
            },
            {$unwind: 'addedAccounts'},
            {
                $match: {
                    'addedAccounts.influencerId': new Types.ObjectId(influencerId),
                },
            },
        ];

        switch (status) {
            case InfluencerDashboardPromoStatusRequest.new:
                pipeline.push({
                    $match: {
                        'addedAccounts.confirmation': 'wait',
                    },
                });
                break;

            case InfluencerDashboardPromoStatusRequest.ongoing:
                pipeline.push({
                    $match: {
                        'addedAccounts.confirmation': 'accept',
                        'addedAccounts.closePromo': 'wait',
                    },
                });
                break;

            case InfluencerDashboardPromoStatusRequest.close:
                pipeline.push({
                    $match: {
                        'addedAccounts.closePromo': 'close',
                    },
                });
                break;

            case InfluencerDashboardPromoStatusRequest.all:
            default:
                break;
        }

        pipeline.push({$sort: {createdAt: -1}});
        pipeline.push({$skip: skip})
        pipeline.push({$limit: Number(limit)});

        pipeline.push({
            $project: {
                _id: 0,
                campaignId: '$_id',
                addedAccountsId: 'addedAccounts._id',
                campaignName: '$campaignName',
                socialMedia: 'addedAccounts.socialMedia',
                statusCampaign: '$statusCampaign',
                closedStatus: 'addedAccounts.closePromo',
                confirmation: 'addedAccounts.confirmation',
                createdAt: {
                    $concat: [
                        {$dateToString: {date: '$createdAt', format: '%d.%m.'}},
                        {
                            $substr: [
                                {$dateToString: {date: '$createdAt', format: '%Y'}},
                                2,
                                2,
                            ],
                        },
                    ],
                },
            },
        });

        return pipeline;
    }

    // Replace influencerId in each ongoing promo (for migrate social account to another owner)
    async replaceInfluencerIdInOngoingPromos(
        context: SocialAccountMigrationContext,
        session: ClientSession,
    ): Promise<void> {
        const {targetInfluencerId, sourceInfluencerId} = context;

        if (!targetInfluencerId || !sourceInfluencerId) throw new BadRequestException('Not enough arguments');

        await this.campaignRepo.replaceInfluencerId(sourceInfluencerId.toString(), targetInfluencerId.toString(), {session});
    }


    /// -------------- SERVICES ------------------


    // [NEW REQUEST] Gets new promo requests for influencer (find by influencerId) [GET MANY]
    async getNewPromos(influencerId: string): Promise<InfluencerNewPromoRequest[]> {
        if (!influencerId) throw new BadRequestException('Not enough arguments');

        const checkInfluencer = await (async () => {
            const influencer = await this.influencerRepo.findOne({
                _id: new Types.ObjectId(influencerId),
            });

            if (influencer) {
                return influencer;
            }
        })();

        if (!checkInfluencer) throw new NotFoundException('Influencer not found');

        const promos = await this.campaignRepo
            .findMany({
                addedAccounts: {
                    $elemMatch: {influencerId: new Types.ObjectId(influencerId), confirmation: 'wait'},
                },
                $or: [{verifyPromo: 'accept'}, {verifyCampaign: 'accept'}],
            }, {lean: true});

        if (!promos) return [];

        const allSocialMediaAccounts = promos
            .flatMap((item) => {
                return item.addedAccounts.flatMap((acc): (InfluencerNewPromoRequest & { userId: string })[] => {
                    if (acc.confirmation !== 'wait' || acc.influencerId.toString() !== influencerId)
                        return [];

                    const {addedAccounts, ...newObject} = item;
                    const {_id, ...newObjectSocialMediaAccount} = acc;

                    if (acc.selectedContent?.campaignContentItemId) {
                        const selectedCampaignContentItem = item.campaignContent.find(
                            (item) => item._id.toString() === acc.selectedContent?.campaignContentItemId.toString(),
                        );

                        const postDescription = selectedCampaignContentItem?.descriptions?.find(
                            (pd) => pd._id.toString() === acc.selectedContent?.descriptionId?.toString(),
                        )?.description ?? "";

                        return [{
                            campaignId: newObject._id.toString(),
                            influencerId: newObjectSocialMediaAccount.influencerId.toString(),
                            addedAccountsId: acc._id.toString(),
                            campaignName: newObject.campaignName,
                            username:
                                newObjectSocialMediaAccount.username ??
                                (newObjectSocialMediaAccount as any).socialMediaUsername ??
                                (newObjectSocialMediaAccount as any).instagramUsername,
                            accountSocialMedia: acc.socialMedia as SocialMediaType,
                            dateRequest: newObjectSocialMediaAccount.dateRequest,
                            createdAt: formatDate(newObject.createdAt),
                            mainLink: selectedCampaignContentItem.mainLink,
                            description: postDescription,
                            taggedUser: selectedCampaignContentItem.taggedUser,
                            taggedLink: selectedCampaignContentItem.taggedLink,
                            additionalBrief: selectedCampaignContentItem.additionalBrief,
                            userId: newObject.clientId || (newObject as any).userId,
                            clientName: "Unknown"
                        }];
                    }

                    return [];
                });
            })
            .filter(Boolean);

        const filteredByInfluencerId = allSocialMediaAccounts.filter(
            (item) => (item as any).influencerId.toString() === influencerId,
        );

        const promosWithClientName: InfluencerNewPromoRequest[] = await Promise.all(
            filteredByInfluencerId.map(async (item) => {
                const client = await this.clientRepo.findById(
                    (item as any).clientId || (item as any).userId,
                );
                const clientName = client.company || client.firstName || 'No information';

                return {
                    ...item,
                    client: clientName,
                };
            }),
        );

        return promosWithClientName.flat().sort(
            (a, b) =>
                new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime())
    };

    // [NEW REQUEST] Updates confirmation status for new promo request [UPDATE ONE]
    async updateResponseNewCampaign(
        data: InfluencerUpdatePromoResponseUpdateDto & { influencerId: string },
    ): Promise<void> {
        const {influencerId, username, campaignId, campaignResponse, addedAccountsId} = data;

        if (!username || !campaignId || !campaignResponse || !addedAccountsId) {
            throw new BadRequestException('Not enough arguments');
        }

        const campaign = await this.campaignRepo.findById(campaignId).lean().exec();
        if (!campaign) throw new NotFoundException('Promo not found');

        const selectedAcc = campaign.addedAccounts.find(
            acc => acc._id.toString() === addedAccountsId,
        );
        if (!selectedAcc) throw new NotFoundException('Selected influencer not found');

        const session = await this.campaignRepo.startSession();
        session.startTransaction();

        try {
            const isAccept = campaignResponse === InfluencerConfirmationStatusEnum.accept;

            await this.influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory(
                {
                    influencerId,
                    campaignId: campaign._id.toString(),
                    campaignName: campaign.campaignName,
                    updatedCampaignAction: {
                        socialAccountId: selectedAcc.accountId,
                        actionNumber: isAccept ? 1 : 5,
                        networkUsername: selectedAcc.username,
                        socialMedia: selectedAcc.socialMedia,
                        rewardForInfluencer: selectedAcc.price,
                    },
                },
                session,
            );

            await this.campaignRepo.findOneAndUpdate(
                {
                    _id: campaignId,
                    addedAccounts: {
                        $elemMatch: {_id: new Types.ObjectId(addedAccountsId)},
                    },
                },
                {
                    $set: {
                        ...(isAccept ? {statusCampaign: CampaignStatusEnum.distributing}: {}),

                        'addedAccounts.$.confirmation': campaignResponse,
                    },
                    ...(isAccept
                        ? {}
                        : {
                            $inc: {
                                partialRefund: selectedAcc.price,
                            },
                        }),
                },
                {session},
            );

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }

        try {
            const influencer = await this.influencerRepo.findById(influencerId);
            const client = await this.clientRepo.findById(
                campaign.clientId || (campaign as any).userId,
            );

            switch (campaignResponse) {
                case InfluencerConfirmationStatusEnum.accept: {
                    const contentItem = campaign.campaignContent?.find(
                        item =>
                            item._id.toString() ===
                            selectedAcc.selectedContent?.campaignContentItemId?.toString(),
                    );

                    const postDescription =
                        contentItem?.descriptions?.find(
                            pd =>
                                pd._id.toString() ===
                                selectedAcc.selectedContent?.descriptionId?.toString(),
                        )?.description ?? '';

                    await sendMail(
                        'admin@soundinfluencers.com',
                        'SoundInfluencers',
                        `<p>${influencer.email} accepted the offer for ${client.email}'s campaign</p>
         <p><b>Campaign:</b> ${campaign.campaignName}</p>
         ${
                            contentItem
                                ? `
           <a href="${contentItem.mainLink}">${contentItem.mainLink}</a>
           ${postDescription ? `<p><b>Description:</b> ${postDescription}</p>` : ''}
           ${contentItem.taggedUser ? `<p><b>Story Tag:</b> ${contentItem.taggedUser}</p>` : ''}
           ${contentItem.taggedLink ? `<p><b>Swipe Up Link:</b> ${contentItem.taggedLink}</p>` : ''}
           ${contentItem.additionalBrief ? `<p><b>Special Wishes:</b> ${contentItem.additionalBrief}</p>` : ''}
         `
                                : ''
                        }`,
                        'html',
                    );
                    break;
                }

                case InfluencerConfirmationStatusEnum.reject: {
                    await sendMail(
                        'admin@soundinfluencers.com',
                        'SoundInfluencers',
                        `<p>${influencer.email} declined the offer for ${client.email}'s campaign</p>
         <p><b>Campaign:</b> ${campaign.campaignName}</p>`,
                        'html',
                    );
                    break;
                }

                case InfluencerConfirmationStatusEnum.wait:
                default:
                    break;
            }
        } catch (err) {
            throw new Error(`${data.addedAccountsId} ${data.username} response to ${data.campaignId} updated, but email failed, ${err}`);
        }
    }

    // [DASHBOARD] Returns influencer's promos for dashboard [GET MANY]
    async getDashboardPromos(
        data: InfluencerGetDashboardPromosQueryDto,
    ): Promise<InfluencerDashboardPromo[]> {
        const influencerId = data.influencerId;
        const status = data.status ?? InfluencerDashboardPromoStatusRequest.all;
        const limit = Number(data.limit ?? 12);
        const page = Number(data.page ?? 1);

        if (!Number.isInteger(limit) || limit <= 0) {
            throw new BadRequestException('Invalid limit');
        }

        if (!Number.isInteger(page) || page <= 0) {
            throw new BadRequestException('Invalid page');
        }

        const skip = (data.page - 1) * limit;

        const influencerExists = await this.influencerRepo.exists({
            _id: new Types.ObjectId(influencerId),
        });

        if (!influencerExists) {
            throw new NotFoundException('Influencer not found');
        }

        // new + ongoing
        if (
            status === InfluencerDashboardPromoStatusRequest.new ||
            status === InfluencerDashboardPromoStatusRequest.ongoing
        ) {
            return this.campaignRepo
                .aggregate<InfluencerDashboardPromo>(
                    this.buildInfluencerDashboardPipeline(influencerId, status, limit, skip),
                )
                .exec();
        }

        // closed
        if (status === InfluencerDashboardPromoStatusRequest.close) {
            return this.completedCampaignRepo
                .aggregate<InfluencerDashboardPromo>(
                    this.buildInfluencerDashboardPipeline(influencerId, status, limit, skip),
                )
                .exec();
        }

        // all
        const [active, closed] = await Promise.all([
            this.campaignRepo
                .aggregate<InfluencerDashboardPromo>(
                    this.buildInfluencerDashboardPipeline(influencerId, InfluencerDashboardPromoStatusRequest.all, limit, skip),
                )
                .exec(),

            this.completedCampaignRepo
                .aggregate<InfluencerDashboardPromo>(
                    this.buildInfluencerDashboardPipeline(influencerId, InfluencerDashboardPromoStatusRequest.all, limit, skip),
                )
                .exec(),
        ]);

        return [...active, ...closed]
            .sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
            .slice(0, limit);
    }


    // [COMPLETED] Returns influencer's detailed completed promos [GET MANY]
    async getCompletedPromos(data: {
        limit: number,
        page: number,
        influencerId: string
    }): Promise<InfluencerCompletedPromo[]> {
        const influencerId = data.influencerId;

        const limit = Number(data.limit ?? 12);
        const page = Number(data.page ?? 1);

        if (!Number.isInteger(limit) || limit <= 0) {
            throw new BadRequestException('Invalid limit');
        }

        if (!Number.isInteger(page) || page <= 0) {
            throw new BadRequestException('Invalid page');
        }

        const skip = (data.page - 1) * limit;

        const influencerExists = await this.influencerRepo.exists({
            _id: new Types.ObjectId(influencerId),
        });

        if (!influencerExists) {
            throw new NotFoundException('Influencer not found');
        }

        return await this.completedCampaignRepo.aggregate<InfluencerCompletedPromo>([
            {
                $match: {
                    'addedAccounts.influencerId': new Types.ObjectId(influencerId),
                },
            },
            {
                $unwind: {
                    path: '$addedAccounts',
                    preserveNullAndEmptyArrays: false,
                },
            },
            {
                $match: {
                    'addedAccounts.influencerId': new Types.ObjectId(influencerId),
                    'addedAccounts.closePromo': 'close',
                },
            },
            {
                $lookup: {
                    from: 'clients',
                    localField: 'clientId',
                    foreignField: '_id',
                    as: 'client',
                },
            },
            {
                $unwind: {
                    path: '$client',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $sort: {createdAt: -1},
            },
            {
                $skip: skip,
            },
            {
                $limit: limit,
            },
            {
                $project: {
                    _id: 0,
                    campaignId: { $toString: '$_id' },

                    addedAccountsId: { $toString: '$addedAccounts._id' },

                    campaignName: '$campaignName',

                    username: '$addedAccounts.username',
                    accountSocialMedia: '$addedAccounts.socialMedia',
                    reward: { $toDouble: '$addedAccounts.price' },
                    postLink: '$addedAccounts.postLink',

                    clientName: {
                        $ifNull: [
                            {
                                $cond: {
                                    if: { $and: [ { $ne: ['$client.company', null] }, { $ne: ['$client.company', ''] } ] },
                                    then: '$client.company',
                                    else: '$client.firstName',
                                },
                            },
                            'Unknown',
                        ],
                    },

                    createdAt: {
                        $concat: [
                            { $dateToString: { date: '$createdAt', format: '%d.%m.' } },
                            { $substr: [{ $dateToString: { date: '$createdAt', format: '%Y' } }, 2, 2] },
                        ],
                    },
                },
            }
        ]).exec();
    }


    // [COMPLETED] Returns influencer past promo (find by id, addedAccountsId) [GET ONE]
    async getCompletedPromo(data: InfluencerGetPastPromoQueryDto & {
        influencerId: string
    }): Promise<InfluencerCompletedPromo> {
        const {influencerId, campaignId, addedAccountsId} = data;

        if (!influencerId || !campaignId || !addedAccountsId) throw new BadRequestException('Not enough arguments');

        const influencer = await this.influencerRepo.findById(influencerId);
        if (!influencer) throw new NotFoundException('Influencer not found')

        let campaign = await this.completedCampaignRepo.findOne({_id: campaignId}, {lean: true});

        if (!campaign) {
            campaign = (await this.campaignRepo.findOne({_id: campaignId}, {lean: true})) as any;

            if (!campaign) throw new NotFoundException('Campaign not found');
        }

        const client = await this.clientRepo.findById(campaign.clientId || (campaign as any).userId);

        if (!client) throw new NotFoundException('Client not found');

        const selectedAccount = campaign.addedAccounts.find((influencerItem) => influencerItem._id.toString() === addedAccountsId);

        if (!selectedAccount) throw new NotFoundException(`Influencer's social account not found in this campaign`);

        let contentItem: {
            _id: string,
            mainLink: string,
            description: string,
            taggedUser: string,
            taggedLink: string,
            additionalBrief: string,
        } | null = null;

        if (selectedAccount.selectedContent?.campaignContentItemId || (selectedAccount as any).selectedCampaignContentItem) {
            const foundContent = campaign.campaignContent.find(
                (item) =>
                    item._id.toString() === selectedAccount.selectedContent?.campaignContentItemId?.toString() || item._id.toString() === (selectedAccount as any).selectedCampaignContentItem,
            );

            if (foundContent) {
                const foundPostDescription =
                    foundContent.descriptions?.find(
                        (pd) => pd._id.toString() === selectedAccount.selectedContent?.descriptionId.toString(),
                    )?.description ?? (foundContent as any).postDescription ?? '';

                contentItem = {
                    _id: foundContent._id.toString(),
                    mainLink: foundContent.mainLink,
                    description: foundPostDescription || null,
                    taggedUser: foundContent.taggedUser || null,
                    taggedLink: foundContent.taggedLink || null,
                    additionalBrief: foundContent.additionalBrief,
                };
            }
        }

        if (!contentItem) throw new NotFoundException(`Content item not found`);

        return {
            campaignId: campaignId,
            influencerId: influencerId,
            addedAccountsId: data.addedAccountsId,
            socialAccountId: selectedAccount.accountId?.toString() ?? undefined,
            campaignName: campaign.campaignName,
            username: selectedAccount.username ?? (selectedAccount as any).socialMediaUsernamea ?? (selectedAccount as any).instagramUsername,
            createdAt: formatDate(campaign.createdAt),
            postLink: selectedAccount.postLink,
            reward: selectedAccount.price,
            clientName: client?.company || client?.firstName || 'No information',
            accountSocialMedia: campaign.socialMedia as SocialMediaType,
        };
    }


    // [ONGOING] Returns influencer's detailed completed promos [GET MANY]
    async getOngoingPromos(data: {
        limit: number,
        page: number,
        influencerId: string
    }): Promise<InfluencerOngoingPromo[]> {
        const influencerId = data.influencerId;

        const limit = Number(data.limit ?? 12);
        const page = Number(data.page ?? 1);

        if (!Number.isInteger(limit) || limit <= 0) {
            throw new BadRequestException('Invalid limit');
        }

        if (!Number.isInteger(page) || page <= 0) {
            throw new BadRequestException('Invalid page');
        }

        const skip = (data.page - 1) * limit;

        const influencerExists = await this.influencerRepo.exists({
            _id: new Types.ObjectId(influencerId),
        });

        if (!influencerExists) {
            throw new NotFoundException('Influencer not found');
        }

        return await this.campaignRepo.aggregate<InfluencerOngoingPromo>([
            { $match: { 'addedAccounts.influencerId': new Types.ObjectId(influencerId) } },
            { $unwind: '$addedAccounts' },
            {
                $match: {
                    'addedAccounts.influencerId': new Types.ObjectId(influencerId),
                    'addedAccounts.confirmation': 'accept',
                    'addedAccounts.closePromo': 'wait',
                },
            },
            {
                $lookup: {
                    from: 'clients',
                    localField: 'clientId',
                    foreignField: '_id',
                    as: 'client',
                },
            },
            { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },

            {
                $project: {
                    _id: 0,
                    campaignId: { $toString: '$_id' },
                    addedAccountsId: { $toString: '$addedAccounts._id' },

                    campaignName: '$campaignName',
                    username: '$addedAccounts.username',

                    accountSocialMedia: '$addedAccounts.socialMedia',

                    reward: { $toDouble: { $ifNull: ['$addedAccounts.price', 0] } },

                    postLink: { $ifNull: ['$addedAccounts.postLink', null] },

                    dateRequest: { $ifNull: ['$addedAccounts.dateRequest', null] },

                    mainLink: {
                        $let: {
                            vars: {
                                contentItem: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: { $ifNull: ['$campaignContent', []] },
                                                as: 'c',
                                                cond: {
                                                    $eq: ['$$c._id', '$addedAccounts.selectedContent.campaignContentItemId'],
                                                },
                                            },
                                        },
                                        0,
                                    ],
                                },
                            },
                            in: { $ifNull: ['$$contentItem.mainLink', null] },
                        },
                    },

                    description: {
                        $let: {
                            vars: {
                                contentItem: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: { $ifNull: ['$campaignContent', []] },
                                                as: 'c',
                                                cond: {
                                                    $eq: ['$$c._id', '$addedAccounts.selectedContent.campaignContentItemId'],
                                                },
                                            },
                                        },
                                        0,
                                    ],
                                },
                            },
                            in: {
                                $let: {
                                    vars: {
                                        descObj: {
                                            $arrayElemAt: [
                                                {
                                                    $filter: {
                                                        input: { $ifNull: ['$$contentItem.descriptions', []] },
                                                        as: 'd',
                                                        cond: {
                                                            $eq: ['$$d._id', '$addedAccounts.selectedContent.descriptionId'],
                                                        },
                                                    },
                                                },
                                                0,
                                            ],
                                        },
                                    },
                                    in: { $ifNull: ['$$descObj.description', null] },
                                },
                            },
                        },
                    },

                    taggedUser: {
                        $let: {
                            vars: {
                                contentItem: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: { $ifNull: ['$campaignContent', []] },
                                                as: 'c',
                                                cond: {
                                                    $eq: ['$$c._id', '$addedAccounts.selectedContent.campaignContentItemId'],
                                                },
                                            },
                                        },
                                        0,
                                    ],
                                },
                            },
                            in: { $ifNull: ['$$contentItem.taggedUser', null] },
                        },
                    },

                    taggedLink: {
                        $let: {
                            vars: {
                                contentItem: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: { $ifNull: ['$campaignContent', []] },
                                                as: 'c',
                                                cond: {
                                                    $eq: ['$$c._id', '$addedAccounts.selectedContent.campaignContentItemId'],
                                                },
                                            },
                                        },
                                        0,
                                    ],
                                },
                            },
                            in: { $ifNull: ['$$contentItem.taggedLink', null] },
                        },
                    },

                    additionalBrief: {
                        $let: {
                            vars: {
                                contentItem: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: { $ifNull: ['$campaignContent', []] },
                                                as: 'c',
                                                cond: {
                                                    $eq: ['$$c._id', '$addedAccounts.selectedContent.campaignContentItemId'],
                                                },
                                            },
                                        },
                                        0,
                                    ],
                                },
                            },
                            in: { $ifNull: ['$$contentItem.additionalBrief', null] },
                        },
                    },

                    clientName: {
                        $ifNull: [
                            {
                                $cond: {
                                    if: {
                                        $and: [
                                            { $ne: ['$client.company', null] },
                                            { $ne: ['$client.company', ''] },
                                        ],
                                    },
                                    then: '$client.company',
                                    else: '$client.firstName',
                                },
                            },
                            'Unknown',
                        ],
                    },

                    createdAt: {
                        $concat: [
                            { $dateToString: { date: '$createdAt', format: '%d.%m.' } },
                            {
                                $substr: [
                                    { $dateToString: { date: '$createdAt', format: '%Y' } },
                                    2,
                                    2,
                                ],
                            },
                        ],
                    },
                },
            },
        ]).exec();
    }


    // [ONGOING] Return's influencer's detailed ongoing promo [GET ONE]
    async getOngoingPromo(
        influencerId: string,
        campaignId: string,
        addedAccountsId: string,
    ): Promise<InfluencerOngoingPromo> {

        if (!campaignId || !addedAccountsId) {
            throw new BadRequestException('Not enough arguments');
        }

        const influencer = await this.influencerRepo.findById(influencerId);
        if (!influencer) {
            throw new NotFoundException('Influencer not found');
        }

        const campaign = await this.campaignRepo.findById(campaignId).lean();
        if (!campaign) {
            throw new NotFoundException('Campaign not found');
        }

        const client = await this.clientRepo.findById(
            campaign.clientId || (campaign as any).userId,
        );
        if (!client) {
            throw new NotFoundException('Client not found');
        }

        const selectedInfluencer = campaign.addedAccounts.find(
            (item) => item._id.toString() === addedAccountsId,
        );

        if (!selectedInfluencer) {
            throw new NotFoundException('Social account not found');
        }

        if (!campaign.campaignContent || !selectedInfluencer.selectedContent) {
            throw new BadRequestException('Campaign content not found');
        }

        const selectedCampaignContentItem = campaign.campaignContent.find(
            (item) =>
                item._id.toString() ===
                selectedInfluencer.selectedContent.campaignContentItemId.toString(),
        );

        if (!selectedCampaignContentItem) {
            throw new NotFoundException('Campaign content item not found');
        }

        const postDescription =
            selectedCampaignContentItem.descriptions?.find(
                (pd) =>
                    pd._id.toString() ===
                    selectedInfluencer.selectedContent.descriptionId?.toString(),
            )?.description ?? '';

        return {
            campaignId: campaign._id.toString(),
            influencerId: selectedInfluencer.influencerId.toString(),
            addedAccountsId: selectedInfluencer._id.toString(),
            campaignName: campaign.campaignName,
            username: selectedInfluencer.username,
            accountSocialMedia: selectedInfluencer.socialMedia as SocialMediaType,
            dateRequest: selectedInfluencer.dateRequest,
            createdAt: formatDate(campaign.createdAt),
            reward: selectedInfluencer.price,
            mainLink: selectedCampaignContentItem.mainLink,
            description: postDescription,
            taggedUser: selectedCampaignContentItem.taggedUser,
            taggedLink: selectedCampaignContentItem.taggedLink,
            additionalBrief: selectedCampaignContentItem.additionalBrief,
            clientName: client.company,
            statusCampaign: campaign.statusCampaign,
            closedStatus: selectedInfluencer.closePromo as InfluencerPromoClosedStatusType,
            confirmation: selectedInfluencer.confirmation as InfluencerConfirmationStatusType,
        } satisfies InfluencerOngoingPromo;
    }


    // [ONGOING] Closing influencer's promo [UPDATE ONE]
    async updateOngoingCampaign(
        data: InfluencerUpdatePromoReqBodyDto,
    ): Promise<void> {
        const {
            influencerId,
            campaignId,
            username,
            addedAccountsId,
            data: postDetails,
        } = data;

        if (!influencerId || !campaignId || !username || !addedAccountsId) {
            throw new BadRequestException('Not enough arguments');
        }

        const campaign = await this.campaignRepo
            .findOne({
                _id: campaignId,
                addedAccounts: {
                    $elemMatch: {
                        influencerId,
                        $or: [
                            {username: username},
                            {socialMediaUsername: username},
                            {instagramUsername: username},
                        ],
                    },
                },
            }, {lean: true});

        if (!campaign) {
            throw new NotFoundException('Campaign not found');
        }

        const socialAccount = campaign.addedAccounts.find(
            (item) => item._id.toString() === addedAccountsId,
        );

        if (!socialAccount) {
            throw new NotFoundException(
                `Social account not found in campaign ${campaign.campaignName}`,
            );
        }

        // validation by strategy
        const validationStrategy = this.validationStrategyFactory.get(socialAccount.socialMedia);
        validationStrategy.validate(postDetails);

        // transaction
        const session = await this.campaignRepo.startSession();

        try {
            session.startTransaction();

            // closing promo for influencer
            const updatePayload = Object.fromEntries(
                Object.entries({
                    ...postDetails,
                    closePromo: 'close',
                }).map(([key, value]) => [`addedAccounts.$.${key}`, value]),
            );

            const updateResult = await this.campaignRepo.updateOne(
                {
                    _id: campaignId,
                    'addedAccounts._id': new mongoose.Types.ObjectId(addedAccountsId),
                    'addedAccounts.closePromo': {$ne: 'close'},
                },
                {$set: updatePayload},
                {session}
            );

            // promo already closed by another request
            if (updateResult.modifiedCount === 0) {
                await session.abortTransaction();
                return;
            }

            // pay influencer
            const reward = socialAccount.price;

            if (!reward || Number.isNaN(reward)) {
                throw new InternalServerErrorException('Invalid influencer reward in database');
            }

            await this.influencerRepo.updateOne(
                {_id: influencerId},
                {$inc: {balance: reward}},
                {session},
            );

            // upserting new campaign action
            await this.influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory({
                influencerId: influencerId,
                campaignId: campaignId,
                campaignName: campaign.campaignName,
                updatedCampaignAction: {
                    socialAccountId: socialAccount._id,
                    actionNumber: 2,
                    networkUsername: username,
                    rewardForInfluencer: socialAccount.price,
                    socialMedia: socialAccount.socialMedia
                }
            }, session)

            await session.commitTransaction();
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            await session.endSession();
        }
    }
}
