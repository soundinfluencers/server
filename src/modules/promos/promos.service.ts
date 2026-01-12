import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Campaign} from '../../database/schemas/campaign/campaign.schema';
import mongoose, {ClientSession, PipelineStage, Types} from 'mongoose';
import {CompletedCampaign} from '../../database/schemas/campaign/completed-campaign.schema';
import axios from 'axios';
import * as process from 'node:process';
import {CampaignStatusType} from "../../common/types/client/campaign.types";
import {SocialMediaType} from "../../common/types/social-media.types";
import sendMail from "../../integrations/nodemailer/nodemailer";
import {DropboxService} from "../../integrations/dropbox/dropbox";
import {Client} from "../../database/schemas/users/client.schema";
import {Influencer} from "../../database/schemas/users/influencer.schema";
import {
    InfluencerDashboardPromoStatus, InfluencerGetCompletedPromosQueryDto,
    InfluencerGetDashboardPromosQueryDto,
    InfluencerGetPastPromoQueryDto, InfluencerUpdatePromoReqBodyDto,
    InfluencerUpdatePromoResponseUpdateDto
} from "./dto/influencer-get-promos.dto";
import {
    InfluencerCompletedPromo,
    InfluencerConfirmationStatusType, InfluencerDashboardPromo,
    InfluencerPromo, InfluencerPromoClosedStatusType,
    InfluencerPromoRequest,
} from "../../common/types/influencer/promo.types";
import {SocialAccountMigrationContext} from "../migrations/types/migrations.types";
import {CampaignRepository} from "../../database/repositories/campaigns/campaign.repository";
import {CompletedCampaignRepository} from "../../database/repositories/campaigns/completed-campaign.repository";
import {formatDate} from 'src/common/utils/formatters';
import {SocialMediaValidationStrategyFactory} from "./strategies/social-media-validation.factory";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";

mongoose.Promise = global.Promise;

@Injectable()
export class PromosService {
    private readonly logger = new Logger();

    // TODO: use repo instead models
    constructor(
        @InjectModel(Campaign.name)
        private campaignModel: mongoose.Model<Campaign>,
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
        @InjectModel(CompletedCampaign.name)
        private completedCampaignModel: mongoose.Model<CompletedCampaign>,
        private campaignRepo: CampaignRepository,
        private completedCampaignRepo: CompletedCampaignRepository,
        private readonly validationStrategyFactory: SocialMediaValidationStrategyFactory,
        private readonly influencerActionsHistoryService: InfluencerActionsHistoryService,
    ) {
    }

    // Returns influencer past promo (find by id, selectInfluencersId)
    async influencerPastPromoOne(data: InfluencerGetPastPromoQueryDto & {
        influencerId: string
    }): Promise<InfluencerPromo>
    {
        const {influencerId, campaignId, selectInfluencersId} = data;

        if (!influencerId || !campaignId || !selectInfluencersId) throw new BadRequestException('Not enough arguments');

        const influencer = await this.influencerModel.findById(influencerId);
        if (!influencer) throw new NotFoundException('Influencer not found')

        let campaign = await this.completedCampaignModel.findOne({_id: campaignId}).lean().exec();

        if (!campaign) {
            campaign = (await this.campaignModel.findOne({_id: campaignId}).lean().exec()) as any;

            if (!campaign) throw new NotFoundException('Campaign not found');
        }

        const client = await this.clientModel.findById(campaign.clientId || (campaign as any).userId);

        if (!client) throw new NotFoundException('Client not found');

        const selectedAccount = campaign.selectInfluencers.find((influencerItem) => influencerItem._id.toString() === selectInfluencersId);

        if (!selectedAccount) throw new NotFoundException(`Influencer's social account not found in this campaign`);

        let contentItem: {
            _id: string,
            videoLink: string,
            postDescription: string,
            storyTag: string,
            storyLink: string,
            specialWishes: string,
        } | null = null;

        if (selectedAccount.selectedContent?.campaignContentItemId || (selectedAccount as any).selectedCampaignContentItem) {
            const foundContent = campaign.campaignContent.find(
                (item) =>
                    item._id.toString() === selectedAccount.selectedContent?.campaignContentItemId?.toString() || item._id.toString() === (selectedAccount as any).selectedCampaignContentItem,
            );

            if (foundContent) {
                const foundPostDescription =
                    foundContent.postDescriptions?.find(
                        (pd) => pd._id.toString() === selectedAccount.selectedContent?.postDescriptionId.toString(),
                    )?.description ?? (foundContent as any).postDescription ?? '';

                contentItem = {
                    _id: foundContent._id.toString(),
                    videoLink: foundContent.videoLink,
                    postDescription: foundPostDescription || null,
                    storyTag: foundContent.storyTag || null,
                    storyLink: foundContent.swipeUpLink || null,
                    specialWishes: foundContent.specialWishes,
                };
            }
        }

        if (!contentItem) throw new NotFoundException(`Content item not found`);

        return {
            campaignId: campaignId,
            campaignName: campaign.campaignName,
            influencerId: influencerId,
            selectInfluencersId: data.selectInfluencersId,
            socialMediaUsername:
                selectedAccount.socialMediaUsername || (selectedAccount as any).instagramUsername,
            dateRequest: selectedAccount.dateRequest,
            createdAt: campaign.createdAt,
            client: client?.company || client?.firstName || 'No information',
            socialMedia: campaign.socialMedia as SocialMediaType,
            videoLink: (contentItem as any).videoLink,
            postDescription: (contentItem as any).postDescription,
            storyTag: (contentItem as any).storyTag,
            storyLink: (contentItem as any).swipeUpLink,
            additionalBrief: (contentItem as any).specialWishes,
            statusCampaign: campaign.statusCampaign as CampaignStatusType,
            closedStatus: "closed" as InfluencerPromoClosedStatusType,
            confirmation: "accept" as InfluencerConfirmationStatusType
        };
    }

