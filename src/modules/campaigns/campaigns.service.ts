import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {HydratedDocument, Types} from "mongoose";
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
import {
    CampaignContentItemDto,
    CreateCampaignDto,
    CreateDraftCampaignDto,
    SelectInfluencerDto
} from "./dto/create-campaign.dto";
import {SaveXlsxCampaignDto} from "./dto/save-xlsx-campaign.dto";
import {CreateBespokeCampaignDto} from "./dto/bespoke-request.dto";
import axios from "axios";
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
import {EmailService} from "../../integrations/email/email.service";
import {AccountVerifiedStatus, Role, UserPayload} from "../../common/types/user.types";
import {UpdateCampaignDto} from "./dto/update-campaign.dto";
import {mapContentItemDtoToModel, mapToClientCampaignForTable} from "../../common/mappers/campaign.mapper";
import {buildSafeFileName, uniq} from "../../common/utils/base.util";
import {ObjId, toObjIdSafe} from "../../common/types/base.types";
import {
    AccountObjectForCreateNewPromoRequestMessage,
    BuildRequestEditTemplateDto
} from "../../integrations/email/dto/templates/campaign-email.dto";
import {BespokeCampaignRepository} from "../../database/repositories/campaigns/bespoke-campaign.repository";
import {CampaignCsvExporter} from "../../common/utils/export/csv/campaign-csv.exporter";
import {CampaignPdfExporter} from "../../common/utils/export/pdf/campaign-pdf.exporter";
import {MediaService} from "../media/media.service";
import {InvoiceService} from "../invoice/invoice.service";
import {SocialAccountLabelStatus} from "../../common/types/influencer/influencer.types";
import {AdminToInfluencerEmails, ClientToAdminEmails} from "../../integrations/email/email.templates";

// -------------- PRIVATE TYPES -----------------

type MinimalInfluencer = {
    _id: ObjId;
    instagram?: any[];
    tiktok?: any[];
    spotify?: any[];
    soundcloud?: any[];
    facebook?: any[];
    youtube?: any[];
    press?: any[];
};

type AccountKey = `${SocialMediaEnum}:${string}`; // sm:accountIdString
type UsernameKey = `${SocialMediaEnum}:${string}`; // sm:username

@Injectable()
export class CampaignsService {
    private readonly logger = new Logger();

    constructor(
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
        private readonly campaignRepo: CampaignRepository,
        private readonly draftCampaignRepo: DraftCampaignRepository,
        private readonly completedCampaignRepo: CompletedCampaignRepository,
        private readonly proposalCampaignRepo: ProposalCampaignRepository,
        private readonly bespokeCampaignRepo: BespokeCampaignRepository,
        private readonly mediaService: MediaService,
        private readonly invoiceService: InvoiceService,
        private readonly influencerActionsHistoryService: InfluencerActionsHistoryService,
        private readonly emailService: EmailService,
    ) {
    }

    // -------------- HELPERS -----------------


