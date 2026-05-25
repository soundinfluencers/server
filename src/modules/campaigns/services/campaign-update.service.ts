import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClientSession, Types } from 'mongoose';
import {
  AdminUpdateCampaignDto,
  AdminUpdatePromoDto,
  UpdateCampaignDto,
} from '../dto/update-campaign.dto';
import { MediaService } from '../../media/media.service';
import { CampaignContentItem } from '../../../database/schemas/campaign/campaign.schema';
import { CampaignContentItemDto, SelectInfluencerDto } from '../dto/create-campaign.dto';
import { mapContentItemDtoToModel } from '../../../common/mappers/campaign.mapper';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { CurrencyCode } from '../../../common/types/finance.types';

export type CampaignAccountLike = {
  accountId: Types.ObjectId;
  socialMedia: SocialMediaEnum;
  username: string;
  selectedContent: {
    campaignContentItemId: Types.ObjectId;
    descriptionId?: Types.ObjectId;
  };
  dateRequest?: string | null;
  postLink?: string | null;
  screenshot?: string | null;
  impressions?: number | null;
  like?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  rating?: number | null;
};

export type CampaignDocumentLike<TAccount extends CampaignAccountLike> = {
  campaignName: string;
  addedAccounts: TAccount[];
  campaignContent: CampaignContentItem[];
  campaignPrice: number;
  displayCurrency: CurrencyCode;
  socialMedia: SocialMediaEnum | 'multipromo';
  isCpmAndResultHidden?: boolean;
  isPriceHidden?: boolean;
  save: (options?: { session?: ClientSession }) => Promise<unknown>;
  toObject: () => unknown;
};

export type CampaignUpdateContext<
  TCampaignDoc extends CampaignDocumentLike<TAccount>,
  TAccount extends CampaignAccountLike,
  TReadModel,
  TResult,
> = {
  findCampaign: (campaignId: string) => Promise<TCampaignDoc | null>;
  buildCampaignAccountsBatch: (addedAccountsData: SelectInfluencerDto[]) => Promise<TAccount[]>;
  toReadModel: (campaign: TCampaignDoc) => TReadModel;
  mapResult: (campaign: TReadModel) => TResult;
  session?: ClientSession;
  afterSave?: (campaign: TCampaignDoc, session?: ClientSession) => Promise<void>;
};

@Injectable()
export class CampaignUpdateService {
  constructor(private readonly mediaService: MediaService) {}

  private readonly logger = new Logger();

