import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Client} from "src/auth/schemas/client.schema";
import mongoose from "mongoose";
import {Influencer} from "../auth/schemas/influencer.schema";
import {ProposalCampaign} from "./schemas/proposal-campaign.schema";
import {SaveProposalCampaignDto} from "./dto/save-proposal-campaign.dto";
import {Campaign} from "../influencer-actions-history/schemas/influencer-actions-history.schema";

@Injectable()
export class ProposalSystemService {
    constructor(
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
        @InjectModel(ProposalCampaign.name)
        private proposalCampaignModel: mongoose.Model<ProposalCampaign>,
    ) {
    }

    async getAllClients() {
        try {
            const clients = await this.clientModel
                .find()
                .select('_id firstName email');

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
            const influencers = await this.influencerModel.find({
                [socialMedia]: {$exists: true, $nin: [null, []]},
            }, {
                _id: 1,
                [socialMedia]: 1,
            });

            const socialMediaAccounts = await Promise.all(influencers.map(async influencer => {
                return Promise.all(influencer[socialMedia].map(async account => {
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
                            dateRequest: "ASAP",
                        };
                    } catch (accountError) {
                        console.error(`Error processing account for influencer ${influencer._id}:`, accountError);
                        return null;
                    }
                }));
            }));

            const validAccounts = socialMediaAccounts.flat().filter(account => account !== null);

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
                await this.proposalCampaignModel.create({
                    clientId: data.clientId ? new mongoose.Types.ObjectId(data.clientId) : null,
                    campaignName: data.campaignName,
                    selectInfluencers: data.selectInfluencers,
                    videos: data.videos,
                    price: data.price,
                    publicPrice: data.publicPrice,
                    totalFollowers: data.totalFollowers,
                    socialMedia: data.socialMedia,
                });

                return {
                    status: 201,
                    message: 'Proposal campaign created successfully',
                };
            } else {
                await this.proposalCampaignModel.updateOne({
                    _id: new mongoose.Types.ObjectId(data.campaignId),
                }, {
                    clientId: data.clientId ? new mongoose.Types.ObjectId(data.clientId) : null,
                    campaignName: data.campaignName,
                    selectInfluencers: data.selectInfluencers,
                    videos: data.videos,
                    price: data.price,
                    publicPrice: data.publicPrice,
                    totalFollowers: data.totalFollowers,
                    socialMedia: data.socialMedia,
                });

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

    async getAllProposalCampaigns() {
        try {
            const proposalCampaigns = await this.proposalCampaignModel.find();

            const campaigns = await Promise.all(proposalCampaigns.map(async campaign => {
                let client = null;
                try {
                    client = await this.clientModel.findOne({
                        _id: campaign.clientId,
                    });
                } catch (err) {
                    console.error('Error fetching client:', err);
                }
                
                return {
                    ...campaign.toObject(),  
                    client: client ? {
                        clientId: client._id,
                        firstName: client.firstName,
                        email: client.email,
                    } : null,
                };
            }));

            return {
                status: 200,
                proposalCampaigns: campaigns
            };
        } catch (err) {
            console.error('Error fetching proposal campaigns:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }
    
    async getProposalCampaignById(campaignId: string) {
        if (!campaignId) {
            return {
                status: 400,
                message: 'Campaign ID is required',
            };
        }
        
        try {
            const proposalCampaign = await this.proposalCampaignModel.findOne({
                _id: new mongoose.Types.ObjectId(campaignId),
            });
            
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
            
            return {
                status: 200,
                proposalCampaign: {
                    ...proposalCampaign.toObject(),
                    client: client ? {
                        clientId: client._id,
                        firstName: client.firstName,
                        email: client.email,
                    } : null,
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
    };
}