    // builds object with CampaignAccount type from SelectInfluencerDto (dto which using for creating and updating campaigns)
    private async buildCampaignAccountsBatch(
        addedAccountsData: SelectInfluencerDto[],
    ): Promise<CampaignAccount[]> {
        if (!addedAccountsData?.length) return [];

        // 1) get only using social medias
        const usedSocialMedia = uniq(
            addedAccountsData.map(a => a.socialMedia).filter(Boolean)
        );

        // 2) get keys
        const influencerIdStrs = uniq(
            addedAccountsData.map(a => a.influencerId).filter(Boolean)
        );

        const influencerIds = influencerIdStrs
            .map(toObjIdSafe)
            .filter((x): x is ObjId => Boolean(x));

        const socialAccountIdStrs = uniq(
            addedAccountsData.map(a => a.socialAccountId).filter(Boolean)
        );
        const socialAccountIds = socialAccountIdStrs
            .map(toObjIdSafe)
            .filter((x): x is ObjId => Boolean(x));

        // usernames as fallback
        const usernamesByMedia = new Map<SocialMediaEnum, string[]>();
        for (const a of addedAccountsData) {
            if (!a.username) continue;
            const arr = usernamesByMedia.get(a.socialMedia) ?? [];
            arr.push(a.username);
            usernamesByMedia.set(a.socialMedia, arr);
        }
        for (const [sm, arr] of usernamesByMedia) {
            usernamesByMedia.set(sm, uniq(arr));
        }

        // 3) Projection: get only asked social medias + ids
        const projection: Record<string, 1> = {_id: 1};
        for (const sm of usedSocialMedia) projection[sm] = 1;

        // 4) Request №1: by influencerIds
        const influencers: MinimalInfluencer[] = influencerIds.length
            ? await this.influencerRepo.findMany(
                {_id: {$in: influencerIds}},
                {lean: true, select: Object.keys(projection)} as any,
            )
            : [];

        // 5) For elements without influencerId — request by accountId/username
        const hasMissingInfluencerId = addedAccountsData.some(a => !a.influencerId);
        if (hasMissingInfluencerId) {
            const or: any[] = [];

            if (socialAccountIds.length) {
                for (const sm of usedSocialMedia) {
                    or.push({[`${sm}._id`]: {$in: socialAccountIds}});
                }
            }

            for (const [sm, names] of usernamesByMedia) {
                if (names.length) or.push({[`${sm}.username`]: {$in: names}});
            }

            if (or.length) {
                const extra: MinimalInfluencer[] = await this.influencerRepo.findMany(
                    {$or: or},
                    {lean: true, select: Object.keys(projection)} as any,
                );

                // merge unique by influencer _id
                const seen = new Set(influencers.map(i => i._id.toString()));
                for (const inf of extra) {
                    const id = inf._id.toString();
                    if (!seen.has(id)) {
                        influencers.push(inf);
                        seen.add(id);
                    }
                }
            }
        }

        if (!influencers.length) return [];

        // 6) Indexes in memory for O(1) matching
        const byInfluencerId = new Map<string, MinimalInfluencer>();
        const byAccountId = new Map<AccountKey, { influencerId: ObjId; acc: any }>();
        const byUsername = new Map<UsernameKey, { influencerId: ObjId; acc: any }>();

        for (const inf of influencers) {
            byInfluencerId.set(inf._id.toString(), inf);

            for (const sm of usedSocialMedia) {
                const arr = (inf as any)[sm] as any[] | undefined;
                if (!Array.isArray(arr) || !arr.length) continue;

                for (const acc of arr) {
                    if (!acc?._id) continue;

                    const accIdStr = acc._id.toString();
                    byAccountId.set(`${sm}:${accIdStr}`, {influencerId: inf._id, acc});

                    const u = acc.username;
                    if (u) byUsername.set(`${sm}:${u}`, {influencerId: inf._id, acc});
                }
            }
        }

        // 7) Building CampaignAccount for each DTO item
        const result: CampaignAccount[] = [];
        const invalid: Array<{ index: number; reason: string }> = [];

        for (let idx = 0; idx < addedAccountsData.length; idx++) {
            const dto = addedAccountsData[idx];

            const dtoInfluencerId = toObjIdSafe(dto.influencerId);
            const dtoAccountId = toObjIdSafe(dto.socialAccountId);
            const dtoUsername = dto.username;

            let matched: { influencerId: ObjId; acc: any } | null = null;

            if (dtoAccountId) {
                matched = byAccountId.get(`${dto.socialMedia}:${dtoAccountId.toString()}`) ?? null;
            } else if (dtoUsername) {
                matched = byUsername.get(`${dto.socialMedia}:${dtoUsername}`) ?? null;
            }

            if (!matched) {
                invalid.push({index: idx, reason: "Account not found for provided identifiers"});
                continue;
            }

            if (dtoInfluencerId && matched.influencerId.toString() !== dtoInfluencerId.toString()) {
                invalid.push({index: idx, reason: "InfluencerId does not match the resolved account"});
                continue;
            }

            const acc = matched.acc;

            // meta validation
            if (acc.verifiedStatus !== AccountVerifiedStatus.accept) {
                invalid.push({index: idx, reason: "Account is not verified"});
                continue;
            }
            if (acc.isDeleted) {
                invalid.push({index: idx, reason: "Account is deleted"});
                continue;
            }
            if (acc.isHidden) {
                invalid.push({index: idx, reason: "Account is hidden"});
                continue;
            }

            // price validation
            if (typeof acc.price !== "number" || acc.price < 0 || typeof acc.publicPrice !== "number" || acc.publicPrice < 0) {
                invalid.push({index: idx, reason: "Invalid price/publicPrice"});
                continue;
            }

            // selectedContent validation
            if (!dto.selectedCampaignContentItem?.campaignContentItemId) {
                invalid.push({index: idx, reason: "selectedCampaignContentItem.campaignContentItemId is required"});
                continue;
            }

            result.push({
                ...dto,
                _id: new Types.ObjectId(),
                username: acc.username,
                influencerId: matched.influencerId,
                accountId: acc._id,
                followers: acc.followers,
                price: acc.price,
                publicPrice: acc.publicPrice,
                selectedContent: {
                    campaignContentItemId: new Types.ObjectId(dto.selectedCampaignContentItem.campaignContentItemId),
                    descriptionId: dto.selectedCampaignContentItem.descriptionId
                        ? new Types.ObjectId(dto.selectedCampaignContentItem.descriptionId)
                        : undefined,
                },
                confirmation: InfluencerConfirmationStatusEnum.wait,
                closePromo: InfluencerPromoClosedStatusEnum.wait,
                dateRequest: dto.dateRequest ?? null,
            } satisfies CampaignAccount);
        }

        // if (invalid.length) {
        //     throw new BadRequestException({
        //         message: "Some addedAccounts items are invalid",
        //         invalid,
        //     });
        // }

        return result;
    }


