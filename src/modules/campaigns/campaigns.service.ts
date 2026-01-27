import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import mongoose, {Types} from "mongoose";
import {
    CampaignConfirmationEnum,
    CampaignPaymentStatusEnum,
    CampaignStatusEnum,
    CampaignTypeEnumForDevelopment,
    ClientCampaignForTable,
    ClientGetCampaignForList,
    PublicCampaignForTable
} from "../../common/types/client/campaign.types";
import {SocialMediaEnum, SocialMediaType} from "../../common/types/social-media.types";
import {formatClientCampaignStatus, formatDate} from "../../common/utils/formatters";
import {CampaignContentItemDto, CreateCampaignDto, CreateDraftCampaignDto} from "./dto/create-campaign.dto";
import {SaveXlsxCampaignDto} from "./dto/save-xlsx-campaign.dto";
import {SendNewFullServicedCampaignRequest} from "./dto/send-new-full-serviced-campaign-request";
import sendMail from "../../integrations/nodemailer/nodemailer";
import axios from "axios";
import {
    AccountObjectForCreateNewPromoRequestMessage,
    createNewPromoRequestHTMLMessage
} from "../../common/utils/new-promo-message";
import {getSocialMediaGroup} from "../../common/utils/socialMedia";
import {returnMusicStyles} from "../../common/utils/genres";
import {ClientGetDashboardCampaignsQueryDto, DetailedDraftCampaignDto} from "./dto/get-campaigns.dto";
import {CampaignRepository} from "../../database/repositories/campaigns/campaign.repository";
import {CompletedCampaignRepository} from "../../database/repositories/campaigns/completed-campaign.repository";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {ProposalCampaignRepository} from "../../database/repositories/campaigns/proposal-campaign.repository";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {
    Campaign,
    CampaignAccount,
    CampaignContentItem,
    SelectedContent
} from "../../database/schemas/campaign/campaign.schema";
import {Client} from "../../database/schemas/users/client.schema";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {DraftCampaignRepository} from "../../database/repositories/campaigns/draft-campaign.repository";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../../common/types/influencer/promo.types";
import {DraftCampaign} from "../../database/schemas/campaign/draft-campaign.schema";
import {FoundAccountDto} from "../profile/dto/influencer/get-profile.dto";

@Injectable()
export class CampaignsService {
    private readonly logger = new Logger();

    constructor(
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
        private readonly influencerActionsHistoryService: InfluencerActionsHistoryService,
        private readonly campaignRepo: CampaignRepository,
        private readonly draftCampaignRepo: DraftCampaignRepository,
        private readonly completedCampaignRepo: CompletedCampaignRepository,
        private readonly proposalCampaignRepo: ProposalCampaignRepository,
    ) {
    }

    // Returns campaigns list for client with diff statuses
    async getCampaignsList(data: ClientGetDashboardCampaignsQueryDto): Promise<ClientGetCampaignForList[]> {
        const status: CampaignTypeEnumForDevelopment = data.status ?? CampaignTypeEnumForDevelopment.all
        const limit = Number(data.limit ?? 12);
        const page = Number(data.page ?? 1);

        if (!Number.isInteger(limit) || limit <= 0) {
            throw new BadRequestException('Invalid limit');
        }

        if (!Number.isInteger(page) || page <= 0) {
            throw new BadRequestException('Invalid page');
        }

        const skip = (page - 1) * limit;

        const checkClient = await this.clientRepo.findById(data.clientId);

        if (!checkClient) {
            throw new NotFoundException('User not found');
        }

        let campaigns: any[];

        switch (status) {
            case "draft":
                campaigns = await this.draftCampaignRepo
                    .findMany({
                        clientId: new Types.ObjectId(data.clientId),
                    }, {lean: true, limit: limit, skip: skip})
                campaigns = campaigns.map(c => ({ ...c, clientStatus: 'draft' as const }));
                break;
            case "under_review":
                campaigns = await this.campaignRepo
                    .findMany({
                        clientId: new Types.ObjectId(data.clientId),
                        statusCampaign: CampaignStatusEnum.underReview,
                        verifyCampaign: CampaignConfirmationEnum.wait
                    }, {lean: true, limit: limit, skip: skip})
                campaigns = campaigns.map(c => ({ ...c, clientStatus: 'under_review' as const }));
                break;
            case "distributing":
                campaigns = await this.campaignRepo
                    .findMany({
                        clientId: new Types.ObjectId(data.clientId),
                        statusCampaign: {
                            $in: [
                                CampaignStatusEnum.pending,
                                CampaignStatusEnum.distributing,
                            ],
                        },
                    }, {lean: true, limit: limit, skip: skip})
                campaigns = campaigns.map(c => ({ ...c, clientStatus: 'distributing' as const }));
                break;
            case "closed":
                campaigns = await this.completedCampaignRepo
                    .findMany({
                        $or: [
                            {clientId: new Types.ObjectId(data.clientId)},
                            {userId: new Types.ObjectId(data.clientId)},
                        ],
                    }, {lean: true, limit: limit, skip: skip})
                campaigns = campaigns.map(c => ({ ...c, clientStatus: 'closed' as const }));
                break;
            case "proposal":
                campaigns = await this.proposalCampaignRepo.findMany(
                    { $or: [{ creatorId: new Types.ObjectId(data.clientId) }, { clientId: new Types.ObjectId(data.clientId) }] },
                    { lean: true, limit, skip }
                );

                campaigns = campaigns.map(c => ({
                    ...c,
                    clientStatus: 'proposal' as const,
                    campaignPrice: c.publicPrice ?? c.price,
                }));
                break;
            case "all":
                const oid = new Types.ObjectId(data.clientId);

                campaigns = await this.campaignRepo.aggregate([
                    { $match: { clientId: oid } },
                    {
                        $addFields: {
                            clientStatus: {
                                $switch: {
                                    branches: [
                                        {
                                            case: { $and: [
                                                    { $eq: ['$statusCampaign', CampaignStatusEnum.underReview] },
                                                    { $eq: ['$verifyCampaign', CampaignConfirmationEnum.wait] },
                                                ]},
                                            then: 'under_review',
                                        },
                                        {
                                            case: { $eq: ['$statusCampaign', CampaignStatusEnum.pending] },
                                            then: 'pending',
                                        },
                                        {
                                            case: { $eq: ['$statusCampaign', CampaignStatusEnum.distributing] },
                                            then: 'distributing',
                                        },
                                    ],
                                    default: 'pending',
                                },
                            },
                        },
                    },

                    {
                        $unionWith: {
                            coll: 'completedcampaigns',
                            pipeline: [
                                { $match: { $or: [{ clientId: oid }, { userId: oid }] } },
                                { $addFields: { clientStatus: 'closed' } },
                            ],
                        },
                    },

                    {
                        $unionWith: {
                            coll: 'proposalcampaigns',
                            pipeline: [
                                { $match: { $or: [{ creatorId: oid }, { clientId: oid }] } },

                                {
                                    $addFields: {
                                        campaignPrice: '$publicPrice',
                                        clientStatus: 'proposal',
                                    },
                                },
                                { $project: { publicPrice: 0 } },
                            ],
                        },
                    },

                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit },

                    {
                        $project: {
                            _id: { $toString: '$_id' },
                            campaignName: 1,
                            socialMedia: 1,
                            createdAt: 1,
                            campaignPrice: 1,
                            clientStatus: 1,
                        },
                    },
                ]).exec();
                break;
            default:
                throw new BadRequestException("Bad request. Not enough arguments (missing campaign status)");
        }

