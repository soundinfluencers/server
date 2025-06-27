import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Client } from '../auth/schemas/client.schema';
import mongoose from 'mongoose';
import { Influencer } from '../auth/schemas/influencer.schema';

@Injectable()
export class MultiPromoService {
  constructor(
    @InjectModel(Client.name)
    private clientModel: mongoose.Model<Client>,
    @InjectModel(Influencer.name)
    private influencerModel: mongoose.Model<Influencer>,
  ) {}

  async getAccountsBySocialMedias(socialMedias: string[]) {
    if (socialMedias.length === 0) {
      return {
        code: 400,
        message: 'No social media provided',
      };
    }
    try {
      const influencers = await this.influencerModel
        .find({
          statusVerify: 'accept',
          $or: socialMedias.map((media) => ({ [`${media}.isVerified`]: true })),
        })
        .select(['_id', 'username', ...socialMedias.map((m) => `${m}`)])
        .lean();

      const validAccounts = influencers.flatMap((influencer) =>
        socialMedias.flatMap((media) =>
          (influencer[media] || [])
            .filter((account) => !account.isHidden && !account.isDeleted && account.isVerified)
            .map((account) => ({
              influencerId: influencer._id,
              socialMedia: media,
              ...account,
            })),
        ),
      );

      return { code: 200, accounts: validAccounts };
    } catch (e) {
      console.error(e);
      return { code: 500, message: 'Internal server error' };
    }
  }
}
