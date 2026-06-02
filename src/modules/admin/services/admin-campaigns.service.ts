import {
    BadRequestException,
    ConflictException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {CampaignRepository} from '../../../database/repositories/campaigns/campaign.repository';
import {WhatsappService} from '../../../integrations/whatsapp/whatsapp.service';
import {SearchQueryDto} from '../../../common/dto/requests/search-query.dto';
import {
    AdminCampaignDetailsDto,
    AdminCampaignSearchResponseDto,
    AdminCampaignsListResponseDto,
    AdminCampaignsListStatusEnum,
    GetAdminCampaignsListQueryDto,
} from '../dto/campaigns/admin-campaigns.dto';
import {
    mapProposalToIAdminCampaignDetails,
    mapSchemaToIAdminCampaignDetails,
    mapToAdminCampaignDetailsDto,
    mapToAdminCampaignForListDto,
} from '../../../common/mappers/campaign.mapper';
import {
    CampaignAdminMetaEnum,
    CampaignConfirmationEnum,
    CampaignStatusEnum,
    IAdminCampaignDetails,
    IAdminCampaignForList,
} from '../../../common/types/client/campaign.types';
import {ProposalCampaignRepository} from '../../../database/repositories/campaigns/proposal-campaign.repository';
import {
    UpdateAdminMetaCampaignDto,
    UpdatedAdminMetaCampaignDto,
} from '../dto/campaigns/admin-update-campaign.dto';
import {CompletedCampaignRepository} from '../../../database/repositories/campaigns/completed-campaign.repository';
import {Campaign, CampaignAccount} from '../../../database/schemas/campaign/campaign.schema';
import {CompletedCampaign} from '../../../database/schemas/campaign/completed-campaign.schema';
import {ProposalCampaign} from '../../../database/schemas/campaign/proposal-campaign.schema';
import {CampaignDetailsService} from '../../campaigns/services/campaign-details.service';
import {AdminUpdateCampaignDto, UpdateCampaignDto} from '../../campaigns/dto/update-campaign.dto';
import {CampaignUpdateService} from '../../campaigns/services/campaign-update.service';
import {ProposalCampaignDetailsService} from '../../proposal-system/services/proposal-campaign-details.service';
import {ProposalCampaignUpdateService} from '../../proposal-system/services/proposal-campaign-update.service';
import {ProposalAccountsBuilderService} from '../../proposal-system/services/proposal-accounts-builder.service';
import {ClientSession, HydratedDocument, PipelineStage, Types} from 'mongoose';
import {CampaignAccountsBuilderService} from '../../campaigns/services/campaign-accounts-builder.service';
import {ObjId} from '../../../common/types/base.types';
import {XlsxImporter} from '../../../common/utils/import/xlsx/xlsx-import';
import {XlsxCampaignDto} from '../dto/campaigns/xlsx-campaign.dto';
import {getSocialMediaGroup} from '../../../common/utils/socialMedia';
import {getArrayFromAccountMusicGenres} from '../../../common/utils/genres';
import {SocialMediaEnum} from '../../../common/types/social-media.types';
import {ProposalCampaignOption} from '../../../database/schemas/campaign/proposal-campaign-option.schema';
import {Role} from '../../../common/types/user.types';
import {InfluencerRepository} from '../../../database/repositories/users/influencer.repository';
import {
    ProposalCampaignOptionRepository
} from '../../../database/repositories/campaigns/proposal-campaign-option.repository';
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum,
} from '../../../common/types/influencer/promo.types';
import {InvoiceStatusEnum} from '../../../common/types/invoice.types';
import {InfluencerActionsHistoryService} from '../../influencer-actions-history/influencer-actions-history.service';
import {PaymentsHistoryService} from '../../payments-history/payments-history.service';
import {AdminToInfluencerEmails} from "../../../integrations/email/email.templates";
import {
    AccountObjectForCreateNewPromoRequestMessage
} from "../../../integrations/email/dto/templates/campaign-email.dto";
import {EmailService} from "../../../integrations/email/email.service";

// Interface for admin campaigns service and controller
export interface IAdminCampaignsService {
    getCampaignsList(data: GetAdminCampaignsListQueryDto): Promise<AdminCampaignsListResponseDto>;

    searchCampaigns(data: SearchQueryDto): Promise<AdminCampaignSearchResponseDto>;

    // Updates admin's meta fields in campaign
    updateMeta(
        payload: UpdateAdminMetaCampaignDto,
        status: AdminCampaignsListStatusEnum,
        campaignId: string,
    ): Promise<UpdatedAdminMetaCampaignDto>;

    deleteCampaign(status: AdminCampaignsListStatusEnum, campaignId: string): Promise<void>;

    getDetailedCampaign(
        status: AdminCampaignsListStatusEnum,
        campaignId: string,
        optionIndex?: number,
    ): Promise<AdminCampaignDetailsDto>;

    // Orchestrator that will define method for updating campaign by campaign status
    updateCampaign(
        status: AdminCampaignsListStatusEnum,
        campaignId: string,
        data: UpdateCampaignDto,
    ): Promise<AdminCampaignDetailsDto>;

