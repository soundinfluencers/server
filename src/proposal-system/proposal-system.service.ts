import {Injectable, Logger} from '@nestjs/common';
import {InjectConnection, InjectModel} from '@nestjs/mongoose';
import {Client} from 'src/auth/schemas/client.schema';
import mongoose, {Connection, Types} from 'mongoose';
import {Influencer} from '../auth/schemas/influencer.schema';
import {ProposalCampaign} from './schemas/proposal-campaign.schema';
import {SaveProposalCampaignDto} from './dto/save-proposal-campaign.dto';
import sendMail from '../services/sendMail';
import {Promos} from "../promos/schemas/promo.schema";
import {PromosService} from "../promos/promos.service";

@Injectable()
export class ProposalSystemService {
    private readonly logger = new Logger();

    constructor(
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
        @InjectModel(ProposalCampaign.name)
        private proposalCampaignModel: mongoose.Model<ProposalCampaign>,
        @InjectModel(Promos.name)
        private promoModel: mongoose.Model<Promos>,
        private readonly promoService: PromosService,
        @InjectConnection() private readonly connection: Connection,
    ) {
    }

    async getAllClients() {
        try {
            const clients = await this.clientModel.find().select('_id firstName email');

            return {
                status: 200,
                clients: clients,
            };
        } catch (err) {
            console.error(err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async getAllBrandAccounts(socialMedia: string) {
        if (!socialMedia) {
            return {
                status: 400,
                message: 'Social media is required',
            };
        }

        try {
            const influencers = await this.influencerModel.find(
                {
                    [socialMedia]: {$exists: true, $nin: [null, []]},
                },
                {
                    _id: 1,
                    [socialMedia]: 1,
                },
            );

            const socialMediaAccounts = await Promise.all(
                influencers.map(async (influencer) => {
                    return Promise.all(
                        influencer[socialMedia].map(async (account) => {
                            try {
                                return {
                                    influencerId: influencer._id,
                                    instagramUsername: account.instagramUsername,
                                    followersNumber: account.followersNumber,
                                    logo: account.logo,
                                    price: account.price,
                                    publicPrice: account.publicPrice,
                                    countries: account.countries,
                                    musicStyle: account.musicStyle,
                                    musicStyleOther: account.musicStyleOther,
                                    musicSubStyles: account.musicSubStyles,
                                    dateRequest: 'ASAP',
                                };
                            } catch (accountError) {
                                console.error(
                                    `Error processing account for influencer ${influencer._id}:`,
                                    accountError,
                                );
                                return null;
                            }
                        }),
                    );
                }),
            );

            const validAccounts = socialMediaAccounts.flat().filter((account) => account !== null);

            return {
                status: 200,
                influencers: validAccounts,
            };
        } catch (err) {
            console.error(err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async saveProposalCampaign(data: SaveProposalCampaignDto) {
        if (!data.campaignName) {
            return {
                status: 400,
                message: 'Campaign name is required',
            };
        }

        try {
            let proposalCampaign = await this.proposalCampaignModel.findOne({
                _id: new mongoose.Types.ObjectId(data.campaignId),
            });

            if (!proposalCampaign) {
                const res = await this.proposalCampaignModel.create({
                    clientId: data.clientId
                        ? new mongoose.Types.ObjectId(data.clientId)
                        : new mongoose.Types.ObjectId('66f540faaf4e960d2f9bebfc'),
                    campaignName: data.campaignName.trim(),
                    selectInfluencers: data.selectInfluencers.map(account => ({
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
                });

                return {
                    status: 201,
                    campaignId: res._id,
                    message: 'Proposal campaign created successfully',
                };
            } else {
                await this.proposalCampaignModel.updateOne(
                    {
                        _id: new mongoose.Types.ObjectId(data.campaignId),
                    },
                    {
                        clientId: data.clientId
                            ? new mongoose.Types.ObjectId(data.clientId)
                            : new mongoose.Types.ObjectId('66f540faaf4e960d2f9bebfc'),
                        campaignName: data.campaignName.trim(),
                        selectInfluencers: data.selectInfluencers.map(account => ({
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
                    },
                );

                return {
                    status: 200,
                    message: 'Proposal campaign updated successfully',
                };
            }
        } catch (err) {
            console.error(err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async getAllProposalCampaigns(): Promise<any> {
        try {
            const proposalCampaigns = await this.proposalCampaignModel
                .find()
                .populate('clientId', 'firstName email')
                .populate({
                    path: 'selectInfluencers.influencerId',
                    select: 'instagram tiktok youtube spotify soundcloud facebook press',
                })
                .lean()
                .exec();

            const duplicatesMap = proposalCampaigns.reduce((acc, campaign) => {
                const name = campaign.campaignName;
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            Object.entries(duplicatesMap)
                .filter(([_, count]) => count > 1)
                .forEach(([name, count]) => {
                    console.warn(`⚠️ Proposal System Дубликаты: "${name}" — ${count} шт.`);
                });

            const campaigns = proposalCampaigns.map((campaign) => {
                const clientDoc = campaign.clientId as any;
                const client = clientDoc
                    ? {
                        clientId: clientDoc._id,
                        firstName: clientDoc.firstName ?? "Unknown",
                        email: clientDoc.email,
                    }
                    : null;

                const processedSelectInfluencers =
                    campaign.selectInfluencers?.map((acc) => {
                        let accountId: string | undefined;

                        if (acc.influencerId) {
                            const influencer = acc.influencerId;
                            const accounts = influencer[acc.socialMedia] || [];
                            const account = accounts.find(
                                (a) => a.instagramUsername === acc.socialMediaUsername,
                            );
                            accountId = account?._id?.toString();
                        }

                        return {
                            ...acc,
                            accountId,
                        };
                    }) ?? [];

                return {
                    ...campaign,
                    selectInfluencers: processedSelectInfluencers,
                    client,
                };
            });

            return {
                status: 200,
                proposalCampaigns: campaigns.sort((a, b) =>
                    a.createdAt > b.createdAt ? -1 : 1,
                ),
            };
        } catch (err) {
            console.error('Error fetching proposal campaigns:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async getProposalCampaignById(campaignId: string): Promise<any> {
        if (!campaignId) {
            return {
                status: 400,
                message: 'Campaign ID is required',
            };
        }

        try {
            const proposalCampaign = await this.proposalCampaignModel
                .findOne({
                    _id: new mongoose.Types.ObjectId(campaignId),
                })
                .lean()
                .exec();

            if (!proposalCampaign) {
                return {
                    status: 404,
                    message: 'Proposal campaign not found',
                };
            }

            let client = null;
            try {
                client = await this.clientModel.findOne({
                    _id: proposalCampaign.clientId,
                });
            } catch (err) {
                console.error('Error fetching client:', err);
            }

            const processedSelectInfluencers = proposalCampaign.selectInfluencers?.length
                ? await Promise.all(
                    proposalCampaign.selectInfluencers.map((acc) => {
                        const selectedCampaignContentItem = proposalCampaign.campaignContent.find(c =>
                            c._id.toString() === acc.selectedContent.campaignContentItemId.toString()
                        );

                        let selectedCampaignContent: any = null;

                        if (selectedCampaignContentItem) {
                            const postDesc =
                                selectedCampaignContentItem.postDescriptions.find(
                                    i => i._id.toString() === acc.selectedContent.postDescriptionId?.toString()
                                )?.description ?? "";

                            selectedCampaignContent = {
                                _id: selectedCampaignContentItem._id,
                                videoLink: selectedCampaignContentItem.videoLink,
                                postDescription: postDesc,
                                storyTag: selectedCampaignContentItem.storyTag,
                                storyLink: selectedCampaignContentItem.swipeUpLink,
                                specialRequests: selectedCampaignContentItem.specialWishes,
                                socialMedia: selectedCampaignContentItem.socialMedia,
                            };
                        }

                        return {
                            ...acc,
                            selectedCampaignContentItem: selectedCampaignContent,
                        };
                    }),
                )
                : [];

            const sortedInfluencers =
                processedSelectInfluencers.length > 0 &&
                processedSelectInfluencers.filter(influencer => influencer.selectedContent).sort((a, b) => {
                    const aContentId = a.selectedContent;
                    const bContentId = b.selectedContent;

                    const aIndex = proposalCampaign.campaignContent
                        ? proposalCampaign.campaignContent.findIndex(
                            (content) => content._id.toString() === aContentId.campaignContentItemId.toString(),
                        )
                        : -1;

                    const bIndex = proposalCampaign.campaignContent
                        ? proposalCampaign.campaignContent.findIndex(
                            (content) => content._id.toString() === bContentId.campaignContentItemId.toString(),
                        )
                        : -1;

                    return aIndex - bIndex;
                });

            return {
                status: 200,
                proposalCampaign: {
                    ...proposalCampaign,
                    selectInfluencers: sortedInfluencers || [],
                    client: client
                        ? {
                            clientId: client._id,
                            firstName: client.firstName,
                            email: client.email,
                        }
                        : null,
                    createdAt: proposalCampaign.createdAt,
                },
            };
        } catch (err) {
            console.error('Error fetching proposal campaign:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async deleteProposalCampaign(campaignId: string, campaignName: string) {
        if (!campaignId || !campaignName) {
            return {
                status: 400,
                message: 'Campaign ID and Campaign Name is required',
            };
        }

        try {
            await this.proposalCampaignModel.findOneAndDelete({
                _id: new mongoose.Types.ObjectId(campaignId),
                campaignName: campaignName,
            });

            return {
                status: 200,
                message: `Proposal campaign "${campaignName}" deleted successfully`,
            };
        } catch (err) {
            console.error('Error deleting proposal campaign:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async sendMailToAdminAboutChangingProposalCampaign(campaignId: string, campaignName: string) {
        if (!campaignId || !campaignName) {
            return {
                status: 400,
                message: 'Campaign ID and Campaign Name is required',
            };
        }

        try {
            const campaignClientId = await this.proposalCampaignModel
                .findOne({
                    _id: new mongoose.Types.ObjectId(campaignId),
                    campaignName: campaignName,
                })
                .select('clientId');

            if (!campaignClientId) {
                return {
                    status: 404,
                    message: 'Proposal campaign not found',
                };
            }

            const clientName = await this.clientModel
                .findOne({
                    _id: campaignClientId.clientId,
                })
                .select('firstName');

            await sendMail(
                // "nazarkozynets030606@zohomail.eu",
                'admin@soundinfluencers.com',
                'soundinfluencers',
                `<p>The client <b>${clientName.firstName}</b> wants to talk about changes to the <b>"${campaignName}"</b> proposal campaign</p>`,
                'html',
            );

            return {
                status: 200,
                message: `Proposal campaign "${campaignName}" sent to admin successfully`,
            };
        } catch (err) {
            console.error('Error sending email to admin:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async approveProposalCampaign(campaignId: string) {
        if (!campaignId) {
            return {
                code: 400,
                message: 'Campaign ID is required',
            };
        }

        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            const proposalCampaign = await this.proposalCampaignModel
                .findById(campaignId)
                .session(session);

            if (!proposalCampaign) {
                await session.abortTransaction();
                return {
                    code: 404,
                    message: 'Proposal campaign not found',
                };
            }

            if (
                proposalCampaign.selectInfluencers?.length === 0 ||
                proposalCampaign.campaignContent?.length === 0
            ) {
                await session.abortTransaction();
                return {
                    code: 500,
                    message: `Proposal isn't ready for approve`,
                };
            }

            const processedAccounts = proposalCampaign.selectInfluencers
                .map(account => {
                    if (
                        !account.selectedContent.campaignContentItemId ||
                        !account.selectedContent.postDescriptionId
                    ) return null;

                    return {
                        influencerId: undefined,
                        socialMediaAccountId: account.influencerId.toString(),
                        socialMedia: account.socialMedia,
                        socialMediaUsername: account.socialMediaUsername,
                        selectedCampaignContentItem: {
                            campaignContentItemId: account.selectedContent.campaignContentItemId.toString(),
                            postDescriptionId: account.selectedContent.postDescriptionId.toString(),
                        },
                        dateRequest: account.dateRequest,
                    };
                })
                .filter(Boolean);

            const processedCampaignContent = proposalCampaign.campaignContent.map(campaignContentItem => ({
                _id: campaignContentItem._id.toString(),
                videoLink: campaignContentItem.videoLink,
                postDescriptions: campaignContentItem.postDescriptions.map(i => ({
                    description: i.description,
                    _id: i._id.toString(),
                })),
                storyTag: campaignContentItem.storyTag ?? "",
                swipeUpLink: campaignContentItem.swipeUpLink ?? "",
                specialWishes: campaignContentItem.specialWishes ?? "",
                socialMedia: campaignContentItem.socialMedia ?? "instagram",
                socialMediaGroup: campaignContentItem.socialMediaGroup ?? "main"
            }));

            const formattedCampaign = {
                clientId: proposalCampaign.clientId.toString() || '66f540faaf4e960d2f9bebfc',
                campaignName: proposalCampaign.campaignName,
                paymentType: 'Bank transfer',
                paymentStatus: 'wait',
                campaignPrice: proposalCampaign.price,
                createdAt: proposalCampaign.createdAt.toString(),
                socialMedia: proposalCampaign.socialMedia,
                selectInfluencers: processedAccounts,
                campaignContent: processedCampaignContent,
            };

            const resultOfDeletingProposal = await this.proposalCampaignModel
                .deleteOne({ _id: proposalCampaign._id })
                .session(session);

            if (resultOfDeletingProposal.deletedCount !== 1) {
                throw new Error('Error while deleting proposal campaign');
            }

            const resultOfCreating = await this.promoService.createPromo(formattedCampaign);
            if (resultOfCreating.code !== 201) {
                throw new Error('Error while creating promo campaign');
            }

            await session.commitTransaction();

            return {
                code: 201,
                message: 'Campaign approved successfully',
            };
        } catch (e) {
            await session.abortTransaction();
            this.logger.error(
                `Error approving proposal campaign: ${e}`,
                e instanceof Error ? e.stack : new Error().stack,
            );
            return {
                code: 500,
                message: 'An unknown error occurred, transaction rolled back',
            };
        } finally {
            await session.endSession();
        }
    }
}