    // Gets new promo requests for influencer (find by influencerId)
    async influencerGetNewPromos(influencerId: string): Promise<InfluencerPromoRequest[]> {
        if (!influencerId) throw new BadRequestException('Not enough arguments');

        const checkInfluencer = await (async () => {
            const influencer = await this.influencerModel.findOne({
                _id: new Types.ObjectId(influencerId),
            });

            if (influencer) {
                return influencer;
            }
        })();

        if (!checkInfluencer) throw new NotFoundException('Influencer not found');

        const promos = await this.campaignModel
            .find({
                selectInfluencers: {
                    $elemMatch: {influencerId: influencerId, confirmation: 'wait'},
                },
                $or: [{verifyPromo: 'accept'}, {verifyCampaign: 'accept'}],
            })
            .lean();

        if (!promos) return [];

        const allSocialMediaAccounts = promos
            .flatMap((item) => {
                return item.selectInfluencers.flatMap((acc): any[] => {
                    if (acc.confirmation !== 'wait' || acc.influencerId.toString() !== influencerId)
                        return [];

                    const {selectInfluencers, ...newObject} = item;
                    const {_id, ...newObjectSocialMediaAccount} = acc;

                    if (acc.selectedContent?.campaignContentItemId) {
                        const selectedCampaignContentItem = item.campaignContent.find(
                            (item) => item._id.toString() === acc.selectedContent?.campaignContentItemId.toString(),
                        );

                        const postDescription = selectedCampaignContentItem?.postDescriptions?.find(
                            (pd) => pd._id.toString() === acc.selectedContent?.postDescriptionId?.toString(),
                        )?.description ?? "";

                        return [{
                            campaignId: newObject._id.toString(),
                            influencerId: newObjectSocialMediaAccount.influencerId.toString(),
                            selectInfluencersId: acc._id.toString(),
                            campaignName: newObject.campaignName,
                            socialMediaUsername:
                                newObjectSocialMediaAccount.socialMediaUsername ||
                                (newObjectSocialMediaAccount as any).instagramUsername,
                            socialMedia: acc.socialMedia as SocialMediaType,
                            dateRequest: newObjectSocialMediaAccount.dateRequest,
                            createdAt: formatDate(newObject.createdAt),
                            videoLink: selectedCampaignContentItem.videoLink,
                            postDescription: postDescription,
                            storyTag: selectedCampaignContentItem.storyTag,
                            storyLink: selectedCampaignContentItem.swipeUpLink,
                            additionalBrief: selectedCampaignContentItem.specialWishes,
                            userId: newObject.clientId || (newObject as any).userId,
                        }];
                    } else if ((acc as any).selectedVideo) {
                        const selectedVideoObj = (item as any).videos.find(
                            (video) => video.videoLink === (acc as any).selectedVideo,
                        );

                        return [
                            {
                                campaignId: newObject._id.toString(),
                                influencerId: newObjectSocialMediaAccount.influencerId.toString(),
                                selectInfluencersId: acc._id.toString(),
                                campaignName: newObject.campaignName,
                                socialMediaUsername:
                                    newObjectSocialMediaAccount.socialMediaUsername ||
                                    (newObjectSocialMediaAccount as any).instagramUsername,
                                socialMedia: newObject.socialMedia as SocialMediaType,
                                dateRequest: newObjectSocialMediaAccount.dateRequest,
                                createdAt: formatDate(newObject.createdAt),
                                videoLink: selectedVideoObj.videoLink,
                                postDescription: selectedVideoObj.postDescription,
                                storyTag: selectedVideoObj.storyTag,
                                storyLink: selectedVideoObj.swipeUpLink,
                                additionalBrief: selectedVideoObj.specialWishes,
                                userId: newObject.clientId || (newObject as any).userId,
                            },
                        ];
                    }

                    return [];
                });
            })
            .filter(Boolean);

        const filteredByInfluencerId = allSocialMediaAccounts.filter(
            (item) => (item as any).influencerId.toString() === influencerId,
        );

        const promosWithClientName: InfluencerPromoRequest[] = await Promise.all(
            filteredByInfluencerId.map(async (item) => {
                const client = await this.clientModel.findById(
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

    // Updates confirmation status for new promo request
    async influencerUpdateResponseNewCampaign(data: InfluencerUpdatePromoResponseUpdateDto & { influencerId: string }) {
        const {influencerId, socialMediaUsername, campaignId, campaignResponse, selectInfluencersId} = data;

        if (!socialMediaUsername || !campaignId || !campaignResponse || !selectInfluencersId) throw new BadRequestException('Not enough arguments');

        const findNewCampaign = await this.campaignModel.findById(campaignId).lean().exec();

        if (!findNewCampaign) throw new NotFoundException('Promo not found');

        if (campaignResponse === 'accept') {
            const selectInfluencersAcc = findNewCampaign.selectInfluencers.find(
                (influencer) => influencer._id.toString() === selectInfluencersId,
            );

            const resultOfSavingHistory = await axios.post(
                `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
                {
                    influencerId: influencerId,
                    campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                    campaignName: findNewCampaign.campaignName,
                    updatedCampaignAction: {
                        actionNumber: 1,
                        networkUsername: socialMediaUsername,
                        socialMedia: selectInfluencersAcc.socialMedia,
                        rewardForInfluencer: selectInfluencersAcc.price.replace(/\D/g, ''),
                    },
                },
            );

            if (resultOfSavingHistory.data.code !== 200) throw new InternalServerErrorException('Something went wrong');

            const updateNewPromo = await this.campaignModel.findOneAndUpdate(
                {
                    _id: campaignId,
                    selectInfluencers: {
                        $elemMatch: {
                            _id: new mongoose.Types.ObjectId(selectInfluencersId),
                        },
                    },
                },
                {
                    $set: {
                        ...(findNewCampaign.statusCampaign
                            ? {statusCampaign: 'work'}
                            : {statusPromo: 'work'}),
                        'selectInfluencers.$.confirmation': campaignResponse,
                    },
                },
            );

            const checkUserInfluencer = await this.influencerModel.findById(influencerId);
            const checkUserClient = await this.clientModel.findById(
                findNewCampaign.clientId || (findNewCampaign as any).userId,
            );

            const selectedCampaignContentItem = findNewCampaign.campaignContent?.find(
                (item) => item._id.toString() === selectInfluencersAcc.selectedContent?.campaignContentItemId.toString()
            );
            const selectedPostDescription = selectedCampaignContentItem?.postDescriptions?.find(
                (pd) => pd._id.toString() === selectInfluencersAcc.selectedContent?.postDescriptionId.toString()
            )?.description ?? '';

            await sendMail(
                // 'nazarkozynets030606@zohomail.eu',
                'admin@soundinfluencers.com',
                'SoundInfluencers',
                `<p>${checkUserInfluencer.email} accepted the offer for ${checkUserClient.email}'s campaign</p><br/>
    <p><b>Details:</b></p>
    <p><b>Campaign Name:</b> ${findNewCampaign.campaignName}</p>
    <p><b>Client Name:</b> ${checkUserClient.firstName}</p>
    <p><b>Campaign Content:</b><br/>
  ${
                    selectedCampaignContentItem
                        ? `<div style="margin-bottom:10px;">
          <a href="${selectedCampaignContentItem.videoLink}">${selectedCampaignContentItem.videoLink}</a>
          ${selectedPostDescription ? `<p><b>Description:</b> ${selectedPostDescription}</p>` : ''}
          ${selectedCampaignContentItem.storyTag ? `<p><b>Story Tag:</b> ${selectedCampaignContentItem.storyTag}</p>` : ''}
          ${selectedCampaignContentItem.swipeUpLink ? `<p><b>Swipe Up Link:</b> ${selectedCampaignContentItem.swipeUpLink}</p>` : ''}
          ${selectedCampaignContentItem.specialWishes ? `<p><b>Special Wishes:</b> ${selectedCampaignContentItem.specialWishes}</p>` : ''}
        </div>`
                        : ''
                }
</p>`,
                'html',
            );

            return;
        } else {
            const selectInfluencersAcc = findNewCampaign.selectInfluencers.find(
                (influencer) => influencer._id.toString() === selectInfluencersId,
            );

            const resultOfSavingHistory = await axios.post(
                `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
                {
                    influencerId: influencerId,
                    campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                    campaignName: findNewCampaign.campaignName,
                    updatedCampaignAction: {
                        actionNumber: 2,
                        networkUsername: socialMediaUsername,
                        socialMedia: selectInfluencersAcc.socialMedia,
                        rewardForInfluencer: selectInfluencersAcc.price.replace(/\D/g, ''),
                    },
                },
            );

            if (resultOfSavingHistory.data.code !== 200) throw new InternalServerErrorException('Something went wrong');

            const updatePromo = await this.campaignModel.findOneAndUpdate(
                {
                    _id: campaignId,
                    selectInfluencers: {
                        $elemMatch: {
                            _id: new mongoose.Types.ObjectId(selectInfluencersId),
                        },
                    },
                },
                {
                    $set: {
                        'selectInfluencers.$.confirmation': campaignResponse,
                        partialRefund:
                            findNewCampaign.partialRefund + selectInfluencersAcc.price.replace(/\D/g, ''),
                    },
                },
                {new: true},
            );

            const checkUserInfluencer = await this.influencerModel.findById(influencerId);
            const checkUserClient = await this.clientModel.findById(
                findNewCampaign.clientId || (findNewCampaign as any).userId,
            );

            await sendMail(
                // 'nazarkozynets030606@zohomail.eu',
                'admin@soundinfluencers.com',
                'SoundInfluencers',
                `<p>${checkUserInfluencer.email} declined the offer for ${checkUserClient.email}'s campaign</p><br/>
                <p><b>Details:</b></p>
                <p><b>Campaign Name:</b> ${findNewCampaign.campaignName}</p>
                <p><b>Client Name:</b> ${checkUserClient.firstName}</p>
                <p><b>Campaign Content:</b> ${
                    findNewCampaign.campaignContent
                        ? findNewCampaign.campaignContent
                            .map(
                                (campaignContentItem) => `
                  <div style="margin-bottom:10px;">
                    <a href="${campaignContentItem.videoLink}">
                      ${campaignContentItem.videoLink}
                    </a>
                    ${
                                    campaignContentItem.postDescriptions?.length
                                        ? `<ul>
                            ${campaignContentItem.postDescriptions
                                            .map((pd) => `<li><b>Description:</b> ${pd.description}</li>`)
                                            .join('')}
                          </ul>`
                                        : ''
                                }
                  </div>
                `,
                            )
                            .join('')
                        : (findNewCampaign as any).videos
                            .map((video) => `<a href="${video.videoLink}">${video.videoLink}</a>`)
                            .join(', ')
                }</p>`,
                'html',
            );

            return;
        }
    }

    // helper for creating pipeline for influencerGetDashboardPromos
    private buildInfluencerDashboardPipeline(
        influencerId: string,
        status: InfluencerDashboardPromoStatus,
        limit: number = 12,
        skip: number = 0
    ): PipelineStage[] {
        const pipeline: PipelineStage[] = [
            {
                $match: {
                    'selectInfluencers.influencerId': new Types.ObjectId(influencerId),
                },
            },
            {$unwind: '$selectInfluencers'},
            {
                $match: {
                    'selectInfluencers.influencerId': new Types.ObjectId(influencerId),
                },
            },
        ];

        switch (status) {
            case InfluencerDashboardPromoStatus.new:
                pipeline.push({
                    $match: {
                        'selectInfluencers.confirmation': 'wait',
                    },
                });
                break;

            case InfluencerDashboardPromoStatus.ongoing:
                pipeline.push({
                    $match: {
                        'selectInfluencers.confirmation': 'accept',
                        'selectInfluencers.closePromo': 'wait',
                    },
                });
                break;

            case InfluencerDashboardPromoStatus.close:
                pipeline.push({
                    $match: {
                        'selectInfluencers.closePromo': 'close',
                    },
                });
                break;

            case InfluencerDashboardPromoStatus.all:
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
                selectInfluencersId: '$selectInfluencers._id',
                campaignName: '$campaignName',
                socialMedia: '$selectInfluencers.socialMedia',
                statusCampaign: '$statusCampaign',
                closedStatus: '$selectInfluencers.closePromo',
                confirmation: '$selectInfluencers.confirmation',
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

    // Returns influencer's promos
    async influencerGetDashboardPromos(
        data: InfluencerGetDashboardPromosQueryDto,
    ): Promise<InfluencerDashboardPromo[]> {
        const influencerId = data.influencerId;
        const status = data.status ?? InfluencerDashboardPromoStatus.all;
        const limit = Number(data.limit ?? 12);
        const page = Number(data.page ?? 1);

        if (!Number.isInteger(limit) || limit <= 0) {
            throw new BadRequestException('Invalid limit');
        }

        if (!Number.isInteger(page) || page <= 0) {
            throw new BadRequestException('Invalid page');
        }

        const skip = (data.page - 1) * limit;

        const influencerExists = await this.influencerModel.exists({
            _id: new Types.ObjectId(influencerId),
        });

        if (!influencerExists) {
            throw new NotFoundException('Influencer not found');
        }

        // new + ongoing
        if (
            status === InfluencerDashboardPromoStatus.new ||
            status === InfluencerDashboardPromoStatus.ongoing
        ) {
            return this.campaignRepo
                .aggregate<InfluencerDashboardPromo>(
                    this.buildInfluencerDashboardPipeline(influencerId, status, limit, skip),
                )
                .exec();
        }

        // closed
        if (status === InfluencerDashboardPromoStatus.close) {
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
                    this.buildInfluencerDashboardPipeline(influencerId, InfluencerDashboardPromoStatus.all, limit, skip),
                )
                .exec(),

            this.completedCampaignRepo
                .aggregate<InfluencerDashboardPromo>(
                    this.buildInfluencerDashboardPipeline(influencerId, InfluencerDashboardPromoStatus.all, limit, skip),
                )
                .exec(),
        ]);

        return [...active, ...closed]
            .sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
            .slice(0, limit);
    }

    // Returns influencer's detailed completed promos
    async influencerGetCompletedPromos(data: InfluencerGetCompletedPromosQueryDto): Promise<InfluencerCompletedPromo[]> {
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

        const influencerExists = await this.influencerModel.exists({
            _id: new Types.ObjectId(influencerId),
        });

        if (!influencerExists) {
            throw new NotFoundException('Influencer not found');
        }

        return await this.completedCampaignRepo.aggregate<InfluencerCompletedPromo>([
            {
                $match: {
                    'selectInfluencers.influencerId': new Types.ObjectId(influencerId),
                },
            },
            {
                $unwind: '$selectInfluencers',
            },
            {
                $match: {
                    'selectInfluencers.influencerId': new Types.ObjectId(influencerId),
                    'selectInfluencers.closePromo': 'close',
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
                    campaignId: {$toString: '$_id'},
                    selectInfluencersId: {$toString: '$selectInfluencers._id'},
                    campaignName: '$campaignName',
                    socialMediaUsername: '$selectInfluencers.socialMediaUsername',
                    socialMedia: '$selectInfluencers.socialMedia',
                    reward: {$toDouble: '$selectInfluencers.price'},
                    postLink: '$selectInfluencers.postLink',
                    client: {
                        $ifNull: [
                            {
                                $cond: {
                                    if: {$and: [{$ne: ['$client.company', null]}, {$ne: ['$client.company', '']}]},
                                    then: '$client.company',
                                    else: '$client.firstName',
                                },
                            },
                            'No information',
                        ],
                    },
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
            },
        ]).exec();
    }

    // Return's influencer's detailed ongoing promo
    async influencerGetOngoingPromo(
        influencerId: string,
        campaignId: string,
        selectInfluencersId: string,
    ): Promise<InfluencerPromo> {

        if (!campaignId || !selectInfluencersId) {
            throw new BadRequestException('Not enough arguments');
        }

        const influencer = await this.influencerModel.findById(influencerId);
        if (!influencer) {
            throw new NotFoundException('Influencer not found');
        }

        const campaign = await this.campaignModel.findById(campaignId).lean();
        if (!campaign) {
            throw new NotFoundException('Campaign not found');
        }

        const client = await this.clientModel.findById(
            campaign.clientId || (campaign as any).userId,
        );
        if (!client) {
            throw new NotFoundException('Client not found');
        }

        const selectedInfluencer = campaign.selectInfluencers.find(
            (item) => item._id.toString() === selectInfluencersId,
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
            selectedCampaignContentItem.postDescriptions?.find(
                (pd) =>
                    pd._id.toString() ===
                    selectedInfluencer.selectedContent.postDescriptionId?.toString(),
            )?.description ?? '';

        return {
            campaignId: campaign._id.toString(),
            influencerId: selectedInfluencer.influencerId.toString(),
            selectInfluencersId: selectedInfluencer._id.toString(),
            campaignName: campaign.campaignName,
            socialMediaUsername: selectedInfluencer.socialMediaUsername,
            socialMedia: selectedInfluencer.socialMedia as SocialMediaType,
            dateRequest: selectedInfluencer.dateRequest,
            createdAt: campaign.createdAt,
            videoLink: selectedCampaignContentItem.videoLink,
            postDescription,
            storyTag: selectedCampaignContentItem.storyTag,
            storyLink: selectedCampaignContentItem.swipeUpLink,
            additionalBrief: selectedCampaignContentItem.specialWishes,
            client: client.company,
            statusCampaign: campaign.statusCampaign as CampaignStatusType,
            closedStatus: selectedInfluencer.closePromo as InfluencerPromoClosedStatusType,
            confirmation: selectedInfluencer.confirmation as InfluencerConfirmationStatusType,
        };
    }

    // Closing influencer's promo
    async influencerUpdateOngoingCampaign(
        data: InfluencerUpdatePromoReqBodyDto,
    ): Promise<void> {
        const {
            influencerId,
            campaignId,
            socialMediaUsername,
            selectInfluencersId,
            data: postDetails,
        } = data;

        if (!influencerId || !campaignId || !socialMediaUsername || !selectInfluencersId) {
            throw new BadRequestException('Not enough arguments');
        }

        const campaign = await this.campaignRepo
            .findOne({
                _id: campaignId,
                selectInfluencers: {
                    $elemMatch: {
                        influencerId,
                        $or: [
                            {socialMediaUsername},
                            {instagramUsername: socialMediaUsername},
                        ],
                    },
                },
            }, { lean: true });

        if (!campaign) {
            throw new NotFoundException('Campaign not found');
        }

        const socialAccount = campaign.selectInfluencers.find(
            (item) => item._id.toString() === selectInfluencersId,
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
                }).map(([key, value]) => [`selectInfluencers.$.${key}`, value]),
            );

            const updateResult = await this.campaignModel.updateOne(
                {
                    _id: campaignId,
                    'selectInfluencers._id': new mongoose.Types.ObjectId(selectInfluencersId),
                    'selectInfluencers.closePromo': {$ne: 'close'},
                },
                {$set: updatePayload},
                {session},
            );

            // promo already closed by another request
            if (updateResult.modifiedCount === 0) {
                await session.abortTransaction();
                return;
            }

            // pay influencer
            const reward = Number(socialAccount.price?.replace(/\D/g, ''));

            if (!reward || Number.isNaN(reward)) {
                throw new InternalServerErrorException('Invalid influencer reward in database');
            }

            await this.influencerModel.updateOne(
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
                    actionNumber: 3,
                    networkUsername: socialMediaUsername,
                    rewardForInfluencer: Number(
                        socialAccount.price.replace(/\D/g, ''),
                    ),
                    socialMedia: socialAccount.socialMedia
                }
            })

            await session.commitTransaction();
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            await session.endSession();
        }
    }

    // Replace influencerId in each ongoing promo
    async replaceInfluencerIdInOngoingPromos(
        context: SocialAccountMigrationContext,
        session: ClientSession,
    ): Promise<void> {
        const {targetInfluencerId, sourceInfluencerId} = context;

        if (!targetInfluencerId || !sourceInfluencerId) throw new BadRequestException('Not enough arguments');

        await this.campaignRepo.replaceInfluencerId(sourceInfluencerId.toString(), targetInfluencerId.toString(), {session});
    }
}
