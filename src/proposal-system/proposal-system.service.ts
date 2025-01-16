import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Client} from "src/auth/schemas/client.schema";
import mongoose from "mongoose";
import {Influencer} from "../auth/schemas/influencer.schema";

@Injectable()
export class ProposalSystemService {
    constructor(
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
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
                [socialMedia]: { $exists: true, $nin: [null, []] },
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
}