    // -------------- SERVICES -----------------


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
                campaigns = campaigns.map(c => ({...c, clientStatus: 'draft' as const}));
                break;
            case "under_review":
                campaigns = await this.campaignRepo
                    .findMany({
                        clientId: new Types.ObjectId(data.clientId),
                        statusCampaign: CampaignStatusEnum.underReview,
                        verifyCampaign: CampaignConfirmationEnum.wait
                    }, {lean: true, limit: limit, skip: skip})
                campaigns = campaigns.map(c => ({...c, clientStatus: 'under_review' as const}));
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
                campaigns = campaigns.map(c => ({...c, clientStatus: 'distributing' as const}));
                break;
            case "closed":
                campaigns = await this.completedCampaignRepo
                    .findMany({
                        $or: [
                            {clientId: new Types.ObjectId(data.clientId)},
                            {userId: new Types.ObjectId(data.clientId)},
                        ],
                    }, {lean: true, limit: limit, skip: skip})
                campaigns = campaigns.map(c => ({...c, clientStatus: 'closed' as const}));
                break;
            case "proposal":
                campaigns = await this.proposalCampaignRepo.findMany(
                    {$or: [{creatorId: new Types.ObjectId(data.clientId)}, {clientId: new Types.ObjectId(data.clientId)}]},
                    {lean: true, limit, skip}
                );

                campaigns = campaigns.map(c => ({
                    ...c,
                    clientStatus: 'proposal' as const,
                    campaignPrice: null,
                }));
                break;
            case "all":
                const oid = new Types.ObjectId(data.clientId);

