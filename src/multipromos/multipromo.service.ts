import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Client} from "../auth/schemas/client.schema";
import mongoose from "mongoose";
import {Influencer} from "../auth/schemas/influencer.schema";

@Injectable()
export class MultiPromoService {
    constructor(
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
    ) {
    }

    async getAccountsBySocialMedias(socialMedias: string[]) {
        if (socialMedias.length === 0) {
            return {
                code: 400,
                message: 'No social media provided',
            };
        }

        const influencers = await this.influencerModel
            .find({ statusVerify: 'accept' })
            .select(['-password', '-balance', '-phone', '-email'])
            .lean()
            .exec();

        const validAccounts = influencers.map((influencer) => {
            const result = [];
            socialMedias.forEach((socialMedia) => {
                if (influencer[socialMedia] && Array.isArray(influencer[socialMedia])) {
                    const validAccountsForSocialMedia = influencer[socialMedia]
                        .filter(account => !account.isHidden && !account.isDeleted && account.isVerified)
                        .map(account => ({
                            influencerId: influencer._id,
                            validAccount: account,
                            socialMedia: socialMedia,
                        }));

                    if (validAccountsForSocialMedia.length > 0) {
                        result.push(...validAccountsForSocialMedia);
                    }
                }
            });

            return result;
        }).flat();

        return {
            code: 200,
            accounts: validAccounts.map(({ influencerId, socialMedia, validAccount }) => ({
                influencerId,
                socialMedia, 
                ...validAccount,
            })),
        };
    }
}