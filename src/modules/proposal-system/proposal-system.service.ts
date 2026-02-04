import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException
} from '@nestjs/common';
import mongoose, {Types} from 'mongoose';
import {ProposalCampaignRepository} from "../../database/repositories/campaigns/proposal-campaign.repository";
import {ProposalCampaignsListItem} from "./types/proposal-system.types";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {AdminRepository} from "../../database/repositories/users/admin.repository";
import {CampaignContentItemDto, CreateCampaignDto, SelectInfluencerDto} from "../campaigns/dto/create-campaign.dto";
import {Role} from "../../common/types/auth.types";
import {ProposalCampaign} from "../../database/schemas/campaign/proposal-campaign.schema";
import {CampaignContentItem} from "../../database/schemas/campaign/campaign.schema";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../../common/types/influencer/promo.types";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {getArrayFromAccountMusicGenres} from "../../common/utils/genres";
import {
    CreatedProposalCampaignIdDto,
    GetProposalCampaignQueryDto, ProposalCampaignWithOptionDto,
    UpdateProposalCampaignDto
} from "./dto/proposal-campaigns.dto";
import {
    ProposalCampaignOptionRepository
} from "../../database/repositories/campaigns/proposal-campaign-option.repository";
import {
    ProposalCampaignAccount,
    ProposalCampaignOption
} from "../../database/schemas/campaign/proposal-campaign-option.schema";

@Injectable()
export class ProposalSystemService {
    private readonly logger = new Logger();

    constructor(
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
        private readonly adminRepo: AdminRepository,
        private readonly proposalCampaignRepo: ProposalCampaignRepository,
        private readonly proposalCampaignOptionRepo: ProposalCampaignOptionRepository,
    ) {
    }

