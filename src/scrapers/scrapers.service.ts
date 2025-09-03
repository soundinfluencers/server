import { InjectModel } from '@nestjs/mongoose';
import { Offer } from '../offers/schemas/offer.schema';
import { Injectable, Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { Influencer } from '../auth/schemas/influencer.schema';
import { Promos } from '../promos/schemas/promo.schema';
import axios from 'axios';
import { ReqUpdatePostDetailsDto } from './dto/req-update-post-details.dto';

@Injectable()
export class ScrapersService {
  private readonly logger = new Logger();

  constructor(
    @InjectModel(Offer.name) private offersModel: Model<Offer>,
    @InjectModel(Influencer.name) private readonly influencerModel: Model<Influencer>,
    @InjectModel(Promos.name) private readonly campaignsModel: Model<Promos>,
  ) {}

  async updatePostDetailsInCampaign(data: ReqUpdatePostDetailsDto) {
    const campaign = await this.campaignsModel.findById(data.campaignId);
    if (!campaign) {
      return {
        code: 404,
        message: `Campaign not found`,
      };
    }

    const accountPostDetails = campaign.selectInfluencers.find(
      (i) => i._id.toString() === data.accountId,
    );
    if (!accountPostDetails) {
      return {
        code: 404,
        message: `Account in campaign not found`,
      };
    }
    if (!accountPostDetails.postLink) {
      return {
        code: 400,
        message: `Account in campaign found but post link does not exist`,
      };
    }

    let result = null;
    try {
      result = await axios.get(`${process.env.SCRAPERS_API}/reels/scrape`, {
        params: { url: accountPostDetails.postLink },
      });

      console.log(result, 'res');
    } catch (e) {
      this.logger.error(
        `[${accountPostDetails.socialMedia.toUpperCase()}]: Error making scraping request for ${accountPostDetails.socialMediaUsername}'s post [${campaign.campaignName}]: \n${e}`,
        e instanceof Error ? e.stack : new Error().stack,
      );
      return {
        code: 502,
        message: `[SCRAPER] Error saving new data for ${accountPostDetails.socialMediaUsername}'s post`,
      };
    }

    if (!result.data.result.play_count || !result.data.result.like_count) {
      this.logger.error(
        `[${accountPostDetails.socialMedia.toUpperCase()}]: Can't scrape needed data for ${accountPostDetails.socialMediaUsername}'s post [${campaign.campaignName}]`,
        new Error().stack,
      );
      return {
        code: 422,
        message: "[SCRAPER] Can't scrape data",
      };
    }

    const scrapedLikesAmount =
      result.data.result.like_count < parseInt(accountPostDetails.like)
        ? accountPostDetails.like
        : result.data.result.like_count.toString();

    try {
      accountPostDetails.impressions = result.data.result.play_count.toString();
      accountPostDetails.like = scrapedLikesAmount;

      campaign.markModified('selectInfluencers');
      await campaign.save();
    } catch (e) {
      this.logger.error(
        `[${accountPostDetails.socialMedia.toUpperCase()}]: Error saving new data for ${accountPostDetails.socialMediaUsername}'s post [${campaign.campaignName}]: \n${e}`,
        e instanceof Error ? e.stack : new Error().stack,
      );
      return {
        code: 500,
        message: `[DATABASE] Error saving new data for ${accountPostDetails.socialMediaUsername}'s post`,
      };
    }

    return {
      code: 200,
      message: `${accountPostDetails.socialMediaUsername} post details updated!`,
      newImpressions: result.data.result.play_count.toString(),
      newLikes: scrapedLikesAmount,
    };
  }
}
