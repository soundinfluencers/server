import {BadRequestException, Injectable} from '@nestjs/common';
import mongoose, {Types} from 'mongoose';
import {SaveProposalCampaignDto} from './dto/save-proposal-campaign.dto';
import {ProposalCampaignRepository} from "../../database/repositories/campaigns/proposal-campaign.repository";
import {ProposalCampaignsListItem} from "./types/proposal-system.types";

@Injectable()
export class ProposalSystemService {
    constructor(
        private readonly proposalCampaignRepo: ProposalCampaignRepository,
    ) {
    }

    async saveProposalCampaign(data: SaveProposalCampaignDto) {
        if (!data.campaignName) throw new BadRequestException("Not enough arguments");

        let proposalCampaign = await this.proposalCampaignRepo.findOne({
            _id: new mongoose.Types.ObjectId(data.campaignId),
        });

        if (!proposalCampaign) {
            await this.proposalCampaignRepo.create({
                clientId: data.clientId
                    ? new mongoose.Types.ObjectId(data.clientId)
                    : new mongoose.Types.ObjectId('66f540faaf4e960d2f9bebfc'),
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
            });
        } else {
            await this.proposalCampaignRepo.updateOne(
                {
                    _id: new mongoose.Types.ObjectId(data.campaignId),
                },
                {
                    clientId: data.clientId
                        ? new mongoose.Types.ObjectId(data.clientId)
                        : new mongoose.Types.ObjectId('66f540faaf4e960d2f9bebfc'),
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