    // Closes campaign
    // Moves campaign document from ongoing collection to completed collection
    closeCampaign(campaignId: string): Promise<void>;

    // Reopens campaign
    // Returns from completed collection to ongoing collection
    reopenCampaign(campaignId: string): Promise<void>;

    // Imports xlsx file with campaign and save data as proposal campaign
    importXlsx(file: Express.Multer.File): Promise<void>;

    // Closes influencer's promo and give him money for this campaign (ONGOING CAMPAIGN)
    closePromoAndPay(campaignId: string, promoId: string): Promise<void>;

    // Sends whatsapp message to selected account
    sendWhatsappToOneCampaignAccount(params: {
        influencerId: string;
        message: string;
        sessionId: string;
        clientId?: string;
    }): Promise<{ status: 'sent' }>;

    // Sends whatsapp message to all influencers in campaigns
    sendWhatsappToAllCampaignAccounts(params: {
        campaignId: string;
        message: string;
        sessionId: string;
        clientId?: string;
    }): Promise<{ status: 'sent'; count: number; failedCount: number }>;

    // Sends email with new promo request details
    sendNewPromoRequestEmail(campaignId: string, promoId: string): Promise<void>;
}

@Injectable()
export class AdminCampaignsService implements IAdminCampaignsService {
    constructor(
        private readonly influencersRepository: InfluencerRepository,
        private readonly campaignsRepository: CampaignRepository,
        private readonly completedCampaignsRepository: CompletedCampaignRepository,
        private readonly proposalCampaignRepository: ProposalCampaignRepository,
        private readonly proposalOptionsRepository: ProposalCampaignOptionRepository,
        private readonly campaignDetailsService: CampaignDetailsService,
        private readonly campaignUpdateService: CampaignUpdateService,
        private readonly campaignAccountsBuilderService: CampaignAccountsBuilderService,
        private readonly proposalCampaignDetailsService: ProposalCampaignDetailsService,
        private readonly proposalCampaignUpdateService: ProposalCampaignUpdateService,
        private readonly proposalAccountsBuilderService: ProposalAccountsBuilderService,
        private readonly actionsHistoryService: InfluencerActionsHistoryService,
        private readonly xlsxImporter: XlsxImporter,
        private readonly paymentsHistoryService: PaymentsHistoryService,
        private readonly whatsappService: WhatsappService,
        private readonly emailService: EmailService,
    ) {
    }

    private readonly adminId = new ObjId('650000000000000000000001');
    private readonly logger = new Logger('AdminCampaignsService');

    // Sort and merge ongoing and completed campaigns
    private mergeSortedCampaigns(
        ongoing: IAdminCampaignForList[],
        completed: IAdminCampaignForList[],
        proposal: IAdminCampaignForList[],
    ): IAdminCampaignForList[] {
        const sources = [ongoing, completed, proposal];
        const indexes = [0, 0, 0];
        const result: IAdminCampaignForList[] = [];

        while (true) {
            let bestSourceIndex = -1;
            let bestItem: IAdminCampaignForList | null = null;

            for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
                const itemIndex = indexes[sourceIndex];
                const candidate = sources[sourceIndex][itemIndex];

                if (!candidate) {
                    continue;
                }

                if (!bestItem) {
                    bestItem = candidate;
                    bestSourceIndex = sourceIndex;
                    continue;
                }

                const candidateTime = new Date(candidate.createdAt).getTime();
                const bestTime = new Date(bestItem.createdAt).getTime();

                if (candidateTime > bestTime) {
                    bestItem = candidate;
                    bestSourceIndex = sourceIndex;
                    continue;
                }

                if (candidateTime < bestTime) {
                    continue;
                }

                const candidateId = String(candidate._id);
                const bestId = String(bestItem._id);

                if (candidateId > bestId) {
                    bestItem = candidate;
                    bestSourceIndex = sourceIndex;
                }
            }

            if (bestSourceIndex === -1 || !bestItem) {
                break;
            }

            result.push(bestItem);
            indexes[bestSourceIndex]++;
        }