  async execute<
    TCampaignDoc extends CampaignDocumentLike<TAccount>,
    TAccount extends CampaignAccountLike,
    TReadModel,
    TResult,
  >(
    campaignId: string,
    data: UpdateCampaignDto | AdminUpdateCampaignDto,
    context: CampaignUpdateContext<TCampaignDoc, TAccount, TReadModel, TResult>,
  ): Promise<TResult> {
    const campaign = await context.findCampaign(campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    await this.applyUpdate(campaign, data, context.buildCampaignAccountsBatch, context.session);

    if (context.afterSave) {
      await context.afterSave(campaign, context.session);
    }

    try {
      const readModel = context.toReadModel(campaign);
      return context.mapResult(readModel);
    } catch (err) {
      this.logger.warn(`Error mapping campaign ${campaignId} after update: ${err}`);

      throw new ConflictException(
        'Campaign updated, but response serialization failed. Please refresh.',
      );
    }
  }

  private async applyUpdate<
    TCampaignDoc extends CampaignDocumentLike<TAccount>,
    TAccount extends CampaignAccountLike,
  >(
    campaign: TCampaignDoc,
    data: UpdateCampaignDto | AdminUpdateCampaignDto,
    buildCampaignAccountsBatch: (addedAccountsData: SelectInfluencerDto[]) => Promise<TAccount[]>,
    session?: ClientSession,
  ): Promise<void> {
    // Default fields - CLIENT & ADMIN can change
    if (data.campaignName && data.campaignName.trim() !== campaign.campaignName) {
      campaign.campaignName = data.campaignName.trim();
    }
    if (data.isCpmAndResultHidden !== undefined) {
      campaign.isCpmAndResultHidden = data.isCpmAndResultHidden;
    }
    if (data.isPriceHidden !== undefined) {
      campaign.isPriceHidden = data.isPriceHidden;
    }

    // Admin fields
    if (data instanceof AdminUpdateCampaignDto) {
      if (data.displayCurrency !== undefined) {
        campaign.displayCurrency = data.displayCurrency;
      }
      if (!campaign.displayCurrency) {
        campaign.displayCurrency = CurrencyCode.EUR;
      }
      if (data.campaignPrice) {
        campaign.campaignPrice = data.campaignPrice;
      }

      if (data.addedAccounts) {
        const existingAccountsMap = new Map<string, TAccount>();

        for (const acc of campaign.addedAccounts) {
          existingAccountsMap.set(acc.accountId.toString(), acc);
        }

        const updatedAccounts: TAccount[] = [];
        const newAccountsDto: SelectInfluencerDto[] = [];

        for (const accDto of data.addedAccounts) {
          const existingAcc = existingAccountsMap.get(accDto.socialAccountId.toString());

          if (existingAcc) {
            existingAcc.socialMedia = accDto.socialMedia;
            existingAcc.username = accDto.username;
            existingAcc.selectedContent.campaignContentItemId = new Types.ObjectId(
                accDto.selectedCampaignContentItem.campaignContentItemId,
            );

            existingAcc.selectedContent.descriptionId = accDto.selectedCampaignContentItem
                .descriptionId
                ? new Types.ObjectId(accDto.selectedCampaignContentItem.descriptionId)
                : undefined;

            existingAcc.dateRequest = accDto.dateRequest ?? null;

            if (accDto instanceof AdminUpdatePromoDto) {
              if (accDto.postLink) existingAcc.postLink = accDto.postLink;
              if (accDto.screenshot) existingAcc.screenshot = accDto.screenshot;
              if (accDto.impressions != null) existingAcc.impressions = accDto.impressions;
              if (accDto.like != null) existingAcc.like = accDto.like;
              if (accDto.comments != null) existingAcc.comments = accDto.comments;
              if (accDto.shares != null) existingAcc.shares = accDto.shares;
              if (accDto.saves != null) existingAcc.saves = accDto.saves;
              if (accDto.rating != null) existingAcc.rating = accDto.rating;
            }

            updatedAccounts.push(existingAcc);
          } else {
            newAccountsDto.push(accDto);
          }
        }

        if (newAccountsDto.length > 0) {
          const newAccounts = await buildCampaignAccountsBatch(newAccountsDto);

          if (newAccounts.length === 0) {
            this.logger.warn(`Can't proceed new accounts while updating campaign ${data.campaignId}`);
          }

          updatedAccounts.push(...newAccounts);
        }

        campaign.addedAccounts = updatedAccounts;

        // If need to update campaign's socialMedia field
        const uniqueSocialMedias: SocialMediaEnum[] = [
          ...new Set(data.addedAccounts.map((acc) => acc.socialMedia)),
        ];

        if (uniqueSocialMedias.length > 1) {
          campaign.socialMedia = 'multipromo';
        } else {
          campaign.socialMedia = uniqueSocialMedias[0] ?? campaign.socialMedia;
        }
      }

      if (data.campaignContent) {
        campaign.campaignContent = data.campaignContent.map(
            (itemDto: CampaignContentItemDto): CampaignContentItem => mapContentItemDtoToModel(itemDto),
        );

        campaign.campaignContent = await this.mediaService.applyMediaCacheForCreate(
            campaign.campaignContent,
        );
      }
    }

    await campaign.save(session ? { session } : undefined);
  }
}