                campaigns = await this.campaignRepo.aggregate([
                    {$match: {clientId: oid}},
                    {
                        $addFields: {
                            clientStatus: {
                                $switch: {
                                    branches: [
                                        {
                                            case: {
                                                $and: [
                                                    {$eq: ['$statusCampaign', CampaignStatusEnum.underReview]},
                                                    {$eq: ['$verifyCampaign', CampaignConfirmationEnum.wait]},
                                                ]
                                            },
                                            then: 'under_review',
                                        },
                                        {
                                            case: {$eq: ['$statusCampaign', CampaignStatusEnum.pending]},
                                            then: 'pending',
                                        },
                                        {
                                            case: {$eq: ['$statusCampaign', CampaignStatusEnum.distributing]},
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
                                {$match: {$or: [{clientId: oid}, {userId: oid}]}},
                                {$addFields: {clientStatus: 'closed'}},
                            ],
                        },
                    },

                    {
                        $unionWith: {
                            coll: 'proposalcampaigns',
                            pipeline: [
                                {$match: {$or: [{creatorId: oid}, {clientId: oid}]}},

                                {
                                    $addFields: {
                                        campaignPrice: '$publicCampaignPrice',
                                        clientStatus: 'proposal',
                                    },
                                },
                                {$project: {publicPrice: 0}},
                            ],
                        },
                    },

                    {$sort: {createdAt: -1}},
                    {$skip: skip},
                    {$limit: limit},

                    {
                        $project: {
                            _id: {$toString: '$_id'},
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
        if (!data || !data.paymentDetails) throw new BadRequestException('Not enough arguments')

        const createdAt = new Date();

        const processedAccounts: CampaignAccount[] =
            await this.buildCampaignAccountsBatch(data.addedAccounts);

        if (processedAccounts.length === 0) {
            throw new BadRequestException('No valid influencers provided');
        }

        const processedCampaignContent: CampaignContentItem[] = data.campaignContent.map(
            (campaignContentItem) => mapContentItemDtoToModel(campaignContentItem)
        );

        if (processedCampaignContent.length === 0) throw new BadRequestException('No valid campaign content provided')

        const campaignContentWithCache = await this.mediaService.applyMediaCacheForCreate(processedCampaignContent);

        const session = await this.campaignRepo.startSession();
        session.startTransaction();

        let createdCampaign: Campaign;
        let client: Client;

        const campaignId: ObjId = new ObjId();
        try {
            createdCampaign = await this.campaignRepo.create({
                ...data,
                _id: campaignId,
                clientId: new ObjId(data.clientId),
                campaignName: data.campaignName.trim(),
                addedAccounts: processedAccounts,
                paymentType: data.paymentDetails.selectedPaymentMethod,
                paymentStatus: CampaignPaymentStatusEnum.confirmed,
                statusCampaign: CampaignStatusEnum.underReview,
                verifyCampaign: CampaignConfirmationEnum.wait,
                shareLink: `${process.env.SERVER_CLIENT}/promo-share/${campaignId}/${data.socialMedia}`,
                campaignContent: campaignContentWithCache,
                createdAt,
                schemaVersion: 2
            } as Campaign, {session});

            client = await this.clientRepo.findById(data.clientId, {session});

            data.paymentDetails.userId = data.clientId;
            data.paymentDetails.userRole = Role.client;
            data.paymentDetails.campaignId = campaignId.toString();
            data.paymentDetails.campaignName = data.campaignName.trim();

            // create and send invoice to client
            await this.invoiceService.createClientCampaignInvoice(data.paymentDetails);

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }

        await this.emailService.send(ClientToAdminEmails.campaignCreated({
            campaignId: campaignId.toString(),
            clientId: data.clientId,
            campaignSocialMedia: data.socialMedia as SocialMediaEnum,
            paymentType: createdCampaign.paymentType,
            campaignName: createdCampaign.campaignName,
            clientName: client.firstName ?? '',
            clientEmail: client.email,
            acceptLink: `${process.env.SERVER}/campaigns/verify?campaignId=${campaignId.toString()}&status=accept`,
            declineLink: `${process.env.SERVER}/campaigns/verify?campaignId=${campaignId.toString()}&status=decline`,
        }))
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
                    in: {$mergeObjects: ['$$a', {socialMedia: sm}]},
                },
            }));

            const pipeline: any[] = [
                {$match: {_id: {$in: influencerIds}}},
                {
                    $project: {
                        influencerId: '$_id',
                        accAll: {$concatArrays: concatParts},
                    },
                },
                {$unwind: '$accAll'},
                {$set: {acc: '$accAll'}},
                {$match: {'acc.isHidden': {$ne: true}, 'acc.isDeleted': {$ne: true}}},
                {$match: {'acc._id': {$in: accountIds}}},

                {
                    $project: {
                        _id: 0,
                        accountId: {$toString: '$acc._id'},
                        influencerId: {$toString: '$influencerId'},
                        username: '$acc.username',
                        logoUrl: '$acc.logoUrl',
                        followers: '$acc.followers',
                        socialMedia: '$acc.socialMedia',
                        countries: {$ifNull: ['$acc.countries', []]},

                        musicGenres: {
                            $cond: [
                                {$isArray: '$acc.musicGenres'},
                                {$map: {input: '$acc.musicGenres', as: 'g', in: '$$g.genre'}},
                                '$$REMOVE',
                            ],
                        },
                        creatorCategories: {$ifNull: ['$acc.creatorCategories', '$$REMOVE']},
                        categories: {$ifNull: ['$acc.categories', '$$REMOVE']},

                        // todo: convert price
                        prices: {
                            EUR: {$ifNull: ['$acc.publicPrice', {$literal: 0}]},
                            USD: {$literal: 0},
                            GBP: {$literal: 0},
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
                        prices: {EUR: 0, USD: 0, GBP: 0},
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
        const draftExists = await this.draftCampaignRepo.exists({
            _id: new Types.ObjectId(draftId),
            clientId: new Types.ObjectId(clientId)
        });
        if (!draftExists) throw new NotFoundException('Draft not found');

        // delete draft
        await this.draftCampaignRepo.deleteById(new Types.ObjectId(draftId));
    }

    async verifyCampaign(campaignId: string, status: string): Promise<{ code: number, message: string }> {
        if (!campaignId || !status) throw new BadRequestException('Not enough arguments')

        const checkCampaign: Campaign = await this.campaignRepo.findById(campaignId, {lean: true});

        if (!checkCampaign) throw new NotFoundException('Campaign not found')

        if (status === 'accept' && checkCampaign.statusCampaign === CampaignStatusEnum.underReview) {
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
                                            addedAccountsId: account._id,
                                            socialAccountId: account._id,
                                            actionNumber: 0,
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

                // todo: user email service and create query of emails
                try {
                    await this.emailService.send(AdminToInfluencerEmails.newPromoRequest({
                        firstName: influencer.firstName,
                        email: influencer.email,
                        accountsAndDetails: accountDetails,
                    }));
                } catch (err) {
                    this.logger.warn(`${checkCampaign.campaignName} new promo request email failed for influencer ${influencer._id} - ${influencer.email}`, err);
                }
            }

            await this.campaignRepo.updateOne({_id: new ObjId(campaignId)}, {verifyCampaign: CampaignConfirmationEnum.accept, statusCampaign: CampaignStatusEnum.pending});

            return {
                code: 200,
                message: 'Campaign verified',
            };
        } else {
            await this.campaignRepo.updateOne({_id: new ObjId(campaignId)}, {verifyCampaign: CampaignConfirmationEnum.decline, statusCampaign: CampaignStatusEnum.declined});
            return {
                code: 200,
                message: 'Campaign declined',
            };
        }
    }

    // todo: создать оркестратор и разбить на три части (completed, ongoing, proposal) + use mapper mapToClientCampaignForTable
    // Returns one detailed campaign obj - used by campaign report page
    async getClientOngoingOrPastCampaign(
        campaignId: string,
        clientId: string
    ): Promise<ClientCampaignForTable> {

        if (!campaignId || !clientId)
            throw new BadRequestException('Not enough arguments');

        const client = await this.clientRepo.findById(clientId);
        if (!client)
            throw new NotFoundException('User not found');

        let campaign: any = await this.campaignRepo.findById(campaignId, { lean: true });
        if (!campaign)
            campaign = await this.completedCampaignRepo.findById(campaignId, { lean: true });

        if (!campaign)
            throw new NotFoundException('Campaign not found');

        const influencerIds = [
            ...new Set(
                campaign.addedAccounts.map(acc => acc.influencerId)
            )
        ];

        const influencers = await this.influencerRepo.findMany(
            { _id: { $in: influencerIds } },
            {
                lean: true,
                select: [
                    '_id',
                    'instagram._id',
                    'instagram.logoUrl',
                    'tiktok._id',
                    'tiktok.logoUrl',
                    'youtube._id',
                    'youtube.logoUrl',
                    'facebook._id',
                    'facebook.logoUrl',
                    'spotify._id',
                    'spotify.logoUrl',
                    'soundcloud._id',
                    'soundcloud.logoUrl',
                    'press._id',
                    'press.logoUrl',
                ]
            }
        );

        const influencerMap = new Map(
            influencers.map(inf => [inf._id.toString(), inf])
        );

        campaign.addedAccounts = campaign.addedAccounts.map(acc => {
            const influencer = influencerMap.get(acc.influencerId.toString());

            if (!influencer) return acc;

            const accountsArray = influencer[acc.socialMedia] ?? [];

            const matchedAccount = accountsArray.find(
                a => a._id?.toString() === acc.accountId?.toString()
            );

            return {
                ...acc,
                logoUrl: matchedAccount?.logoUrl ?? null
            };
        });

        return mapToClientCampaignForTable(campaign);
    }

    // Update ongoing campaign
    async updateOngoingCampaign(data: UpdateCampaignDto, userInfo: UserPayload): Promise<ClientCampaignForTable> {
        const campaignId = data.campaignId;
        const userId = new Types.ObjectId(userInfo._id);
        const userRole = userInfo.role;

        let campaign: HydratedDocument<Campaign>;

        switch (userRole) {
            case Role.client:
                campaign = await this.campaignRepo.findOne({
                    _id: new Types.ObjectId(campaignId),
                    clientId: userId,
                    canEdit: true,
                    statusCampaign: {
                        $in: [
                            CampaignStatusEnum.underReview,
                            CampaignStatusEnum.pending
                        ]
                    }
                });
                break;
            case Role.admin:
                campaign = await this.campaignRepo.findById(campaignId);
                break;
            default:
                throw new ForbiddenException('Not enough access');
        }

        if (!campaign) throw new NotFoundException('Campaign not found');

        // Updating campaignName
        if (data.campaignName && data.campaignName !== campaign.campaignName) {
            campaign.campaignName = data.campaignName.trim();
        }

        // Updating addedAccounts
        if (data.addedAccounts) {
            // 1. Existing accounts Map <accountId, CampaignAccount>
            const existingAccountsMap = new Map<string, CampaignAccount>();
            for (const acc of campaign.addedAccounts) {
                existingAccountsMap.set(acc.accountId.toString(), acc);
            }

            const updatedAccounts: CampaignAccount[] = [];
            const newAccountsDto: SelectInfluencerDto[] = [];

            // 2. Updating existing accounts and collecting new
            for (const accDto of data.addedAccounts) {
                const existingAcc: CampaignAccount = existingAccountsMap.get(accDto.socialAccountId);
                if (existingAcc) {
                    existingAcc.socialMedia = accDto.socialMedia;
                    existingAcc.username = accDto.username;
                    existingAcc.selectedContent.campaignContentItemId = new Types.ObjectId(accDto.selectedCampaignContentItem.campaignContentItemId);
                    existingAcc.selectedContent.descriptionId = new Types.ObjectId(accDto.selectedCampaignContentItem.descriptionId);
                    existingAcc.dateRequest = accDto.dateRequest;
                    updatedAccounts.push(existingAcc);
                } else {
                    newAccountsDto.push(accDto);
                }
            }

            // 3. Building new CampaignAccount objects from new SelectInfluencerDto accounts
            if (newAccountsDto.length > 0) {
                const newAccounts = await this.buildCampaignAccountsBatch(newAccountsDto);
                if (newAccounts.length === 0) {
                    this.logger.warn("Can't proceed new accounts while updating campaign");
                }
                updatedAccounts.push(...newAccounts);
            }

            // 4. Saving all accounts
            campaign.addedAccounts = updatedAccounts;
        }

        // Updating campaign content
        if (data.campaignContent) {
            campaign.campaignContent = data.campaignContent.map((itemDto: CampaignContentItemDto): CampaignContentItem => mapContentItemDtoToModel(itemDto));
            campaign.campaignContent = await this.mediaService.applyMediaCacheForCreate(campaign.campaignContent);
        }

        await campaign.save();

        try {
            return mapToClientCampaignForTable(campaign.toObject() as Campaign);
        } catch (err) {
            this.logger.warn(`Error map ${data.campaignName} to ClientCampaignForTable: ${err}`);
            throw new ConflictException(
                'Campaign updated, but response serialization failed. Please refresh.'
            );
        }
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

    async createBespokeCampaignRequest(data: CreateBespokeCampaignDto, userInfo: UserPayload) {
        const creatorInfo = await this.clientRepo.findById(userInfo._id, {select: ['firstName', 'email']});
        if (!creatorInfo) {
            throw new NotFoundException('Client not found');
        }

        const session = await this.bespokeCampaignRepo.startSession();
        session.startTransaction();

        try {
            await this.bespokeCampaignRepo.create({
                ...data.payload,
                category: data.category,
                userId: new ObjId(userInfo._id),
            }, {session});

            await this.emailService.send(ClientToAdminEmails.bespokeCampaignRequest({
                ...data,
                clientName: creatorInfo.firstName,
                clientEmail: creatorInfo.email
            }))

            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            this.logger.error(`Error while creating bespoke campaign request`, error);
            throw new InternalServerErrorException('Something went wrong')
        } finally {
            await session.endSession();
        }
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

    // Send email about client's request about editting campaign
    async requestCampaignEdit(campaignId: string, clientId: string, message?: string) {
        if (!campaignId || !clientId) {
            throw new BadRequestException('Not enough arguments');
        }

        const client = await this.clientRepo.findOne({_id: new Types.ObjectId(clientId)}, {
            select: ['firstName', 'email'],
            lean: true
        });

        if (!client) {
            throw new NotFoundException(`Client not found`)
        }

        const campaign = await this.campaignRepo.findOne({
            _id: new Types.ObjectId(campaignId),
        }, {
            select: ['campaignName', 'clientId'],
            lean: true
        })

        if (!campaign) {
            throw new NotFoundException(`Campaign not found`);
        }

        if (campaign.clientId.toString() !== clientId) {
            throw new ForbiddenException('You can only edit campaigns you created');
        }

        const dataForEmail: BuildRequestEditTemplateDto = {
            campaignId: campaignId,
            clientId: clientId,
            campaignName: campaign.campaignName,
            clientEmail: client.email,
            clientName: client.firstName,
            message: message,
            acceptLink: `${process.env.SERVER}/campaigns/${campaignId}/request-edit/accept`,
            declineLink: `${process.env.SERVER}/campaigns/${campaignId}/request-edit/decline`
        }

        await this.emailService.send(ClientToAdminEmails.campaignEditRequest(dataForEmail));
    }

    // todo: in future remove to admin module
    // Update admin's response to campaign edit request
    async updateCampaignEditRequest(
        campaignId: string,
        response: string
    ): Promise<void> {
        if (!campaignId || !response) {
            throw new BadRequestException('Not enough arguments');
        }

        const canEdit = response === 'accept';

        const updateResult = await this.campaignRepo.updateOne(
            {_id: new Types.ObjectId(campaignId)},
            {
                $set: {canEdit}
            }
        );

        if (updateResult.matchedCount === 0) {
            throw new NotFoundException('Campaign not found');
        }
    }

    // Stream .csv completed campaign info
    async streamCampaignCsv(campaignId: string, userInfo: UserPayload) {
        const campaign = await this.completedCampaignRepo.findById(campaignId);

        if (!campaign) {
            throw new NotFoundException(`Campaign not found`);
        }

        const isAdmin = userInfo.role === Role.admin;
        const isOwner = String(campaign.clientId) === String(userInfo._id);

        if (!isAdmin && !isOwner) {
            throw new ForbiddenException('Not enough access');
        }

        try {
            return {
                stream: CampaignCsvExporter.buildStream(campaign),
                filename: `${buildSafeFileName(campaign.campaignName, {maxLength: 60, extension: 'csv'})}.csv`,
            };
        } catch (err) {
            this.logger.error(`Error getting .csv for campaign ${campaignId}`, err);
            throw new InternalServerErrorException("Something went wrong");
        }
    }

    // Returns .pdf completed campaign info
    async buildCampaignPdfReport(campaignId: string, userInfo: UserPayload) {
        const campaign = await this.completedCampaignRepo.findById(campaignId);

        if (!campaign) {
            throw new NotFoundException(`Campaign not found`);
        }

        const isAdmin = userInfo.role === Role.admin;
        const isOwner = String(campaign.clientId) === String(userInfo._id);

        if (!isAdmin && !isOwner) {
            throw new ForbiddenException('Not enough access');
        }

        const pdfBuffer = await CampaignPdfExporter.buildPdfBuffer(campaign);

        try {
            return {
                pdfBuffer: pdfBuffer,
                filename: `${buildSafeFileName(campaign.campaignName, {maxLength: 60, extension: 'pdf'})}`,
            };
        } catch (err) {
            this.logger.error(`Error getting .csv for campaign ${campaignId}`, err);
            throw new InternalServerErrorException("Something went wrong");
        }
    }
}