    // Create new proposal campaign
    async createProposalCampaign(data: CreateCampaignDto, creatorInfo: {creatorId: string, creatorRole: Role}): Promise<CreatedProposalCampaignIdDto> {
        const {creatorId, creatorRole} = creatorInfo;

        if (!creatorId || !creatorRole) throw new BadRequestException("Not enough arguments");

        // check if creator exists
        switch (creatorRole) {
            case 'admin': {
                const exists = await this.adminRepo.findById(creatorId);
                if (!exists) throw new NotFoundException('Admin not found');
                break;
            }
            case 'client': {
                const exists = await this.clientRepo.exists({
                    _id: new Types.ObjectId(creatorId),
                    isProposalClient: true
                });

                if (!exists) throw new NotFoundException('Client not found');
                break;
            }
            default:
                throw new ForbiddenException('Not enough access');
        }

        // Price that only we can see. Users will see public price
        let privateCampaignPrice = 0;

        // processing added accounts for proposal campaign
        const processedAccounts: ProposalCampaignAccount[] = await Promise.all(
            data.addedAccounts.map(async (account: SelectInfluencerDto): Promise<ProposalCampaignAccount> => {
                const dateRequest = account.dateRequest;

                // find account's owner
                const influencerData = await this.influencerRepo
                    .findOne({
                        $or: [
                            {
                                [`${account.socialMedia}._id`]: new mongoose.Types.ObjectId(
                                    account.socialAccountId,
                                )
                            },
                            {
                                _id: new Types.ObjectId(account.influencerId)
                            },
                            {
                                [`${account.socialMedia}.username`]: account.username
                            }
                        ]
                    }, {lean: true});

                if (!influencerData) {
                    this.logger.log(
                        `Did not find any influencer with influencerId: ${account.influencerId} or social accountId: ${account.socialAccountId} while creating proposal campaign ${data.campaignName}`,
                    )
                    return null;
                }

                const influencerId = influencerData._id.toString();

                const socialMediaAccount = influencerData[account.socialMedia].find(
                    (account) =>
                        account.username === account.username
                );

                if (socialMediaAccount) {
                    privateCampaignPrice += socialMediaAccount.price;

                    return {
                        ...account,
                        _id: new mongoose.Types.ObjectId(),
                        username: socialMediaAccount.username,
                        influencerId: new Types.ObjectId(influencerId),
                        accountId: new Types.ObjectId(account.socialAccountId),
                        followers: socialMediaAccount.followers,
                        price: socialMediaAccount.price,
                        publicPrice: socialMediaAccount.publicPrice,
                        selectedContent: {
                            campaignContentItemId: new Types.ObjectId(
                                account.selectedCampaignContentItem.campaignContentItemId,
                            ),
                            descriptionId: new Types.ObjectId(
                                account.selectedCampaignContentItem.descriptionId,
                            ),
                        },
                        confirmation: InfluencerConfirmationStatusEnum.wait,
                        closePromo: InfluencerPromoClosedStatusEnum.wait,
                        countries: socialMediaAccount.countries ?? undefined,
                        genres: socialMediaAccount.musicGenres ? getArrayFromAccountMusicGenres(socialMediaAccount.musicGenres) : undefined,
                        createdAt: new Date(),
                        dateRequest,
                    } satisfies ProposalCampaignAccount;
                }

                return null
            }).filter(Boolean),
        );

        // processing campaign content items
        const processedCampaignContent: CampaignContentItem[] = await Promise.all(
            data.campaignContent.map(async (campaignContentItem: CampaignContentItemDto): Promise<CampaignContentItem> => ({
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

        const campaignId = new Types.ObjectId();
        const campaignOptionId = new Types.ObjectId();

        // building campaign with ProposalCampaign type
        const proposalCampaignDto: ProposalCampaign = {
            _id: campaignId,
            schemaVersion: 2,
            creatorId: new Types.ObjectId(creatorId),
            creatorRole: creatorRole,
            socialMedia: data.socialMedia,
            campaignName: data.campaignName.trim(),
            optionsIds: [campaignOptionId]
        }

        // building campaign option with ProposalCampaign type
        const proposalCampaignOptionDto: ProposalCampaignOption = {
            _id: campaignOptionId,
            proposalCampaignId: campaignId,
            schemaVersion: 1,
            publicCampaignPrice: data.campaignPrice,
            privateCampaignPrice: data.campaignPrice,
            addedAccounts: processedAccounts,
            campaignContent: processedCampaignContent,
        }

        const session = await this.proposalCampaignRepo.startSession();
        session.startTransaction();

        try {
            await this.proposalCampaignRepo.create<ProposalCampaign>(proposalCampaignDto, {session});
            await this.proposalCampaignOptionRepo.create<ProposalCampaignOption>(proposalCampaignOptionDto, {session});

            await session.commitTransaction();

            return {campaignId: campaignId.toString()};
        } catch (err) {
            await session.abortTransaction();
            throw new InternalServerErrorException('Error creating proposal campaign');
        } finally {
            await session.endSession();
        }
    }

    // Update proposal campaign
    async updateProposalCampaign(data: UpdateProposalCampaignDto) {
        if (!data.campaignName) throw new BadRequestException("Not enough arguments");

        let proposalCampaign = await this.proposalCampaignRepo.findOne({
            _id: new Types.ObjectId(data.campaignId),
        });

        if (!proposalCampaign) {
            throw new NotFoundException('Campaign not found');
        } else {
            await this.proposalCampaignRepo.updateOne(
                {
                    _id: new Types.ObjectId(data.campaignId),
                },
                {
                    clientId: data.clientId
                        ? new Types.ObjectId(data.clientId)
                        : new Types.ObjectId('66f540faaf4e960d2f9bebfc'),
                    campaignName: data.campaignName.trim(),
                    addedAccounts: data.addedAccounts.map(account => ({
                        ...account,
                        selectedContent: {
                            campaignContentItemId: new Types.ObjectId(account.selectedContent.campaignContentItemId),
                            postDescriptionId: new Types.ObjectId(account.selectedContent.postDescriptionId)
                        }
                    })),
                    campaignContent: data.campaignContent,
                    price: data.price,
                    publicPrice: data.publicPrice,
                    totalFollowers: data.totalFollowers,
                    socialMedia: data.socialMedia,
                    hiddenColumns: data.hiddenColumns,
                },
            );
        }
    }

    // Returns one proposal campaign (with 1 selected option)
    async getProposalCampaign(data: GetProposalCampaignQueryDto): Promise<ProposalCampaignWithOptionDto> {
        const {userId, userRole, campaignId} = data;
        const optionNumber = data.optionNumber ?? 1;

        if (!campaignId) throw new BadRequestException("Invalid campaign id");
        let proposalCampaign: ProposalCampaign;

        switch (userRole) {
            case Role.client:
                proposalCampaign:
                break;
        }

        return undefined;
    }

    // TODO: finish
    async getAllProposalCampaigns(limit: number, page: number): Promise<ProposalCampaignsListItem[]> {
        limit = Number(limit ?? 12);
        page = Number(page ?? 1);

        if (!Number.isInteger(limit) || limit <= 0) {
            throw new BadRequestException('Invalid limit');
        }

        if (!Number.isInteger(page) || page <= 0) {
            throw new BadRequestException('Invalid page');
        }

        return [];
    };

    // async getProposalCampaignById(campaignId: string): Promise<any> {
    //     if (!campaignId) {
    //         return {
    //             status: 400,
    //             message: 'Campaign ID is required',
    //         };
    //     }
    //
    //     try {
    //         const proposalCampaign = await this.proposalCampaignModel
    //             .findOne({
    //                 _id: new mongoose.Types.ObjectId(campaignId),
    //             })
    //             .lean()
    //             .exec();
    //
    //         if (!proposalCampaign) {
    //             return {
    //                 status: 404,
    //                 message: 'Proposal campaign not found',
    //             };
    //         }
    //
    //         let client = null;
    //         try {
    //             client = await this.clientModel.findOne({
    //                 _id: proposalCampaign.clientId,
    //             });
    //         } catch (err) {
    //             console.error('Error fetching client:', err);
    //         }
    //
    //         const processedSelectInfluencers = proposalCampaign.selectInfluencers?.length
    //             ? await Promise.all(
    //                 proposalCampaign.selectInfluencers.map((acc) => {
    //                     const selectedCampaignContentItem = proposalCampaign.campaignContent.find(c =>
    //                         c._id.toString() === acc.selectedContent.campaignContentItemId.toString()
    //                     );
    //
    //                     let selectedCampaignContent: any = null;
    //
    //                     if (selectedCampaignContentItem) {
    //                         const postDesc =
    //                             selectedCampaignContentItem.postDescriptions.find(
    //                                 i => i._id.toString() === acc.selectedContent.postDescriptionId?.toString()
    //                             )?.description ?? "";
    //
    //                         selectedCampaignContent = {
    //                             _id: selectedCampaignContentItem._id,
    //                             videoLink: selectedCampaignContentItem.videoLink,
    //                             postDescription: postDesc,
    //                             storyTag: selectedCampaignContentItem.storyTag,
    //                             storyLink: selectedCampaignContentItem.swipeUpLink,
    //                             specialRequests: selectedCampaignContentItem.specialWishes,
    //                             socialMedia: selectedCampaignContentItem.socialMedia,
    //                         };
    //                     }
    //
    //                     return {
    //                         ...acc,
    //                         selectedCampaignContentItem: selectedCampaignContent,
    //                     };
    //                 }),
    //             )
    //             : [];
    //
    //         const sortedInfluencers =
    //             processedSelectInfluencers.length > 0 &&
    //             processedSelectInfluencers.filter(influencer => influencer.selectedContent).sort((a, b) => {
    //                 const aContentId = a.selectedContent;
    //                 const bContentId = b.selectedContent;
    //
    //                 const aIndex = proposalCampaign.campaignContent
    //                     ? proposalCampaign.campaignContent.findIndex(
    //                         (content) => content._id.toString() === aContentId.campaignContentItemId.toString(),
    //                     )
    //                     : -1;
    //
    //                 const bIndex = proposalCampaign.campaignContent
    //                     ? proposalCampaign.campaignContent.findIndex(
    //                         (content) => content._id.toString() === bContentId.campaignContentItemId.toString(),
    //                     )
    //                     : -1;
    //
    //                 return aIndex - bIndex;
    //             });
    //
    //         return {
    //             status: 200,
    //             proposalCampaign: {
    //                 ...proposalCampaign,
    //                 selectInfluencers: sortedInfluencers || [],
    //                 client: client
    //                     ? {
    //                         clientId: client._id,
    //                         firstName: client.firstName,
    //                         email: client.email,
    //                     }
    //                     : null,
    //                 createdAt: proposalCampaign.createdAt,
    //             },
    //         };
    //     } catch (err) {
    //         console.error('Error fetching proposal campaign:', err);
    //         return {
    //             status: 500,
    //             message: 'An unknown error occurred',
    //         };
    //     }
    // }
    //
    // async deleteProposalCampaign(campaignId: string, campaignName: string) {
    //     if (!campaignId || !campaignName) {
    //         return {
    //             status: 400,
    //             message: 'Campaign ID and Campaign Name is required',
    //         };
    //     }
    //
    //     try {
    //         await this.proposalCampaignModel.findOneAndDelete({
    //             _id: new mongoose.Types.ObjectId(campaignId),
    //             campaignName: campaignName,
    //         });
    //
    //         return {
    //             status: 200,
    //             message: `Proposal campaign "${campaignName}" deleted successfully`,
    //         };
    //     } catch (err) {
    //         console.error('Error deleting proposal campaign:', err);
    //         return {
    //             status: 500,
    //             message: 'An unknown error occurred',
    //         };
    //     }
    // }
    //
    // async sendMailToAdminAboutChangingProposalCampaign(campaignId: string, campaignName: string) {
    //     if (!campaignId || !campaignName) {
    //         return {
    //             status: 400,
    //             message: 'Campaign ID and Campaign Name is required',
    //         };
    //     }
    //
    //     try {
    //         const campaignClientId = await this.proposalCampaignModel
    //             .findOne({
    //                 _id: new mongoose.Types.ObjectId(campaignId),
    //                 campaignName: campaignName,
    //             })
    //             .select('clientId');
    //
    //         if (!campaignClientId) {
    //             return {
    //                 status: 404,
    //                 message: 'Proposal campaign not found',
    //             };
    //         }
    //
    //         const clientName = await this.clientModel
    //             .findOne({
    //                 _id: campaignClientId.clientId,
    //             })
    //             .select('firstName');
    //
    //         await sendMail(
    //             // "nazarkozynets030606@zohomail.eu",
    //             'admin@soundinfluencers.com',
    //             'soundinfluencers',
    //             `<p>The client <b>${clientName.firstName}</b> wants to talk about changes to the <b>"${campaignName}"</b> proposal campaign</p>`,
    //             'html',
    //         );
    //
    //         return {
    //             status: 200,
    //             message: `Proposal campaign "${campaignName}" sent to admin successfully`,
    //         };
    //     } catch (err) {
    //         console.error('Error sending email to admin:', err);
    //         return {
    //             status: 500,
    //             message: 'An unknown error occurred',
    //         };
    //     }
    // }
    //
    // async approveProposalCampaign(campaignId: string) {
    //     if (!campaignId) {
    //         return {
    //             code: 400,
    //             message: 'Campaign ID is required',
    //         };
    //     }
    //
    //     const session = await this.connection.startSession();
    //     session.startTransaction();
    //
    //     try {
    //         const proposalCampaign = await this.proposalCampaignModel
    //             .findById(campaignId)
    //             .session(session);
    //
    //         if (!proposalCampaign) {
    //             await session.abortTransaction();
    //             return {
    //                 code: 404,
    //                 message: 'Proposal campaign not found',
    //             };
    //         }
    //
    //         if (
    //             proposalCampaign.selectInfluencers?.length === 0 ||
    //             proposalCampaign.campaignContent?.length === 0
    //         ) {
    //             await session.abortTransaction();
    //             return {
    //                 code: 500,
    //                 message: `Proposal isn't ready for approve`,
    //             };
    //         }
    //
    //         const processedAccounts = proposalCampaign.selectInfluencers
    //             .map(account => {
    //                 if (
    //                     !account.selectedContent.campaignContentItemId ||
    //                     !account.selectedContent.postDescriptionId
    //                 ) return null;
    //
    //                 return {
    //                     influencerId: undefined,
    //                     socialMediaAccountId: account.influencerId.toString(),
    //                     socialMedia: account.socialMedia,
    //                     socialMediaUsername: account.socialMediaUsername,
    //                     selectedCampaignContentItem: {
    //                         campaignContentItemId: account.selectedContent.campaignContentItemId.toString(),
    //                         postDescriptionId: account.selectedContent.postDescriptionId.toString(),
    //                     },
    //                     dateRequest: account.dateRequest,
    //                 };
    //             })
    //             .filter(Boolean);
    //
    //         const processedCampaignContent = proposalCampaign.campaignContent.map(campaignContentItem => ({
    //             _id: campaignContentItem._id.toString(),
    //             videoLink: campaignContentItem.videoLink,
    //             postDescriptions: campaignContentItem.postDescriptions.map(i => ({
    //                 description: i.description,
    //                 _id: i._id.toString(),
    //             })),
    //             storyTag: campaignContentItem.storyTag ?? "",
    //             swipeUpLink: campaignContentItem.swipeUpLink ?? "",
    //             specialWishes: campaignContentItem.specialWishes ?? "",
    //             socialMedia: campaignContentItem.socialMedia ?? "instagram",
    //             socialMediaGroup: campaignContentItem.socialMediaGroup ?? "main"
    //         }));
    //
    //         const formattedCampaign = {
    //             clientId: proposalCampaign.clientId.toString() || '66f540faaf4e960d2f9bebfc',
    //             campaignName: proposalCampaign.campaignName,
    //             paymentType: 'Bank transfer',
    //             paymentStatus: 'wait',
    //             campaignPrice: proposalCampaign.price,
    //             createdAt: proposalCampaign.createdAt.toString(),
    //             socialMedia: proposalCampaign.socialMedia,
    //             selectInfluencers: processedAccounts,
    //             campaignContent: processedCampaignContent,
    //         };
    //
    //         const resultOfDeletingProposal = await this.proposalCampaignModel
    //             .deleteOne({_id: proposalCampaign._id})
    //             .session(session);
    //
    //         if (resultOfDeletingProposal.deletedCount !== 1) {
    //             throw new Error('Error while deleting proposal campaign');
    //         }
    //
    //         const resultOfCreating = await this.campaignsService.createCampaign(formattedCampaign);
    //
    //         await session.commitTransaction();
    //
    //         return {
    //             code: 201,
    //             message: 'Campaign approved successfully',
    //         };
    //     } catch (e) {
    //         await session.abortTransaction();
    //         this.logger.error(
    //             `Error approving proposal campaign: ${e}`,
    //             e instanceof Error ? e.stack : new Error().stack,
    //         );
    //         return {
    //             code: 500,
    //             message: 'An unknown error occurred, transaction rolled back',
    //         };
    //     } finally {
    //         await session.endSession();
    //     }
    // }
}
