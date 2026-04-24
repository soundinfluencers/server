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
    ICampaignDetails, IDashboardCampaign,
    IPublicCampaignForTable
} from "../../../common/types/client/campaign.types";
import {SocialMediaEnum, SocialMediaType} from "../../../common/types/social-media.types";
import {formatClientCampaignStatus, formatDate} from "../../../common/utils/formatters";
import {
    CampaignContentItemDto,
    CreateCampaignDto,
    SaveDraftCampaignDto,
    SelectInfluencerDto
} from "../dto/create-campaign.dto";
import {XlsxCampaignDto} from "../../admin/dto/campaigns/xlsx-campaign.dto";
import {CreateBespokeCampaignDto} from "../dto/bespoke-request.dto";
import axios from "axios";
import {getSocialMediaGroup} from "../../../common/utils/socialMedia";
import {returnMusicStyles} from "../../../common/utils/genres";
import {
    DashboardCampaignDto,
    ClientGetDashboardCampaignsQueryDto,
    DetailedDraftCampaignDto, CampaignDetailsDto
} from "../dto/get-campaigns.dto";
import {CampaignRepository} from "../../../database/repositories/campaigns/campaign.repository";
import {CompletedCampaignRepository} from "../../../database/repositories/campaigns/completed-campaign.repository";
import {ClientRepository} from "../../../database/repositories/users/client.repository";
import {ProposalCampaignRepository} from "../../../database/repositories/campaigns/proposal-campaign.repository";
import {InfluencerRepository} from "../../../database/repositories/users/influencer.repository";
import {
    Campaign,
    CampaignAccount,
    CampaignContentItem,
} from "../../../database/schemas/campaign/campaign.schema";
import {Client} from "../../../database/schemas/users/client.schema";
import {InfluencerActionsHistoryService} from "../../influencer-actions-history/influencer-actions-history.service";
import {DraftCampaignRepository} from "../../../database/repositories/campaigns/draft-campaign.repository";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../../../common/types/influencer/promo.types";
import {EmailService} from "../../../integrations/email/email.service";
import {AccountVerifiedStatus, Role, UserPayload} from "../../../common/types/user.types";
import {UpdateCampaignDto} from "../dto/update-campaign.dto";
import {
    mapContentItemDtoToModel,
    mapSchemaToICampaignDetails,
    mapToCampaignDetailsDto
} from "../../../common/mappers/campaign.mapper";
import {buildSafeFileName, uniq} from "../../../common/utils/base.util";
import {ObjId, toObjIdSafe} from "../../../common/types/base.types";
import {
    AccountObjectForCreateNewPromoRequestMessage,
    BuildRequestEditTemplateDto
} from "../../../integrations/email/dto/templates/campaign-email.dto";
import {BespokeCampaignRepository} from "../../../database/repositories/campaigns/bespoke-campaign.repository";
import {CampaignCsvExporter} from "../../../common/utils/export/csv/campaign-csv.exporter";
import {CampaignPdfExporter} from "../../../common/utils/export/pdf/campaign-pdf.exporter";
import {MediaService} from "../../media/media.service";
import {InvoiceService} from "../../invoice/invoice.service";
import {
    AdminToClientEmails,
    AdminToInfluencerEmails,
    ClientToAdminEmails
} from "../../../integrations/email/email.templates";
import {CampaignUpdateService} from "./campaign-update.service";
import {CampaignDetailsService} from "./campaign-details.service";
import {CampaignAccountsBuilderService} from "./campaign-accounts-builder.service";
import {PaymentsHistoryService} from "../../payments-history/payments-history.service";

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
        private readonly campaignDetailsService: CampaignDetailsService,
        private readonly campaignUpdateService: CampaignUpdateService,
        private readonly campaignAccountsBuilderService: CampaignAccountsBuilderService,
        private readonly paymentsHistoryService: PaymentsHistoryService,
    ) {
    }

    // Returns campaigns list for client with diff statuses
    async getCampaignsList(data: ClientGetDashboardCampaignsQueryDto): Promise<DashboardCampaignDto[]> {
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
                campaigns = await this.draftCampaignRepo.getDashboardCampaigns(
                    data.clientId,
                    limit,
                    skip,
                )
                break;
            case "under_review":
                campaigns = await this.campaignRepo.getDashboardCampaigns(
                    data.clientId,
                    limit,
                    skip,
                    [CampaignStatusEnum.underReview],
                    CampaignConfirmationEnum.wait,
                ) satisfies IDashboardCampaign[];
                break;
            case "distributing":
                campaigns = await this.campaignRepo.getDashboardCampaigns(
                    data.clientId,
                    limit,
                    skip,
                    [CampaignStatusEnum.pending, CampaignStatusEnum.distributing],
                    CampaignConfirmationEnum.accept,
                ) satisfies IDashboardCampaign[];
                break;
            case "closed":
                campaigns = await this.completedCampaignRepo.getDashboardCampaigns(data.clientId, limit, skip);
                break;
            case "proposal":
                campaigns = await this.proposalCampaignRepo.getDashboardCampaigns(
                    data.clientId,
                    limit,
                    skip,
                )
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

                    {
                        $unionWith: {
                            coll: 'draftcampaigns',
                            pipeline: [
                                {$match: {$or: [{creatorId: oid}, {clientId: oid}]}},
                                {
                                    $addFields: {
                                        clientStatus: 'draft',
                                    },
                                },
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
                            latestStep: 1,
                        },
                    },
                ]).exec();
                break;
            default:
                throw new BadRequestException("Bad request. Not enough arguments (missing campaign status)");
        }

        return campaigns.map((item): DashboardCampaignDto => ({
            _id: item._id.toString(),
            campaignName: item.campaignName,
            socialMedia: item.socialMedia as SocialMediaType,
            creationDate: formatDate(item.createdAt),
            price: item.campaignPrice ?? item.publicPrice ?? item.price ?? undefined,
            status: item.clientStatus ?? formatClientCampaignStatus(item.statusCampaign),
            ...item.latestStep ? {draftStep: item.latestStep} : undefined,
        }));
    }

    // Creates new campaign (NOT DRAFT)
    async createCampaign(data: CreateCampaignDto): Promise<void> {
        if (!data || !data.paymentDetails) throw new BadRequestException('Not enough arguments')

        const createdAt = new Date();

        const processedAccounts: CampaignAccount[] =
            await this.campaignAccountsBuilderService.buildCampaignAccountsBatch(data.addedAccounts);

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

        // for invoice
        const campaignTotalFollowers = processedAccounts.reduce((sum, account) => {
            const followers =
                typeof account.followers === 'number' && Number.isFinite(account.followers)
                    ? account.followers
                    : 0;

            return sum + followers;
        }, 0);

        const campaignId: ObjId = new ObjId();
        try {
            // Saving new campaign
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

            // Saving payment history projections for all of campaign's accounts
            await this.paymentsHistoryService.rebuildForCampaign(
                campaignId.toString(),
                'campaign',
                session
            );

            // Getting client data
            client = await this.clientRepo.findById(data.clientId, {session});

            data.paymentDetails.userId = data.clientId;
            data.paymentDetails.userRole = Role.client;
            data.paymentDetails.campaignId = campaignId.toString();
            data.paymentDetails.campaignName = data.campaignName.trim();
            data.paymentDetails.campaignFollowers = campaignTotalFollowers;
            data.paymentDetails.company = client.company;

            // Create and send invoice to client
            await this.invoiceService.createClientCampaignInvoice(data.paymentDetails, session);

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
    async getDraftCampaign(draftId: string, clientId: string): Promise<DetailedDraftCampaignDto> {
        if (!draftId || !ObjId.isValid(draftId)) {
            throw new BadRequestException('Invalid draftId');
        }

        if (!clientId || !ObjId.isValid(clientId)) {
            throw new BadRequestException('Invalid clientId');
        }

        const draft = await this.draftCampaignRepo.getDetailedDraftCampaign(draftId, clientId);

        if (!draft) {
            throw new NotFoundException('Draft not found');
        }

        return draft;
    }

    // Save campaign draft
    async createDraftCampaign(data: SaveDraftCampaignDto): Promise<void> {
        await this.draftCampaignRepo.saveDraftCampaign(data);
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
        if (!campaignId || !status) throw new BadRequestException('Not enough arguments');

        const checkCampaign: Campaign = await this.campaignRepo.findById(campaignId, {lean: true});
        if (!checkCampaign) throw new NotFoundException('Campaign not found');

        const clientInfo = await this.clientRepo.findById(checkCampaign.clientId.toString(), {select: ['firstName', 'email']});
        if (!clientInfo) throw new NotFoundException('Client not found');

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

            await this.campaignRepo.updateOne({_id: new ObjId(campaignId)}, {
                verifyCampaign: CampaignConfirmationEnum.accept,
                statusCampaign: CampaignStatusEnum.pending
            });


            try {
                await this.emailService.send(AdminToClientEmails.approvedCampaign(
                    clientInfo.email,
                    {
                        firstName: clientInfo.firstName ?? clientInfo.email
                    }
                ))
            } catch (err) {
                this.logger.error(`Campaign ${checkCampaign.campaignName} declined, but email failed`, err);
            }

            return {
                code: 200,
                message: 'Campaign verified',
            };
        } else {
            await this.campaignRepo.updateOne({_id: new ObjId(campaignId)}, {
                verifyCampaign: CampaignConfirmationEnum.decline,
                statusCampaign: CampaignStatusEnum.declined
            });

            try {
                await this.emailService.send(AdminToClientEmails.declinedCampaign(
                    clientInfo.email,
                    {
                        firstName: clientInfo.firstName ?? clientInfo.email
                    }
                ))
            } catch (err) {
                this.logger.error(`Campaign ${checkCampaign.campaignName} declined, but email failed`, err);
            }

            return {
                code: 200,
                message: 'Campaign declined',
            };
        }
    }

    // Returns one detailed campaign obj - used by campaign report page
    async getClientOngoingOrPastCampaign(
        campaignId: string,
        clientId: string,
    ): Promise<CampaignDetailsDto> {
        const client = await this.clientRepo.findById(clientId);
        if (!client) {
            throw new NotFoundException('User not found');
        }

        return this.campaignDetailsService.execute(campaignId, {
            findCampaign: async (campaignId) => {
                return (
                    await this.campaignRepo.getDetailedCampaign(clientId, campaignId)
                ) ?? (
                    await this.completedCampaignRepo.getDetailedCampaign(clientId, campaignId)
                );
            },
            mapResult: mapToCampaignDetailsDto,
        });
    }

    // Update ongoing campaign
    async updateOngoingCampaign(
        data: UpdateCampaignDto,
        userInfo: UserPayload,
    ): Promise<CampaignDetailsDto> {
        const userId = new Types.ObjectId(userInfo._id);
        const session = await this.campaignRepo.startSession();
        session.startTransaction();

        try {
            const result = await this.campaignUpdateService.execute<
                HydratedDocument<Campaign>,
                CampaignAccount,
                ICampaignDetails,
                CampaignDetailsDto
            >(data.campaignId, data, {
                findCampaign: (campaignId: string) =>
                    this.campaignRepo.findOne({
                        _id: new Types.ObjectId(campaignId),
                        clientId: userId,
                        canEdit: true,
                        statusCampaign: CampaignStatusEnum.pending,
                    }),

                buildCampaignAccountsBatch:
                    this.campaignAccountsBuilderService.buildCampaignAccountsBatch.bind(
                        this.campaignAccountsBuilderService,
                    ),

                toReadModel: (campaign: HydratedDocument<Campaign>): ICampaignDetails =>
                    mapSchemaToICampaignDetails(campaign.toObject() as Campaign),

                mapResult: (readModel: ICampaignDetails): CampaignDetailsDto =>
                    mapToCampaignDetailsDto(readModel),

                session,

                afterSave: async (campaign, sessionArg) => {
                    await this.paymentsHistoryService.rebuildForCampaign(
                        data.campaignId,
                        'campaign',
                        sessionArg,
                    );
                },
            });

            await session.commitTransaction();
            return result;
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
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
    async getCampaignByPublicShareLink(campaignId: string): Promise<IPublicCampaignForTable> {
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