        return result;
    }

    // Repository orchestrator
    private getRepository = (status: AdminCampaignsListStatusEnum) => {
        switch (status) {
            case AdminCampaignsListStatusEnum.distributing:
            case AdminCampaignsListStatusEnum.pending:
                return this.campaignsRepository;

            case AdminCampaignsListStatusEnum.proposal:
                return this.proposalCampaignRepository;

            case AdminCampaignsListStatusEnum.completed:
                return this.completedCampaignsRepository;

            default:
                throw new BadRequestException(`Unsupported campaign status: ${status}`);
        }
    };

    // Returns detailed proposal campaign for admin
    private async getProposalCampaignDetails(
        campaignId: string,
        optionIndex: number,
    ): Promise<AdminCampaignDetailsDto> {
        return this.proposalCampaignDetailsService.execute(campaignId, optionIndex, {
            findCampaign: (id) => this.proposalCampaignRepository.findById(id, {lean: true}),

            findOption: (campaignId, index) =>
                this.proposalOptionsRepository.findOneByIndex(
                    {campaignId, optionIndex: index},
                    {lean: true},
                ),

            mapResult: (campaign, option) => {
                const readModel = mapProposalToIAdminCampaignDetails(campaign, option);
                return mapToAdminCampaignDetailsDto(readModel);
            },
        });
    }

    // Updates fields in proposal campaign option
    private async updateProposalCampaign(
        campaignId: string,
        optionIndex: number,
        data: AdminUpdateCampaignDto,
    ): Promise<AdminCampaignDetailsDto> {
        if (data.isPriceHidden !== undefined || data.isCpmAndResultHidden !== undefined) {
            throw new BadRequestException(
                "You can't change hidden status for price and cpm in proposal campaign",
            );
        }

        return this.proposalCampaignUpdateService.execute(campaignId, optionIndex, data, {
            findCampaign: (id) => this.proposalCampaignRepository.findById(id) as any,

            findOption: (campaignId, index) =>
                this.proposalOptionsRepository.findOneByIndex({campaignId, optionIndex: index}) as any,

            buildProposalAccountsBatch:
                this.proposalAccountsBuilderService.buildProposalAccountsBatch.bind(
                    this.proposalAccountsBuilderService,
                ),

            toReadModel: (campaign, option): IAdminCampaignDetails =>
                mapProposalToIAdminCampaignDetails(
                    campaign as HydratedDocument<ProposalCampaign>,
                    option as HydratedDocument<ProposalCampaignOption>,
                ),

            mapResult: (readModel: IAdminCampaignDetails): AdminCampaignDetailsDto =>
                mapToAdminCampaignDetailsDto(readModel),
        });
    }

    // Updates fields in ongoing campaign
    private async updateOngoingCampaign(
        campaignId: string,
        data: AdminUpdateCampaignDto,
    ): Promise<AdminCampaignDetailsDto> {
        const session = await this.campaignsRepository.startSession();
        session.startTransaction();

        try {
            const result = await this.campaignUpdateService.execute<
                HydratedDocument<Campaign>,
                CampaignAccount,
                IAdminCampaignDetails,
                AdminCampaignDetailsDto
            >(campaignId, data, {
                findCampaign: (campaignId: string) =>
                    this.campaignsRepository.findOne({_id: new ObjId(campaignId)}),

                buildCampaignAccountsBatch:
                    this.campaignAccountsBuilderService.buildCampaignAccountsBatch.bind(
                        this.campaignAccountsBuilderService,
                    ),

                toReadModel: (campaign: HydratedDocument<Campaign>): IAdminCampaignDetails =>
                    mapSchemaToIAdminCampaignDetails(campaign.toObject() as Campaign),

                mapResult: (readModel: IAdminCampaignDetails): AdminCampaignDetailsDto =>
                    mapToAdminCampaignDetailsDto(readModel),

                session,

                afterSave: async (campaign, sessionArg) => {
                    await this.paymentsHistoryService.rebuildForCampaign(campaignId, 'campaign', sessionArg);
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

    async getCampaignsList(
        data: GetAdminCampaignsListQueryDto,
    ): Promise<AdminCampaignsListResponseDto> {
        const page = data.page ?? 1;
        const limit = data.limit ?? 10;
        const skip = (page - 1) * limit;
        const take = skip + limit;

        let ongoingResult = {items: [], total: 0};
        let completedResult = {items: [], total: 0};
        let proposalResult = {items: [], total: 0};

        if (!data.status) {
            [ongoingResult, completedResult, proposalResult] = await Promise.all([
                this.campaignsRepository.getOngoingCampaignsForAdmin(data, take),
                this.completedCampaignsRepository.getCompletedCampaignsForAdmin(data, take),
                this.proposalCampaignRepository.getProposalCampaignsForAdmin(data, take),
            ]);
        } else if (data.status === AdminCampaignsListStatusEnum.proposal) {
            proposalResult = await this.proposalCampaignRepository.getProposalCampaignsForAdmin(
                data,
                take,
            );
        } else if (data.status === AdminCampaignsListStatusEnum.completed) {
            completedResult = await this.completedCampaignsRepository.getCompletedCampaignsForAdmin(
                data,
                take,
            );
        } else {
            ongoingResult = await this.campaignsRepository.getOngoingCampaignsForAdmin(data, take);
        }

        const merged = this.mergeSortedCampaigns(
            ongoingResult.items,
            completedResult.items,
            proposalResult.items,
        );

        const pagedItems = merged.slice(skip, skip + limit);
        const total = ongoingResult.total + completedResult.total + proposalResult.total;

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            items: pagedItems.map((i) => mapToAdminCampaignForListDto(i)),
        };
    }

    async searchCampaigns(data: SearchQueryDto): Promise<AdminCampaignSearchResponseDto> {
        const limit = data.limit ?? 10;
        const take = limit;

        const [ongoingResult, completedResult, proposalResult] = await Promise.all([
            this.campaignsRepository.getOngoingCampaignsForAdmin(data, take),
            this.completedCampaignsRepository.getCompletedCampaignsForAdmin(data, take),
            this.proposalCampaignRepository.getProposalCampaignsForAdmin(data, take),
        ]);

        const merged = this.mergeSortedCampaigns(
            ongoingResult.items,
            completedResult.items,
            proposalResult.items,
        );

        const items = merged.slice(0, limit);
        const total = ongoingResult.total + completedResult.total + proposalResult.total;

        return {
            total,
            limit,
            items: items.map((i) => mapToAdminCampaignForListDto(i)),
        };
    }

    async updateMeta(
        payload: UpdateAdminMetaCampaignDto,
        status: AdminCampaignsListStatusEnum,
        campaignId: string,
    ): Promise<UpdatedAdminMetaCampaignDto> {
        const entry = Object.entries(payload).find(([, value]) => value !== undefined);

        if (!entry) {
            throw new BadRequestException('No adminMeta field provided');
        }

        const [field, value] = entry;

        if (!Object.values(CampaignAdminMetaEnum).includes(field as CampaignAdminMetaEnum)) {
            throw new BadRequestException('Invalid adminMeta field provided');
        }

        const repository = this.getRepository(status);

        const updatedCampaign: Campaign | CompletedCampaign | ProposalCampaign =
            await repository.updateAdminMetaField(
                campaignId,
                field as CampaignAdminMetaEnum,
                value as string | boolean,
            );

        if (!updatedCampaign) {
            throw new NotFoundException('Campaign not found');
        }

        return {
            campaignId,
            [field]: updatedCampaign.adminMeta?.[field as CampaignAdminMetaEnum],
        } as UpdatedAdminMetaCampaignDto;
    }

    async deleteCampaign(status: AdminCampaignsListStatusEnum, campaignId: string): Promise<void> {
        const repository = this.getRepository(status);

        if (repository instanceof ProposalCampaignRepository) {
            await repository.deleteById(campaignId);
            return;
        }

        const session = await repository.startSession();
        session.startTransaction();

        try {
            // deleting campaign
            await repository.deleteById(campaignId, {session});

            // deleting all payment history cells that are connected to this campaign
            await this.paymentsHistoryService.deleteManyByCampaignId(campaignId, session);

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    }

    async getDetailedCampaign(
        status: AdminCampaignsListStatusEnum,
        campaignId: string,
        optionIndex?: number,
    ): Promise<AdminCampaignDetailsDto> {
        if (status === AdminCampaignsListStatusEnum.proposal && optionIndex !== undefined) {
            return this.getProposalCampaignDetails(campaignId, optionIndex);
        }

        const repository = this.getRepository(status);

        return await this.campaignDetailsService.execute(campaignId, {
            findCampaign: async (campaignId) => await repository.getDetailedCampaignForAdmin(campaignId),
            mapResult: mapToAdminCampaignDetailsDto,
        });
    }

    // Orchestrator that will define method for updating campaign by campaign status
    async updateCampaign(
        status: AdminCampaignsListStatusEnum,
        campaignId: string,
        data: AdminUpdateCampaignDto,
        optionIndex?: number,
    ): Promise<AdminCampaignDetailsDto> {
        switch (status) {
            case AdminCampaignsListStatusEnum.distributing:
            case AdminCampaignsListStatusEnum.pending:
                return this.updateOngoingCampaign(campaignId, data);

            case AdminCampaignsListStatusEnum.proposal:
                if (typeof optionIndex !== 'number')
                    throw new BadRequestException(
                        'For updating proposal campaign, you must provide optionIndex',
                    );
                return this.updateProposalCampaign(campaignId, optionIndex, data);

            case AdminCampaignsListStatusEnum.completed:
                throw new BadRequestException("You can't make general updates for completed campaigns");

            default:
                throw new BadRequestException(`Unsupported campaign status: ${status}`);
        }
    }

    // Closes campaign
    // Moves campaign document from ongoing collection to completed collection
    async closeCampaign(campaignId: string): Promise<void> {
        // Campaign id normalization
        const cId = new ObjId(campaignId);

        // Starting transaction
        const session = await this.campaignsRepository.startSession();
        session.startTransaction();

        try {
            // Deleting campaign from ongoing collection
            let campaign = await this.campaignsRepository.findOneAndDelete({_id: cId}, {session});

            if (!campaign) throw new NotFoundException('Campaign not found');

            // Inserting this campaign in completed collection
            const createdCompletedCampaign = await this.completedCampaignsRepository.create(
                {
                    ...campaign.toObject(),
                    // _id: new ObjId(),
                    statusCampaign: CampaignStatusEnum.completed,
                    addedAccounts: campaign.addedAccounts.map(
                        (acc: CampaignAccount): CampaignAccount => ({
                            ...acc,
                            closePromo: InfluencerPromoClosedStatusEnum.close,
                        }),
                    ),
                    verifyCampaign: CampaignConfirmationEnum.accept,
                },
                {session},
            );

            if (!createdCompletedCampaign)
                throw new Error(`Can't create completed campaign. Ongoing campaign: ${campaignId}`);

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            this.logger.error(`Error while closing campaign - ${campaignId}.`, err);

            if (err instanceof HttpException) throw err;

            throw new InternalServerErrorException('Something went wrong');
        } finally {
            await session.endSession();
        }
    }

    // Reopens campaign
    // Returns from completed collection to ongoing collection
    async reopenCampaign(campaignId: string): Promise<void> {
        // Campaign id normalization
        const cId = new ObjId(campaignId);

        // Starting transaction
        const session = await this.campaignsRepository.startSession();
        session.startTransaction();

        try {
            // Deleting campaign from ongoing collection
            let campaign = await this.completedCampaignsRepository.findOneAndDelete(
                {_id: cId},
                {session},
            );

            if (!campaign) throw new NotFoundException('Campaign not found');

            // Inserting this campaign in completed collection
            const createdCampaign = await this.campaignsRepository.create(
                {
                    ...campaign.toObject(),
                    // _id: new ObjId(),
                    statusCampaign: CampaignStatusEnum.distributing,
                    addedAccounts: campaign.addedAccounts.map(
                        (acc: CampaignAccount): CampaignAccount => ({
                            ...acc,
                            closePromo: InfluencerPromoClosedStatusEnum.wait,
                        }),
                    ),
                    verifyCampaign: CampaignConfirmationEnum.accept,
                },
                {session},
            );

            if (!createdCampaign)
                throw new Error(`Can't create ongoing campaign. Completed campaign: ${campaignId}`);

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            this.logger.error(`Error while reopening campaign - ${campaignId}.`, err);

            if (err instanceof HttpException) throw err;

            throw new InternalServerErrorException('Something went wrong');
        } finally {
            await session.endSession();
        }
    }

    // Imports xlsx file with campaign and save data as proposal campaign
    async importXlsx(file: Express.Multer.File): Promise<void> {
        const data: XlsxCampaignDto = await this.xlsxImporter.importProposalCampaign(file);

        if (!data) {
            throw new InternalServerErrorException('Something went wrong');
        }

        const newCampaignId = new ObjId();
        const newCampaignOptionId = new ObjId();

        const isMultiPromo = !data.socialMedia || data.socialMedia === 'multipromo';

        const socialMediaPlatforms = Object.values(SocialMediaEnum);

        const proposalOption: Partial<ProposalCampaignOption> = {
            _id: newCampaignOptionId,
            proposalCampaignId: newCampaignId,
            creatorId: this.adminId,
            creatorRole: Role.admin,
            publicCampaignPrice: data.price,
            privateCampaignPrice: 0,
            campaignContent: [],
            addedAccounts: [],
        };

        const proposalCampaign: Partial<ProposalCampaign> = {
            _id: newCampaignId,
            creatorId: this.adminId,
            creatorRole: Role.admin,
            campaignName: data.campaignName,
            socialMedia: data.socialMedia || 'multipromo',
            optionsIds: [newCampaignOptionId],
        };

        await Promise.all(
            data.pages.map(async (page) => {
                let influencerId: Types.ObjectId | null = null;

                if (isMultiPromo) {
                    const normalizedUsername = page.username.trim();

                    const aggregationPipeline: PipelineStage[] = [
                        {
                            $facet: socialMediaPlatforms.reduce<Record<string, any[]>>((acc, platform) => {
                                acc[platform] = [
                                    {
                                        $unwind: {
                                            path: `$${platform}`,
                                            preserveNullAndEmptyArrays: false,
                                        },
                                    },
                                    {
                                        $addFields: {
                                            __cleanUsername: {
                                                $toLower: {
                                                    $trim: {
                                                        input: {
                                                            $toString: {
                                                                $ifNull: [`$${platform}.username`, ''],
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                            __cleanFollowers: {
                                                $replaceAll: {
                                                    input: {
                                                        $replaceAll: {
                                                            input: {
                                                                $toString: {
                                                                    $ifNull: [`$${platform}.followers`, ''],
                                                                },
                                                            },
                                                            find: '.',
                                                            replacement: '',
                                                        },
                                                    },
                                                    find: ',',
                                                    replacement: '',
                                                },
                                            },
                                        },
                                    },
                                    {
                                        $addFields: {
                                            __followersNumber: {
                                                $convert: {
                                                    input: '$__cleanFollowers',
                                                    to: 'int',
                                                    onError: null,
                                                    onNull: null,
                                                },
                                            },
                                        },
                                    },
                                    {
                                        $match: {
                                            $expr: {
                                                $eq: [
                                                    '$__cleanUsername',
                                                    normalizedUsername.toLowerCase(),
                                                ],
                                            },
                                        },
                                    },
                                    {
                                        $addFields: {
                                            __followersDiff: {
                                                $cond: [
                                                    {
                                                        $and: [
                                                            { $ne: ['$__followersNumber', null] },
                                                            { $ne: [page.followers, null] },
                                                        ],
                                                    },
                                                    {
                                                        $abs: {
                                                            $subtract: ['$__followersNumber', page.followers],
                                                        },
                                                    },
                                                    null,
                                                ],
                                            },
                                        },
                                    },
                                    {
                                        $sort: {
                                            __followersDiff: 1,
                                        },
                                    },
                                    {
                                        $limit: 1,
                                    },
                                    {
                                        $project: {
                                            influencerId: '$_id',
                                            accountId: `$${platform}._id`,
                                            socialMedia: {
                                                $literal: platform,
                                            },
                                            price: `$${platform}.price`,
                                            publicPrice: `$${platform}.publicPrice`,
                                            dateRequest: {
                                                $literal: data.timeline,
                                            },
                                            followers: `$${platform}.followers`,
                                            countries: `$${platform}.countries`,
                                            musicGenres: `$${platform}.musicGenres`,
                                            followersDiff: '$__followersDiff',
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
                        {
                            $unwind: '$combined',
                        },
                        {
                            $replaceRoot: {
                                newRoot: '$combined',
                            },
                        },
                        {
                            $sort: {
                                followersDiff: 1,
                            },
                        },
                        {
                            $limit: 1,
                        },
                        {
                            $project: {
                                influencerId: 1,
                                accountId: 1,
                                socialMedia: 1,
                                price: 1,
                                publicPrice: 1,
                                dateRequest: 1,
                                followers: 1,
                                countries: 1,
                                musicGenres: 1,
                            },
                        },
                    ];

                    const result = await this.influencersRepository.aggregate(aggregationPipeline).exec();

                    if (result.length > 0) {
                        influencerId = result[0].influencerId
                            ? new Types.ObjectId(result[0].influencerId)
                            : null;
                        let selectedCampaignContentItem: {
                            campaignContentItemId: ObjId;
                            postDescriptionId: ObjId;
                        } | null = null;

                        const existingContentIndex: number = proposalOption.campaignContent.findIndex(
                            (item) =>
                                item.mainLink === page.mainLink &&
                                getSocialMediaGroup(item.socialMedia) ===
                                getSocialMediaGroup(result[0].socialMedia),
                        );

                        if (page.mainLink && existingContentIndex === -1) {
                            const campaignContentItemId = new ObjId();
                            const postDescriptionId = new ObjId();

                            selectedCampaignContentItem = {
                                campaignContentItemId,
                                postDescriptionId,
                            };

                            proposalOption.campaignContent.push({
                                _id: campaignContentItemId,
                                socialMedia: result[0].socialMedia,
                                socialMediaGroup: getSocialMediaGroup(result[0].socialMedia),
                                mainLink: page.mainLink,
                                descriptions: [
                                    {
                                        _id: postDescriptionId,
                                        description: page.description || '',
                                    },
                                ],
                                ...(page.taggedUser?.trim().length > 0
                                    ? {taggedUser: page.taggedUser}
                                    : undefined),
                                ...(page.taggedLink?.trim().length > 0
                                    ? {taggedLink: page.taggedLink}
                                    : undefined),
                                ...(page.additionalBrief?.trim().length > 0
                                    ? {additionalBrief: page.additionalBrief}
                                    : undefined),
                            });
                        } else if (existingContentIndex !== -1) {
                            const existingDescriptionIndex: number = proposalOption.campaignContent[
                                existingContentIndex
                                ].descriptions.findIndex((pd) => pd.description === page.description);

                            if (existingDescriptionIndex === -1) {
                                const postDescriptionId = new ObjId();

                                selectedCampaignContentItem = {
                                    campaignContentItemId: proposalOption.campaignContent[existingContentIndex]._id,
                                    postDescriptionId: postDescriptionId,
                                };

                                proposalOption.campaignContent[existingContentIndex].descriptions.push({
                                    _id: postDescriptionId,
                                    description: page.description || '',
                                });
                            } else {
                                selectedCampaignContentItem = {
                                    campaignContentItemId: proposalOption.campaignContent[existingContentIndex]._id,
                                    postDescriptionId:
                                    proposalOption.campaignContent[existingContentIndex].descriptions[
                                        existingDescriptionIndex
                                        ]._id,
                                };
                            }
                        }

                        const formattedGenres = getArrayFromAccountMusicGenres(result[0]?.musicGenres) ?? [];
                        proposalOption.privateCampaignPrice += result[0].price;

                        proposalOption.addedAccounts.push({
                            ...result[0],
                            _id: new ObjId(),
                            username: normalizedUsername,
                            selectedContent: selectedCampaignContentItem,
                            genres: formattedGenres,
                            followers: result[0].followers,
                        });
                    }
                } else {
                    const platform = data.socialMedia;
                    const normalizedUsername = page.username.trim();

                    const aggregationPipeline = [
                        {$unwind: `$${platform}`},
                        {
                            $match: {
                                $expr: {
                                    $eq: [{$trim: {input: `$${platform}.username`}}, normalizedUsername],
                                },
                            },
                        },
                        {
                            $project: {
                                influencerId: '$_id',
                                accountId: `$${platform}._id`,
                                socialMedia: platform,
                                price: `$${platform}.price`,
                                publicPrice: `$${platform}.publicPrice`,
                                dateRequest: data.timeline,
                                followers: `$${platform}.followers`,
                                countries: `$${platform}.countries`,
                                musicGenres: `$${platform}.musicGenres`,
                            },
                        },
                    ];

                    const result = await this.influencersRepository.aggregate(aggregationPipeline).exec();

                    if (result.length > 0) {
                        influencerId = result[0].influencerId
                            ? new Types.ObjectId(result[0].influencerId)
                            : null;
                        let selectedCampaignContentItem: {
                            campaignContentItemId: ObjId;
                            postDescriptionId: ObjId;
                        } | null = null;

                        const existingContentIndex: number = proposalOption.campaignContent.findIndex(
                            (item) =>
                                item.mainLink === page.mainLink &&
                                getSocialMediaGroup(item.socialMedia) ===
                                getSocialMediaGroup(result[0].socialMedia),
                        );

                        if (page.mainLink && existingContentIndex === -1) {
                            const campaignContentItemId = new ObjId();
                            const postDescriptionId = new ObjId();

                            selectedCampaignContentItem = {
                                campaignContentItemId,
                                postDescriptionId,
                            };

                            proposalOption.campaignContent.push({
                                _id: campaignContentItemId,
                                socialMedia: result[0].socialMedia,
                                socialMediaGroup: getSocialMediaGroup(result[0].socialMedia),
                                mainLink: page.mainLink,
                                descriptions: [
                                    {
                                        _id: postDescriptionId,
                                        description: page.description || '',
                                    },
                                ],
                                ...(page.taggedUser?.trim().length > 0
                                    ? {taggedUser: page.taggedUser}
                                    : undefined),
                                ...(page.taggedLink?.trim().length > 0
                                    ? {taggedLink: page.taggedLink}
                                    : undefined),
                                ...(page.additionalBrief?.trim().length > 0
                                    ? {additionalBrief: page.additionalBrief}
                                    : undefined),
                            });
                        } else if (existingContentIndex !== -1) {
                            const existingDescriptionIndex: number = proposalOption.campaignContent[
                                existingContentIndex
                                ].descriptions.findIndex((pd) => pd.description === page.description);

                            if (existingDescriptionIndex === -1) {
                                const postDescriptionId = new ObjId();

                                selectedCampaignContentItem = {
                                    campaignContentItemId: proposalOption.campaignContent[existingContentIndex]._id,
                                    postDescriptionId: postDescriptionId,
                                };

                                proposalOption.campaignContent[existingContentIndex].descriptions.push({
                                    _id: postDescriptionId,
                                    description: page.description || '',
                                });
                            } else {
                                selectedCampaignContentItem = {
                                    campaignContentItemId: proposalOption.campaignContent[existingContentIndex]._id,
                                    postDescriptionId:
                                    proposalOption.campaignContent[existingContentIndex].descriptions[
                                        existingDescriptionIndex
                                        ]._id,
                                };
                            }
                        }

                        const formattedGenres = getArrayFromAccountMusicGenres(result[0]?.musicGenres) ?? [];
                        proposalOption.privateCampaignPrice += result[0].price;

                        proposalOption.addedAccounts.push({
                            ...result[0],
                            _id: new ObjId(),
                            username: normalizedUsername,
                            selectedContent: selectedCampaignContentItem,
                            genres: formattedGenres,
                            followers: result[0].followers,
                        });
                    }
                }

                if (!influencerId) {
                    console.warn(
                        `(SAVING XLSX CAMPAIGN) No social media account found for username: ${page.username} with ${page.followers} followers`,
                    );
                }
            }),
        );

        proposalCampaign.campaignName =
            proposalCampaign.campaignName || `Date: ${new Date().toISOString().split('T')[0]}`;

        const session: ClientSession = await this.proposalCampaignRepository.startSession();
        session.startTransaction();

        try {
            await this.proposalCampaignRepository.create(proposalCampaign, {session});
            await this.proposalOptionsRepository.create(proposalOption, {session});

            await session.commitTransaction();
        } catch (e) {
            this.logger.error(`Error importing ${proposalCampaign.campaignName} as proposal:`, e);
            await session.abortTransaction();
            throw new InternalServerErrorException(
                `Campaign was built, but something went wrong on the database side.`,
            );
        } finally {
            await session.endSession();
        }
    }

    async sendWhatsappToOneCampaignAccount(params: {
        influencerId: string;
        message: string;
        sessionId: string;
        clientId?: string;
    }): Promise<{ status: 'sent' }> {
        const {influencerId, message, sessionId, clientId} = params;

        const influencer = await this.influencersRepository.findById(influencerId, {
            select: ['phone'],
        });
        if (!influencer) throw new NotFoundException('Influencer not found');
        if (!influencer.phone) throw new BadRequestException('Influencer has no phone number');

        return this.whatsappService.sendMessage({
            phone: influencer.phone,
            message,
            sessionId,
            clientId,
        });
    }

    async sendWhatsappToAllCampaignAccounts(params: {
        campaignId: string;
        message: string;
        sessionId: string;
        clientId?: string;
    }): Promise<{ status: 'sent'; count: number; failedCount: number }> {
        const {campaignId, message, sessionId, clientId} = params;

        const campaign = await this.campaignsRepository.findById(campaignId, {
            select: ['addedAccounts'],
        });
        if (!campaign) throw new NotFoundException('Campaign not found');

        const accounts = campaign.addedAccounts ?? [];
        if (accounts.length === 0) throw new BadRequestException('Campaign has no accounts');

        const uniqueInfluencerIds = [...new Set(accounts.map((a) => a.influencerId.toString()))].map(
            (id) => new ObjId(id),
        );

        const influencers = await this.influencersRepository.findMany(
            {_id: {$in: uniqueInfluencerIds}},
            {select: ['phone']},
        );

        const phoneMap = new Map(influencers.map((inf) => [inf['_id'].toString(), inf.phone]));

        const recipients = accounts
            .map((account) => ({
                phone: phoneMap.get(account.influencerId.toString()),
                meta: {
                    accountId: account.accountId?.toString(),
                    socialMedia: account.socialMedia,
                    username: account.username,
                },
            }))
            .filter((r) => !!r.phone) as { phone: string; meta: Record<string, unknown> }[];

        return this.whatsappService.sendMessages({recipients, message, sessionId, clientId});
    }

    // Closes influencer's promo and give him money for this campaign
    async closePromoAndPay(campaignId: string, promoId: string): Promise<void> {
        // Getting campaign
        const campaign = await this.campaignsRepository.findById(campaignId);
        if (!campaign) throw new NotFoundException('Campaign not found');

        // Finding needed promo in this campaign
        const promo: CampaignAccount = campaign.addedAccounts.find(
            (i) => i._id?.toString() === promoId,
        );
        if (!promo) throw new NotFoundException('Promo not found');

        // Checking if promo was already closed
        if (promo.closePromo === InfluencerPromoClosedStatusEnum.close)
            throw new ConflictException('Promo already closed');

        const session = await this.campaignsRepository.startSession();
        // Starting transaction
        session.startTransaction();

        try {
            // Updating closePromo and confirmation in promo
            await this.campaignsRepository.findOneAndUpdate(
                {
                    _id: new ObjId(campaignId),
                    'addedAccounts._id': new ObjId(promoId),
                },
                {
                    $set: {
                        'addedAccounts.$.closePromo': InfluencerPromoClosedStatusEnum.close,
                        'addedAccounts.$.confirmation': InfluencerConfirmationStatusEnum.accept,
                        'addedAccounts.$.invoiceStatus': InvoiceStatusEnum.wait,
                    },
                },
                {session},
            );

            // Updating influencer's balance
            await this.influencersRepository.findOneAndUpdate(
                {_id: promo.influencerId},
                {
                    $inc: {
                        balance: promo.price,
                    },
                },
                {session},
            );

            // Saving new campaign action (2 - insights submitted) to influencer's history
            await this.actionsHistoryService.upsertInfluencerCampaignActionsHistory(
                {
                    influencerId: promo.influencerId.toString(),
                    campaignId: campaignId,
                    campaignName: campaign.campaignName,
                    updatedCampaignAction: {
                        addedAccountsId: promo._id,
                        socialAccountId: promo.accountId,
                        actionNumber: 2,
                        networkUsername: promo.username,
                        rewardForInfluencer: promo.price,
                        socialMedia: promo.socialMedia,
                    },
                },
                session,
            );

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw new InternalServerErrorException('Something went wrong while closing promo');
        } finally {
            await session.endSession();
        }
    }

    async sendNewPromoRequestEmail(campaignId: string, promoId: string): Promise<void> {
        if (!campaignId || !promoId) {
            throw new BadRequestException("Not enough arguments");
        }

        const campaign = await this.campaignsRepository.findById(campaignId);

        if (!campaign) {
            throw new NotFoundException("Campaign not found");
        }

        const promo = campaign.addedAccounts.find((i) => i._id?.toString() === promoId);

        if (!promo) {
            throw new NotFoundException("Promo not found");
        }

        const influencer = await this.influencersRepository.findById(promo.influencerId.toString());

        if (!influencer) {
            throw new NotFoundException("Influencer not found");
        }

        const content = campaign.campaignContent.find(
            (c) => c._id.toString() === promo.selectedContent?.campaignContentItemId.toString(),
        );

        if (!content) {
            this.logger.error(`Can't find content for campaign's (${campaignId}) promo ${promoId}`);
            throw new InternalServerErrorException("Something went wrong");
        }

        const accountDetails: AccountObjectForCreateNewPromoRequestMessage = {
            pageName: promo.username,
            reward: `${promo.price}€`,
            socialMedia: promo.socialMedia,
            mainLink: content?.mainLink || '',
            description:
                content?.descriptions.find(
                    (pd) => pd._id.toString() === promo.selectedContent?.descriptionId.toString(),
                )?.description || '',
            taggedUser: content?.taggedUser,
            taggedLink: content?.taggedLink,
            additionalBrief: content?.additionalBrief,
        } satisfies AccountObjectForCreateNewPromoRequestMessage;

        if (!accountDetails) {
            this.logger.error(`Can't build AccountObjectForCreateNewPromoRequestMessage obj for sending ${campaignId} campaign new ${promoId} promoId`);
            throw new InternalServerErrorException("Something went wrong");
        }

        await this.emailService.send(
            AdminToInfluencerEmails.newPromoRequest({
                firstName: influencer.firstName,
                email: influencer.email,
                accountsAndDetails: [accountDetails],
            }),
        );
    }
}