        console.log(campaigns[0], campaigns[campaigns.length - 1]);

        return campaigns.map((item): ClientGetCampaignForList => ({
            _id: item._id.toString(),
            campaignName: item.campaignName,
            socialMedia: item.socialMedia as SocialMediaType,
            creationDate: formatDate(item.createdAt),
            price: item.campaignPrice ?? item.publicPrice ?? item.price ?? undefined,
            status: item.clientStatus ?? formatClientCampaignStatus(item.statusCampaign),
        }));
    }

    // Creates new campaign (NOT DRAFT)
    async createCampaign(data: CreateCampaignDto): Promise<void> {
        if (!data) throw new BadRequestException('Not enough arguments')

        const createdAt = new Date();

        const processedAccounts = await Promise.all(
            data.addedAccounts.map(async (influencer): Promise<CampaignAccount> => {
                const dateRequest = influencer.dateRequest;

                const influencerData = await this.influencerRepo
                    .findOne({
                        $or: [
                            {
                                [`${influencer.socialMedia}._id`]: new mongoose.Types.ObjectId(
                                    influencer.socialAccountId,
                                )
                            },
                            {
                                _id: new Types.ObjectId(influencer.influencerId)
                            },
                            {
                                [`${influencer.socialMedia}.username`]: influencer.username
                            }
                        ]
                    }, {lean: true});

                if (!influencerData) {
                    this.logger.log(
                        `Did not find any influencer with influencerId: ${influencer.influencerId} or social accountId: ${influencer.socialAccountId} while creating campaign ${data.campaignName}`,
                    )
                    return null;
                }

                const influencerId = influencerData._id.toString();

                const socialMediaAccount = influencerData[influencer.socialMedia].find(
                    (account) =>
                        account.username === influencer.username
                );

                if (socialMediaAccount) {
                    return {
                        ...influencer,
                        _id: new mongoose.Types.ObjectId(),
                        username: socialMediaAccount.username,
                        influencerId: new Types.ObjectId(influencerId),
                        accountId: new Types.ObjectId(influencer.socialAccountId),
                        followers: socialMediaAccount.followers,
                        price: socialMediaAccount.price,
                        publicPrice: socialMediaAccount.publicPrice,
                        selectedContent: {
                            campaignContentItemId: new Types.ObjectId(
                                influencer.selectedCampaignContentItem.campaignContentItemId,
                            ),
                            descriptionId: new Types.ObjectId(
                                influencer.selectedCampaignContentItem.descriptionId,
                            ),
                        },
                        confirmation: InfluencerConfirmationStatusEnum.wait,
                        closePromo: InfluencerPromoClosedStatusEnum.wait,
                        createdAt,
                        dateRequest,
                    };
                }
            }),
        );

        const processedCampaignContent = await Promise.all(
            data.campaignContent.map(async (campaignContentItem) => ({
                _id: new mongoose.Types.ObjectId(campaignContentItem._id),
                mainLink: campaignContentItem.mainLink.trim(),
                socialMedia: campaignContentItem.socialMedia as SocialMediaEnum,
                socialMediaGroup: campaignContentItem.socialMediaGroup,
                descriptions: campaignContentItem?.descriptions.map((pd) => ({
                    _id: new mongoose.Types.ObjectId(pd._id),
                    description: pd.description.trim(),
                })) ?? undefined,
                taggedUser: campaignContentItem.taggedUser?.trim() ?? undefined,
                taggedLink: campaignContentItem.taggedLink?.trim() ?? undefined,
                additionalBrief: campaignContentItem.additionalBrief?.trim() ?? undefined,
            } satisfies CampaignContentItem)),
        );

        const session = await this.campaignRepo.startSession();
        session.startTransaction();

        let createdCampaign: Campaign;
        let client: Client;

        try {
            const campaignId = new mongoose.Types.ObjectId();
            createdCampaign = await this.campaignRepo.create({
                ...data,
                _id: campaignId,
                clientId: new Types.ObjectId(data.clientId),
                campaignName: data.campaignName.trim(),
                addedAccounts: processedAccounts,
                paymentType: !data.paymentType ? 'payment' : data.paymentType,
                paymentStatus: CampaignPaymentStatusEnum.confirmed,
                statusCampaign: CampaignStatusEnum.underReview,
                verifyCampaign: CampaignConfirmationEnum.wait,
                shareLink: `${process.env.SERVER_CLIENT}/promo-share/${campaignId}/${data.socialMedia}`,
                campaignContent: processedCampaignContent,
                createdAt,
                schemaVersion: 2
            } as Campaign, {session});

            client = await this.clientRepo.findById(data.clientId, {session});

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }

        try {
            const emailStartContent = () => {
                return `
                    <p>Hi,</p>
<p>The Client ${client.firstName ?? 'Unknown'} has requested the following ${data.socialMedia === SocialMediaEnum.press ? 'article for inclusion in' : 'post for'} this list of influencers on the ${data.socialMedia}:</p>
<p><strong>Post Details:</strong></p>
<p><strong>Campaign Name: ${data.campaignName}</strong></p>
                    `;
            };

            const emailVideoContent = () => {
                if (data.socialMedia === 'spotify' || data.socialMedia === 'soundcloud') {
                    return processedCampaignContent
                        .map(
                            (campaignContentItem, index) => `
          <p><strong>Song/Playlist ${index + 1}:</strong></p>
          <ul>
              <li><strong>Track/Playlist Link:</strong> ${campaignContentItem.mainLink}</li>
              <li><strong>Track/Playlist Titles:</strong>
                <ul>
                  ${campaignContentItem.descriptions
                                .map((pd, i) => `<li>${i + 1}. ${pd.description}</li>`)
                                .join('')}
                </ul>
              </li>
              <li><strong>Special Wishes:</strong> ${campaignContentItem.additionalBrief}</li>
          </ul>
          <p><strong>Selected Influencers:</strong></p>
          <ul>
              ${processedAccounts
                                .filter(
                                    (account) =>
                                        account.selectedContent?.campaignContentItemId.toString() ===
                                        campaignContentItem._id.toString(),
                                )
                                .map(
                                    (account) =>
                                        `<li>${account.socialMedia} username: ${account.username}</li>`,
                                )
                                .join('')}
          </ul>
        `,
                        )
                        .join('');
                } else if (data.socialMedia === 'press') {
                    return processedCampaignContent
                        .map(
                            (campaignContentItem, index) => `
          <p><strong>Article ${index + 1}:</strong></p>
          <ul>
              <li><strong>Link to Music/Events/News:</strong> ${campaignContentItem.mainLink}</li>
              <li><strong>Descriptions:</strong>
                <ul>
                  ${campaignContentItem.descriptions
                                .map((pd, i) => `<li>${i + 1}. ${pd.description}</li>`)
                                .join('')}
                </ul>
              </li>
              <li><strong>Link To Press Release:</strong> ${campaignContentItem.taggedUser}</li>
              <li><strong>Special Wishes:</strong> ${campaignContentItem.additionalBrief}</li>
          </ul>
          <p><strong>Selected Influencers:</strong></p>
          <ul>
              ${processedAccounts
                                .filter(
                                    (influencer) =>
                                        influencer.selectedContent?.campaignContentItemId.toString() ===
                                        campaignContentItem._id.toString(),
                                )
                                .map(
                                    (influencer) =>
                                        `<li>${influencer.socialMedia} username: ${influencer.username}</li>`,
                                )
                                .join('')}
          </ul>
        `,
                        )
                        .join('');
                } else {
                    return processedCampaignContent
                        .map(
                            (campaignContentItem, index) => `
          <p><strong>Post Content ${index + 1}:</strong></p>
          <ul>
              <li><strong>Link:</strong> ${campaignContentItem.mainLink}</li>
              <li><strong>Post Descriptions:</strong>
                <ul>
                  ${campaignContentItem.descriptions
                                .map((pd, i) => `<li>${i + 1}. ${pd.description}</li>`)
                                .join('')}
                </ul>
              </li>
              <li><strong>Story Tag:</strong> ${campaignContentItem.taggedUser}</li>
              <li><strong>Swipe Up Link:</strong> ${campaignContentItem.taggedLink}</li>
              <li><strong>Special Wishes:</strong> ${campaignContentItem.additionalBrief}</li>
          </ul>
          <p><strong>Selected Influencers:</strong></p>
          <ul>
              ${processedAccounts
                                .filter(
                                    (influencer) =>
                                        influencer.selectedContent?.campaignContentItemId.toString() ===
                                        campaignContentItem._id.toString(),
                                )
                                .map(
                                    (influencer) =>
                                        `<li>${influencer.socialMedia} username: ${influencer.username}</li>`,
                                )
                                .join('')}
          </ul>
        `,
                        )
                        .join('');
                }
            };

            const emailContent = `
${emailStartContent()}
${emailVideoContent()}
<p>Payment Method Used: ${createdCampaign.paymentType}</p>
<p>
    <a style="font-weight: 600" href="${process.env.SERVER}/campaigns/verify?promoId=${createdCampaign._id.toString()}&status=accept">
        Approve
    </a> 
    <a style="font-weight: 600" href="${process.env.SERVER}/campaigns/verify?promoId=${createdCampaign._id.toString()}&status=cancel">
        Decline
    </a>
</p>`;

            await sendMail(
                process.env.EMAIL_USER,
                'SoundInfluencers',
                emailContent,
                'html',
            );
        } catch (err) {
            this.logger.warn(`Campaign ${data.campaignName} created, but email failed`, err);
        }
    }

    // Returns detailed draft
    async getDraftCampaign(draftId: string): Promise<DetailedDraftCampaignDto> {
        if (!draftId || !Types.ObjectId.isValid(draftId)) {
            throw new BadRequestException('Invalid draftId');
        }

        const draft = await this.draftCampaignRepo.findById(draftId).lean();
        if (!draft) throw new NotFoundException('Draft not found');

        try {
            const added = draft.addedAccounts ?? [];
            if (added.length === 0) {
                return {
                    _id: draft._id.toString(),
                    campaignName: draft.campaignName,
                    socialMedia: draft.socialMedia,
                    addedAccounts: [],
                    campaignContent: draft.campaignContent as any,
                };
            }

            const influencerIds: Types.ObjectId[] = [];
            const accountIds: Types.ObjectId[] = [];
            const socialMediasSet = new Set<string>();

            const inflSeen = new Set<string>();
            const accSeen = new Set<string>();

            for (const a of added) {
                const inflId = a.influencerId;
                const accId = a.accountId;
                if (inflId && !inflSeen.has(inflId.toString())) {
                    inflSeen.add(inflId.toString());
                    influencerIds.push(inflId);
                }
                if (accId && !accSeen.has(accId.toString())) {
                    accSeen.add(accId.toString());
                    accountIds.push(accId);
                }
                if (a.socialMedia) socialMediasSet.add(a.socialMedia);
            }

            const socialMedias = Array.from(socialMediasSet);
            if (socialMedias.length === 0) {
                throw new BadRequestException('Draft has no socialMedia in addedAccounts');
            }

            const concatParts = socialMedias.map((sm) => ({
                $map: {
                    input: `$${sm}`,
                    as: 'a',
                    in: { $mergeObjects: ['$$a', { socialMedia: sm }] },
                },
            }));

            const pipeline: any[] = [
                { $match: { _id: { $in: influencerIds } } },
                {
                    $project: {
                        influencerId: '$_id',
                        accAll: { $concatArrays: concatParts },
                    },
                },
                { $unwind: '$accAll' },
                { $set: { acc: '$accAll' } },
                { $match: { 'acc.isHidden': { $ne: true }, 'acc.isDeleted': { $ne: true } } },
                { $match: { 'acc._id': { $in: accountIds } } },

                {
                    $project: {
                        _id: 0,
                        accountId: { $toString: '$acc._id' },
                        influencerId: { $toString: '$influencerId' },
                        username: '$acc.username',
                        logoUrl: '$acc.logoUrl',
                        followers: '$acc.followers',
                        socialMedia: '$acc.socialMedia',
                        countries: { $ifNull: ['$acc.countries', []] },

                        musicGenres: {
                            $cond: [
                                { $isArray: '$acc.musicGenres' },
                                { $map: { input: '$acc.musicGenres', as: 'g', in: '$$g.genre' } },
                                '$$REMOVE',
                            ],
                        },
                        creatorCategories: { $ifNull: ['$acc.creatorCategories', '$$REMOVE'] },
                        categories: { $ifNull: ['$acc.categories', '$$REMOVE'] },

                        // todo: convert price
                        prices: {
                            EUR: { $ifNull: ['$acc.publicPrice', { $literal: 0 }] },
                            USD: { $literal: 0 },
                            GBP: { $literal: 0 },
                        },
                    },
                },
            ];

            const rows = await this.influencerRepo
                .aggregate<FoundAccountDto>(pipeline)
                .allowDiskUse(true);

            const byAccountId = new Map<string, FoundAccountDto>();
            for (const r of rows) byAccountId.set(r.accountId, r);

            const addedAccountsDetailed = draft.addedAccounts.map((a) => {
                const key = a.accountId.toString();
                const full = byAccountId.get(key);

                if (!full) {
                    return {
                        accountId: key,
                        influencerId: a.influencerId.toString(),
                        username: '[not found]',
                        logoUrl: '',
                        followers: 0,
                        prices: { EUR: 0, USD: 0, GBP: 0 },
                        socialMedia: a.socialMedia,
                        countries: [],
                        selectedContent: a.selectedContent,
                    } as any;
                }

                return {
                    ...full,
                    selectedContent: a.selectedContent,
                } as any;
            });

            return {
                _id: draft._id.toString(),
                campaignName: draft.campaignName,
                socialMedia: draft.socialMedia,
                addedAccounts: addedAccountsDetailed,
                campaignContent: draft.campaignContent as any,
            };
        } catch (err) {
            throw new InternalServerErrorException(
                `Draft ${draftId} found, but can't build detailed response`,
                err as any,
            );
        }
    }

    // Creates new campaign draft
    async createDraftCampaign(data: CreateDraftCampaignDto): Promise<void> {
        await this.draftCampaignRepo.create<DraftCampaign>({
            ...data,
            _id: new Types.ObjectId(),
            clientId: new Types.ObjectId(data.clientId),
            addedAccounts: data.addedAccounts.map((acc) => ({
                _id: new Types.ObjectId(),
                influencerId: new Types.ObjectId(acc.influencerId),
                accountId: new Types.ObjectId(acc.socialAccountId),
                socialMedia: acc.socialMedia,
                selectedContent: {
                    campaignContentItemId: new Types.ObjectId(acc.selectedContent.campaignContentItemId),
                    descriptionId: new Types.ObjectId(acc.selectedContent.descriptionId)
                } as SelectedContent,
            })),
            campaignContent: data.campaignContent.map((c: CampaignContentItemDto): CampaignContentItem => ({
                _id: new Types.ObjectId(c._id),
                socialMedia: c.socialMedia,
                socialMediaGroup: c.socialMediaGroup,
                mainLink: c.mainLink,
                descriptions: c?.descriptions?.map((d) => ({
                    _id: new Types.ObjectId(d._id),
                    description: d.description
                })) ?? undefined,
                taggedUser: c.taggedUser ?? undefined,
                taggedLink: c.taggedLink ?? undefined,
                additionalBrief: c.additionalBrief ?? undefined
            }))
        });
    }

    // Deletes draft campaign (by id)
    async deleteDraftCampaign(draftId: string, clientId: string): Promise<void> {
        if (!draftId) throw new BadRequestException('Invalid draftId');

        // make sure creator tries to delete his own draft
        const draftExists = await this.campaignRepo.exists({_id: new Types.ObjectId(draftId), clientId: new Types.ObjectId(clientId)});
        if (!draftExists) throw new NotFoundException('Draft not found');

        // delete draft
        await this.campaignRepo.deleteById(draftId);
    }

    // TODO: update and test
    async verifyCampaign(campaignId: string, status: string) {
        if (!campaignId || !status) throw new BadRequestException('Not enough arguments')

        const checkCampaign: Campaign = await this.campaignRepo.findById(campaignId, {lean: true});

        if (!checkCampaign) throw new NotFoundException('Campaign not found')

        if (status === 'accept' && checkCampaign.statusCampaign === CampaignStatusEnum.pending) {
            const influencersIds = checkCampaign.addedAccounts.map((item) => item.influencerId);

            const influencers = await this.influencerRepo.findMany({_id: {$in: influencersIds}});

            if (!influencers) throw new NotFoundException('Influencers not found')

            const socialMedias = Object.values(SocialMediaEnum);

            for (let influencer of influencers) {
                await Promise.all(
                    socialMedias.map(async (socialMedia) => {
                        const accounts = influencer[socialMedia];
                        await Promise.all(
                            accounts.map(async (account) => {
                                if (
                                    checkCampaign.addedAccounts.some(
                                        (influencerData) =>
                                            (influencerData.username === account.username ||
                                                (influencerData as any).instagramUsername ===
                                                account.username) &&
                                            influencerData.socialMedia === socialMedia,
                                    )
                                ) {
                                    await this.influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory({
                                        influencerId: influencer._id.toString(),
                                        campaignId: campaignId,
                                        campaignName: checkCampaign.campaignName,
                                        updatedCampaignAction: {
                                            socialAccountId: account._id,
                                            actionNumber: 1,
                                            networkUsername: account.username,
                                            rewardForInfluencer: account.price,
                                            socialMedia: socialMedia
                                        }
                                    })
                                }

                                return account.username;
                            }),
                        );
                    }),
                );

                const influencerAccounts = checkCampaign.addedAccounts.filter(
                    (acc) => acc.influencerId.toString() === influencer._id.toString()
                );

                const accountDetails: AccountObjectForCreateNewPromoRequestMessage[] =
                    influencerAccounts.map((acc) => {
                        const content = checkCampaign.campaignContent.find(
                            (c) => c._id.toString() === acc.selectedContent?.campaignContentItemId.toString(),
                        );

                        return {
                            pageName: acc.username,
                            reward: `${acc.price}€`,
                            socialMedia: acc.socialMedia,
                            mainLink: content?.mainLink || '',
                            description:
                                content?.descriptions.find(
                                    (pd) => pd._id.toString() === acc.selectedContent?.descriptionId.toString(),
                                )?.description || '',
                            taggedUser: content?.taggedUser,
                            taggedLink: content?.taggedLink,
                            additionalBrief: content?.additionalBrief,
                        } satisfies AccountObjectForCreateNewPromoRequestMessage;
                    });

                if (accountDetails.length === 0) continue;

                const emailBody = createNewPromoRequestHTMLMessage({
                    firstName: influencer.firstName,
                    accountsAndDetails: accountDetails,
                });

                await sendMail(
                    influencer.email,
                    // 'nazarkozynets030606@zohomail.eu',
                    'New Promo Request',
                    emailBody,
                    'html'
                );
            }

            const updateFields = {verifyCampaign: (checkCampaign as any)?.verifyCampaign};

            if (checkCampaign.verifyCampaign !== undefined) {
                updateFields.verifyCampaign = status;
            }

            await this.campaignRepo.updateOne({_id: campaignId}, {$set: updateFields});

            return {
                code: 200,
                message: 'Campaign verified',
            };
        } else {
            return {
                code: 200,
                message: 'Campaign declined',
            };
        }
    }

    // todo: improve
    // Returns one detailed campaign obj - used by campaign report page
    async getClientOngoingOrPastCampaign(campaignId: string, clientId: string): Promise<ClientCampaignForTable> {
        if (!campaignId || !clientId) throw new BadRequestException('Not enough arguments');

        const client = await this.clientRepo.findById(clientId);
        if (!client) throw new NotFoundException('User not found');

        let campaign: any = await this.campaignRepo.findById(campaignId, {lean: true});
        if (!campaign) campaign = await this.completedCampaignRepo.findById(campaignId, {lean: true});
        if (!campaign) throw new NotFoundException('Campaign not found');

        const campaignToReturn: any = {
            campaignId: campaignId,
            // clientId: campaign.clientId,
            campaignName: campaign.campaignName ?? 'OLD CAMPAIGN',
            socialMedia: campaign.socialMedia ?? 'instagram',
            creationDate: formatDate(campaign.createdAt),
            price: campaign.campaignPrice ?? (campaign as any).price ?? (campaign as any).amount ?? 0,
            status: campaign.statusCampaign,
            addedAccounts: [],
            campaignContent: campaign.campaignContent ?? (campaign as any).videos ?? [],
            shareLink: campaign.shareLink ?? null,
            totalFollowers: 0,
            totalImpressions: 0,
            totalLikes: 0,
            totalSaves: 0,
            totalComments: 0,
            totalShares: 0,
            isCpmAndResultHidden: campaign.isCpmAndResultHidden ?? false,
            isPriceHidden: campaign.isPriceHidden ?? false,
            hiddenColumns: campaign.hiddenColumns ?? [],
            cpm: null
        };

        for (const addedAccount of campaign.addedAccounts) {
            const selectedCampaignContentItemId: string | Types.ObjectId =
                addedAccount?.selectedContent?.campaignContentItemId?.toString() ??
                (addedAccount as any)?.selectedCampaignContentItem?.toString() ??
                (Array.isArray((campaign as any)?.videos)
                    ? (campaign as any).videos?.find((v) => v.videoLink === (addedAccount as any)?.selectedVideo)?._id?.toString()
                    : null) ??
                null;

            let selectedCampaignContentItem = null;
            if (selectedCampaignContentItemId) {
                selectedCampaignContentItem =
                    (Array.isArray(campaign.campaignContent)
                        ? (() => {
                            const contentItem = campaign.campaignContent.find(
                                (item) => item?._id.toString() === selectedCampaignContentItemId,
                            );
                            if (!contentItem) return null;

                            let description: string;
                            try {
                                description = contentItem.descriptions?.find(
                                    (pd) => pd._id.toString() === addedAccount.selectedContent?.descriptionId.toString(),
                                )?.description ?? (contentItem as any)?.postDescription ?? '';
                            } catch (err) {
                                this.logger.warn(`Can't get description for addedAccounts ${addedAccount._id} in campaign ${campaign._id}`);
                            }

                            return {
                                _id: contentItem._id,
                                mainLink: contentItem.mainLink ?? (contentItem as any).videoLink ?? null,
                                description: description ?? null,
                                taggedUser: contentItem.taggedUser ?? (contentItem as any).storyTag ?? null,
                                taggedLink: contentItem.taggedLink ?? (contentItem as any).swipeUpLink ?? null,
                                additionalBrief: contentItem.additionalBrief ?? (contentItem as any).specialWishes ?? null,
                            };
                        })()
                        : null) ??
                    (Array.isArray((campaign as any).videos)
                        ? (campaign as any).videos.find(
                            (item) => item?._id?.toString() === selectedCampaignContentItemId?.toString(),
                        )
                        : null) ??
                    null;
            }

            addedAccount.selectedContent = {
                campaignContentItemId: new Types.ObjectId(selectedCampaignContentItemId),
                descriptionId: addedAccount.selectedContent.descriptionId ?? undefined
            };
            addedAccount.selectedCampaignContentItem = selectedCampaignContentItem;

            campaignToReturn.totalFollowers += addedAccount.followers ?? 0;
            campaignToReturn.totalLikes += addedAccount.like ?? 0;
            campaignToReturn.totalImpressions += addedAccount.impressions ?? 0;
            campaignToReturn.totalSaves += addedAccount.saves ?? 0;
            campaignToReturn.totalComments = addedAccount.comments ?? 0;
            campaignToReturn.totalShares = addedAccount.shares ?? 0;

            campaignToReturn.addedAccounts.push(addedAccount);
        }

        campaignToReturn.addedAccounts.sort((a, b) => {
            const aIndex = Array.isArray(campaign.campaignContent)
                ? campaign.campaignContent.findIndex(
                    (c) => c?._id?.toString() === a.selectedContent.campaignContentItemId?.toString(),
                )
                : Array.isArray((campaign as any).videos)
                    ? (campaign as any).videos.findIndex(
                        (v) => v?._id?.toString() === a.selectedCampaignContentItemId?.toString(),
                    )
                    : -1;

            const bIndex = Array.isArray(campaign.campaignContent)
                ? campaign.campaignContent.findIndex(
                    (c) => c?._id?.toString() === b.selectedCampaignContentItemId?.toString(),
                )
                : Array.isArray((campaign as any).videos)
                    ? (campaign as any).videos.findIndex(
                        (v) => v?._id?.toString() === b.selectedCampaignContentItemId?.toString(),
                    )
                    : -1;

            return aIndex - bIndex;
        });

        try {
            campaignToReturn.cpm =
                campaignToReturn.totalImpressions > 0
                    ? Math.round((campaignToReturn.price * 1000 / campaignToReturn.totalImpressions) * 1000) / 1000
                    : null;
        } catch (e) {
            this.logger.warn(`Can't retrieve cpm for campaign ${campaignId}: ${e}`);
        }

        return campaignToReturn;
    }

    async saveXLSXCampaign(data: SaveXlsxCampaignDto) {
        if (!data) throw new BadRequestException('Invalid data')

        const isMultiPromo = !data.socialMedia || data.socialMedia === 'multipromo';

        const campaign = {
            campaignId: new Types.ObjectId().toHexString(),
            campaignName: data.campaignName,
            price: data.price || 0,
            publicPrice: data.price || 0,
            socialMedia: data.socialMedia || 'multipromo',
            addedAccounts: [],
            campaignContent: [],
            totalFollowers: 0,
            clientId: '66f540faaf4e960d2f9bebfc',
        };

        await Promise.all(
            data.pages.map(async (page) => {
                let influencerId: Types.ObjectId | null = null;

                if (isMultiPromo) {
                    const normalizedUsername = page.socialMediaUsername.trim();
                    const socialMediaPlatforms = [
                        'instagram',
                        'facebook',
                        'tiktok',
                        'youtube',
                        'spotify',
                        'soundcloud',
                        'press',
                    ];

                    const aggregationPipeline = [
                        {
                            $facet: socialMediaPlatforms.reduce((acc, platform) => {
                                acc[platform] = [
                                    {$unwind: {path: `$${platform}`, preserveNullAndEmptyArrays: true}},
                                    {
                                        $match: {
                                            $expr: {
                                                $let: {
                                                    vars: {
                                                        cleanFollowers: {
                                                            $replaceAll: {
                                                                input: {
                                                                    $replaceAll: {
                                                                        input: `$${platform}.followersNumber`,
                                                                        find: '.',
                                                                        replacement: '',
                                                                    },
                                                                },
                                                                find: ',',
                                                                replacement: '',
                                                            },
                                                        },
                                                    },
                                                    in: {
                                                        $and: [
                                                            {
                                                                $eq: [
                                                                    {$trim: {input: `$${platform}.instagramUsername`}},
                                                                    normalizedUsername,
                                                                ],
                                                            },
                                                            {
                                                                $eq: [{$toInt: '$$cleanFollowers'}, page.followersNumber],
                                                            },
                                                        ],
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    {
                                        $project: {
                                            influencerId: `$${platform}._id`,
                                            socialMedia: platform,
                                            price: `$${platform}.price`,
                                            publicPrice: `$${platform}.publicPrice`,
                                            dateRequest: data.timeline,
                                            followersNumber: `$${platform}.followersNumber`,
                                            countries: `$${platform}.countries`,
                                            musicStyle: `$${platform}.musicStyle`,
                                            musicSubStyles: `$${platform}.musicSubStyles`,
                                            musicStyleOther: `$${platform}.musicStyleOther`,
                                        },
                                    },
                                ];
                                return acc;
                            }, {}),
                        },
                        {
                            $project: {
                                combined: {
                                    $concatArrays: socialMediaPlatforms.map((platform) => `$${platform}`),
                                },
                            },
                        },
                        {$unwind: '$combined'},
                        {
                            $project: {
                                influencerId: '$combined.influencerId',
                                socialMedia: '$combined.socialMedia',
                                price: '$combined.price',
                                publicPrice: '$combined.publicPrice',
                                dateRequest: '$combined.dateRequest',
                                followersNumber: '$combined.followersNumber',
                                countries: '$combined.countries',
                                musicStyle: '$combined.musicStyle',
                                musicSubStyles: '$combined.musicSubStyles',
                                musicStyleOther: '$combined.musicStyleOther',
                            },
                        },
                    ];

                    const result = await this.influencerRepo.aggregate(aggregationPipeline).exec();

                    if (result.length > 0) {
                        influencerId = result[0].influencerId
                            ? new Types.ObjectId(result[0].influencerId)
                            : null;
                        let selectedCampaignContentItem: {
                            campaignContentItemId: string,
                            postDescriptionId: string
                        } | null = null;

                        const existingContentIndex: number = campaign.campaignContent.findIndex(
                            (item) =>
                                item.videoLink === page.videoLink &&
                                getSocialMediaGroup(item.socialMedia) === getSocialMediaGroup(result[0].socialMedia),
                        );

                        if (page.videoLink && existingContentIndex === -1) {
                            const campaignContentItemId = new Types.ObjectId().toHexString();
                            const postDescriptionId = new Types.ObjectId().toHexString();

                            selectedCampaignContentItem = {
                                campaignContentItemId,
                                postDescriptionId
                            };

                            campaign.campaignContent.push({
                                _id: campaignContentItemId,
                                videoLink: page.videoLink,
                                postDescriptions: [{
                                    _id: postDescriptionId,
                                    description: page.postDescription || '',
                                }],
                                storyTag: page.storyTag || '',
                                swipeUpLink: page.storyLink || '',
                                specialWishes: page.specialWishes || '',
                                socialMedia: result[0].socialMedia,
                                socialMediaGroup: getSocialMediaGroup(result[0].socialMedia)
                            });
                        } else if (existingContentIndex !== -1) {
                            const existingDescriptionIndex: number = campaign.campaignContent[existingContentIndex].postDescriptions.findIndex(
                                pd => pd.description === page.postDescription,
                            )

                            if (existingDescriptionIndex === -1) {
                                const postDescriptionId = new Types.ObjectId().toHexString();

                                selectedCampaignContentItem = {
                                    campaignContentItemId: campaign.campaignContent[existingContentIndex]._id,
                                    postDescriptionId: postDescriptionId
                                };

                                campaign.campaignContent[existingContentIndex].postDescriptions.push({
                                    _id: postDescriptionId,
                                    description: page.postDescription || '',
                                })
                            } else {
                                selectedCampaignContentItem = {
                                    campaignContentItemId: campaign.campaignContent[existingContentIndex]._id,
                                    postDescriptionId: campaign.campaignContent[existingContentIndex].postDescriptions[existingDescriptionIndex]._id
                                }
                            }
                        }

                        const formattedGenres = returnMusicStyles(
                            result[0].musicStyle,
                            result[0].musicStyleOther,
                            result[0].musicSubStyles,
                        );

                        campaign.addedAccounts.push({
                            ...result[0],
                            _id: new Types.ObjectId().toHexString(),
                            socialMediaUsername: page.socialMediaUsername.trim(),
                            selectedContent: selectedCampaignContentItem,
                            genres: formattedGenres,
                            followersNumber: parseInt(result[0].followersNumber.replace(/[.,]/g, '')),
                        });

                        campaign.totalFollowers += parseInt(
                            result[0].followersNumber.replace(/[.,]/g, ''),
                        );
                    }
                } else {
                    const platform = data.socialMedia;
                    const normalizedUsername = page.socialMediaUsername.trim();
                    const aggregationPipeline = [
                        {$unwind: `$${platform}`},
                        {
                            $match: {
                                $expr: {
                                    $eq: [
                                        {$trim: {input: `$${platform}.instagramUsername`}},
                                        normalizedUsername,
                                    ],
                                },
                            },
                        },
                        {
                            $project: {
                                influencerId: `$${platform}._id`,
                                socialMedia: platform,
                                price: `$${platform}.price`,
                                publicPrice: `$${platform}.publicPrice`,
                                dateRequest: data.timeline,
                                followersNumber: `$${platform}.followersNumber`,
                                countries: `$${platform}.countries`,
                                musicStyle: `$${platform}.musicStyle`,
                                musicSubStyles: `$${platform}.musicSubStyles`,
                                musicStyleOther: `$${platform}.musicStyleOther`,
                            },
                        },
                    ];

                    const result = await this.influencerRepo.aggregate(aggregationPipeline).exec();

                    if (result.length > 0) {
                        influencerId = result[0].influencerId
                            ? new Types.ObjectId(result[0].influencerId)
                            : null;
                        let selectedCampaignContentItem: {
                            campaignContentItemId: string,
                            postDescriptionId: string,
                        } | null = null;

                        const existingContentIndex: number = campaign.campaignContent.findIndex(
                            (item) =>
                                item.videoLink === page.videoLink &&
                                getSocialMediaGroup(item.socialMedia) === getSocialMediaGroup(result[0].socialMedia),
                        );

                        if (page.videoLink && existingContentIndex === -1) {
                            const campaignContentItemId = new Types.ObjectId().toHexString();
                            const postDescriptionId = new Types.ObjectId().toHexString();

                            selectedCampaignContentItem = {
                                campaignContentItemId,
                                postDescriptionId
                            };

                            campaign.campaignContent.push({
                                _id: campaignContentItemId,
                                videoLink: page.videoLink,
                                postDescriptions: [{
                                    _id: postDescriptionId,
                                    description: page.postDescription || '',
                                }],
                                storyTag: page.storyTag || '',
                                swipeUpLink: page.storyLink || '',
                                specialWishes: page.specialWishes || '',
                                socialMedia: result[0].socialMedia,
                                socialMediaGroup: getSocialMediaGroup(result[0].socialMedia)
                            });
                        } else if (existingContentIndex !== -1) {
                            const existingDescriptionIndex: number = campaign.campaignContent[existingContentIndex].postDescriptions.findIndex(
                                pd => pd.description === page.postDescription,
                            )

                            if (existingDescriptionIndex === -1) {
                                const postDescriptionId = new Types.ObjectId().toHexString();

                                selectedCampaignContentItem = {
                                    campaignContentItemId: campaign.campaignContent[existingContentIndex]._id,
                                    postDescriptionId: postDescriptionId
                                };

                                campaign.campaignContent[existingContentIndex].postDescriptions.push({
                                    _id: postDescriptionId,
                                    description: page.postDescription || '',
                                })
                            } else {
                                selectedCampaignContentItem = {
                                    campaignContentItemId: campaign.campaignContent[existingContentIndex]._id,
                                    postDescriptionId: campaign.campaignContent[existingContentIndex].postDescriptions[existingDescriptionIndex]._id
                                }
                            }
                        }

                        const formattedGenres = returnMusicStyles(
                            result[0].musicStyle,
                            result[0].musicStyleOther,
                            result[0].musicSubStyles,
                        );

                        campaign.addedAccounts.push({
                            ...result[0],
                            _id: new Types.ObjectId().toHexString(),
                            socialMediaUsername: page.socialMediaUsername.trim(),
                            selectedContent: selectedCampaignContentItem,
                            genres: formattedGenres,
                            followersNumber: parseInt(result[0].followersNumber.replace(/[.,]/g, '')),
                        });

                        campaign.totalFollowers += parseInt(
                            result[0].followersNumber.replace(/[.,]/g, ''),
                        );
                    }
                }

                if (!influencerId) {
                    console.warn(
                        `(SAVING XLSX CAMPAIGN) No social media account found for username: ${page.socialMediaUsername} with ${page.followersNumber} followers`,
                    );
                }
            }),
        );

        campaign.campaignName =
            campaign.campaignName ||
            `F: ${Math.ceil(campaign.totalFollowers)} D: ${new Date().toISOString().split('T')[0]}`;

        await axios.put(`${process.env.SERVER}/proposal-system/save-proposal-campaign`, campaign);
    }

    async sendNewFullServicedCampaignRequest(data: SendNewFullServicedCampaignRequest) {
        const {clientId, campaignGoal, videos, music, budget, additional = ''} = data;

        const clientObj = await this.clientRepo.findById(clientId);

        if (!clientObj) throw new NotFoundException('Client not found');

        const emailText = `
    <p>${clientObj.firstName} (${clientObj.email}) requested the full serviced campaign.</p>
    <p>Details:</p><br/>
    <p><strong>Campaign Goal:</strong> ${campaignGoal}</p>
    <p><strong>Videos:</strong> ${videos}</p>
    <p><strong>Music:</strong> ${music}</p>
    <p><strong>Budget:</strong> ${budget}</p>
    ${additional ? `<p><strong>Additional:</strong> ${additional}</p>` : ''}
`;

        await sendMail(process.env.EMAIL_USER, 'SoundInfluencers', emailText, 'html');
    }

    // Returns detailed campaign (trying to get by sharelink, so not all info visible)
    async getCampaignByPublicShareLink(campaignId: string): Promise<PublicCampaignForTable> {
        if (!campaignId) throw new BadRequestException('Not enough arguments')

        let campaign: any = await this.campaignRepo.findById(campaignId, {lean: true});
        if (!campaign) campaign = await this.completedCampaignRepo.findById(campaignId, {lean: true});
        if (!campaign) throw new NotFoundException('Campaign not found')

        const campaignToReturn = {
            campaignId: campaign._id.toString(),
            // clientId: campaign.clientId,
            campaignName: campaign.campaignName ?? 'OLD CAMPAIGN',
            price: campaign.campaignPrice ?? (campaign as any).publicPrice ?? (campaign as any).amount ?? 0,
            addedAccounts: [],
            campaignContent: campaign.campaignContent ?? (campaign as any).videos ?? [],
            socialMedia: campaign.socialMedia as SocialMediaType,
            status: campaign.statusCampaign,
            totalFollowers: 0,
            totalLikes: 0,
            totalImpressions: 0,
            totalSaves: 0,
            totalComments: 0,
            totalShares: 0,
            creationDate: formatDate(campaign.createdAt),
            isCpmAndResultHidden: campaign.isCpmAndResultHidden ?? false,
            isPriceHidden: campaign.isPriceHidden ?? false,
            hiddenColumns: campaign.hiddenColumns ?? [],
            shareLink: campaign.shareLink ?? null,
            cpm: null
        };

        for (const addedAccount of campaign.addedAccounts ?? []) {
            const normalizedUsername =
                addedAccount?.username?.trim() ||
                (addedAccount as any)?.socialMediaUsername?.trim() ||
                (addedAccount as any)?.instagramUsername?.trim() ||
                '';

            const socialMedia =
                addedAccount?.socialMedia ||
                (campaign.socialMedia !== 'multipromo' && campaign.socialMedia);

            const selectedCampaignContentItemId: string | Types.ObjectId =
                addedAccount?.selectedContent?.campaignContentItemId?.toString() ??
                (addedAccount as any)?.selectedCampaignContentItem?.toString() ??
                (Array.isArray((campaign as any)?.videos)
                    ? (campaign as any).videos?.find((v) => v.videoLink === (addedAccount as any)?.selectedVideo)?._id?.toString()
                    : null) ??
                null;

            let selectedCampaignContentItem = null;
            if (selectedCampaignContentItemId) {
                selectedCampaignContentItem =
                    (Array.isArray(campaign.campaignContent)
                        ? (() => {
                            const contentItem = campaign.campaignContent.find(
                                (item) => item?._id.toString() === selectedCampaignContentItemId,
                            );
                            if (!contentItem) return null;

                            let description: string;
                            try {
                                description = contentItem.descriptions?.find(
                                    (pd) => pd._id.toString() === addedAccount.selectedContent?.descriptionId.toString(),
                                )?.description ?? (contentItem as any)?.postDescription ?? '';
                            } catch (err) {
                                this.logger.warn(`Can't get description for addedAccounts ${addedAccount._id} in campaign ${campaign._id}`);
                            }

                            return {
                                _id: contentItem._id,
                                mainLink: contentItem.mainLink ?? (contentItem as any).videoLink ?? null,
                                description: description ?? null,
                                taggedUser: contentItem.taggedUser ?? (contentItem as any).storyTag ?? null,
                                taggedLink: contentItem.taggedLink ?? (contentItem as any).swipeUpLink ?? null,
                                additionalBrief: contentItem.additionalBrief ?? (contentItem as any).specialWishes ?? null,
                            };
                        })()
                        : null) ??
                    (Array.isArray((campaign as any).videos)
                        ? (campaign as any).videos.find(
                            (item) => item?._id?.toString() === selectedCampaignContentItemId?.toString(),
                        )
                        : null) ??
                    null;
            }

            addedAccount.username = normalizedUsername;
            addedAccount.socialMedia = socialMedia;
            addedAccount.selectedContent = {
                campaignContentItemId: selectedCampaignContentItemId ? new Types.ObjectId(selectedCampaignContentItemId) : null,
                descriptionId: addedAccount.selectedContent.descriptionId ?? undefined
            };
            addedAccount.selectedCampaignContentItem = selectedCampaignContentItem;

            campaignToReturn.totalFollowers += addedAccount.followers ?? 0;
            campaignToReturn.totalLikes += addedAccount.like ?? 0;
            campaignToReturn.totalImpressions += addedAccount.impressions ?? 0;
            campaignToReturn.totalSaves += addedAccount.saves ?? 0;
            campaignToReturn.totalComments = addedAccount.comments ?? 0;
            campaignToReturn.totalShares = addedAccount.shares ?? 0;

            campaignToReturn.addedAccounts.push(addedAccount);
        }

        // сортировка аккаунтов по порядку контента
        campaignToReturn.addedAccounts = campaignToReturn.addedAccounts.sort((a, b) => {
            const aIndex = Array.isArray(campaign.campaignContent)
                ? campaign.campaignContent.findIndex(
                    (c) => c?._id?.toString() === a.selectedCampaignContentItemId?.toString(),
                )
                : Array.isArray((campaign as any).videos)
                    ? (campaign as any).videos.findIndex(
                        (v) => v?._id?.toString() === a.selectedCampaignContentItemId?.toString(),
                    )
                    : -1;

            const bIndex = Array.isArray(campaign.campaignContent)
                ? campaign.campaignContent.findIndex(
                    (c) => c?._id?.toString() === b.selectedCampaignContentItemId?.toString(),
                )
                : Array.isArray((campaign as any).videos)
                    ? (campaign as any).videos.findIndex(
                        (v) => v?._id?.toString() === b.selectedCampaignContentItemId?.toString(),
                    )
                    : -1;

            return aIndex - bIndex;
        });

        try {
            campaignToReturn.cpm =
                campaignToReturn.totalImpressions > 0
                    ? Math.round((campaignToReturn.price * 1000 / campaignToReturn.totalImpressions) * 1000) / 1000
                    : null;
        } catch (e) {
            this.logger.warn(`Can't retrieve cpm for campaign ${campaignId}: ${e}`);
        }

        return campaignToReturn;
    }
}