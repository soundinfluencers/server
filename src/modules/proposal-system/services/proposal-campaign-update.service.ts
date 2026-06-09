import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminUpdateCampaignDto, UpdateCampaignDto } from '../../campaigns/dto/update-campaign.dto';
import { MediaService } from '../../media/media.service';
import { CampaignContentItem } from '../../../database/schemas/campaign/campaign.schema';
import {
  CampaignContentItemDto,
  SelectInfluencerDto,
} from '../../campaigns/dto/create-campaign.dto';
import { mapContentItemDtoToModel } from '../../../common/mappers/campaign.mapper';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { CurrencyCode } from '../../../common/types/finance.types';

export type ProposalAccountLike = {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  socialMedia: SocialMediaEnum;
  username: string;
  price: number;
  publicPrice: number;
  selectedContent: {
    campaignContentItemId: Types.ObjectId;
    descriptionId?: Types.ObjectId;
  };
  dateRequest?: string | null;
};

export type ProposalCampaignDocLike = {
  _id: Types.ObjectId;
  campaignName: string;
  save: () => Promise<unknown>;
};

export type ProposalOptionDocLike<TAccount extends ProposalAccountLike> = {
  addedAccounts: TAccount[];
  campaignContent: CampaignContentItem[];
  publicCampaignPrice: number;
  privateCampaignPrice: number;
  displayCurrency: CurrencyCode;
  save: () => Promise<unknown>;
};

// ─── context ───────────────────────────────────────────────────────────────

export type ProposalCampaignUpdateContext<
  TCampaignDoc extends ProposalCampaignDocLike,
  TOptionDoc extends ProposalOptionDocLike<TAccount>,
  TAccount extends ProposalAccountLike,
  TReadModel,
  TResult,
> = {
  findCampaign: (campaignId: string) => Promise<TCampaignDoc | null>;
  findOption: (campaignId: Types.ObjectId, optionIndex: number) => Promise<TOptionDoc | null>;
  buildProposalAccountsBatch: (addedAccountsData: SelectInfluencerDto[]) => Promise<{
    accounts: TAccount[];
    publicCampaignPrice: number;
    privateCampaignPrice: number;
  }>;
  toReadModel: (campaign: TCampaignDoc, option: TOptionDoc) => TReadModel;
  mapResult: (readModel: TReadModel) => TResult;
};

// ─── service ───────────────────────────────────────────────────────────────

@Injectable()
export class ProposalCampaignUpdateService {
  constructor(private readonly mediaService: MediaService) {}

  private readonly logger = new Logger('ProposalCampaignUpdateService');

  async execute<
    TCampaignDoc extends ProposalCampaignDocLike,
    TOptionDoc extends ProposalOptionDocLike<TAccount>,
    TAccount extends ProposalAccountLike,
    TReadModel,
    TResult,
  >(
    campaignId: string,
    optionIndex: number,
    data: UpdateCampaignDto | AdminUpdateCampaignDto,
    context: ProposalCampaignUpdateContext<TCampaignDoc, TOptionDoc, TAccount, TReadModel, TResult>,
  ): Promise<TResult> {
    const campaign = await context.findCampaign(campaignId);

    if (!campaign) {
      throw new NotFoundException('Proposal campaign not found');
    }

    const option = await context.findOption(campaign._id, optionIndex);

    if (!option) {
      throw new NotFoundException('Proposal campaign option not found');
    }

    await this.applyUpdate(campaign, option, data, context.buildProposalAccountsBatch);

    try {
      const readModel = context.toReadModel(campaign, option);
      return context.mapResult(readModel);
    } catch (err) {
      this.logger.warn(`Error mapping proposal campaign ${campaignId} after update: ${err}`);
      throw new ConflictException(
        'Proposal campaign updated, but response serialization failed. Please refresh.',
      );
    }
  }

  private async applyUpdate<
    TCampaignDoc extends ProposalCampaignDocLike,
    TOptionDoc extends ProposalOptionDocLike<TAccount>,
    TAccount extends ProposalAccountLike,
  >(
    campaign: TCampaignDoc,
    option: TOptionDoc,
    data: UpdateCampaignDto | AdminUpdateCampaignDto,
    buildProposalAccountsBatch: (addedAccountsData: SelectInfluencerDto[]) => Promise<{
      accounts: TAccount[];
      publicCampaignPrice: number;
      privateCampaignPrice: number;
    }>,
  ): Promise<void> {
    if (data.campaignName && data.campaignName.trim() !== campaign.campaignName) {
      campaign.campaignName = data.campaignName.trim();
      await campaign.save();
    }
    if (data instanceof AdminUpdateCampaignDto) {
      if (data.displayCurrency !== undefined) {
        option.displayCurrency = data.displayCurrency;
      }
      if (!option.displayCurrency) {
        option.displayCurrency = CurrencyCode.EUR;
      }
      if (data.campaignPrice) {
        option.publicCampaignPrice = data.campaignPrice;
      }
    }

    if (data.addedAccounts) {
      // Index existing accounts two ways:
      //  - by their unique subdocument _id (exposed to the frontend as
      //    `addedAccountsId`). Only this reliably targets one specific row
      //    when several accounts share the same accountId.
      //  - by accountId, as a FIFO queue, used as a fallback for payloads
      //    that don't echo `addedAccountsId`.
      const existingById = new Map<string, TAccount>();
      const existingByAccountId = new Map<string, TAccount[]>();

      for (const acc of option.addedAccounts) {
        const rowId = acc._id?.toString();
        if (rowId) {
          existingById.set(rowId, acc);
        }

        const accKey = acc.accountId.toString();
        const bucket = existingByAccountId.get(accKey);

        if (bucket) {
          bucket.push(acc);
        } else {
          existingByAccountId.set(accKey, [acc]);
        }
      }

      const updatedAccounts: TAccount[] = [];
      const newAccountsDto: SelectInfluencerDto[] = [];
      let newPrices = { publicCampaignPrice: 0, privateCampaignPrice: 0 };
      // Guards against matching the same existing account twice.
      const consumed = new Set<TAccount>();

      for (const accDto of data.addedAccounts) {
        let matchedAcc: TAccount | undefined;

        // 1) Exact row match by the unique subdocument _id, if sent.
        const rowId = accDto.addedAccountsId?.toString();
        if (rowId) {
          const byId = existingById.get(rowId);
          if (byId && !consumed.has(byId)) {
            matchedAcc = byId;
          }
        }

        // 2) Fallback: next not-yet-consumed account sharing this accountId.
        if (!matchedAcc) {
          const bucket = existingByAccountId.get(accDto.socialAccountId);

          while (bucket && bucket.length > 0) {
            const candidate = bucket.shift();
            if (candidate && !consumed.has(candidate)) {
              matchedAcc = candidate;
              break;
            }
          }
        }

        if (matchedAcc) {
          consumed.add(matchedAcc);

          // Deep copy before mutating so two updated entries never end up
          // sharing a single object reference.
          const existingAcc = this.cloneAccount(matchedAcc);

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

          newPrices.publicCampaignPrice += existingAcc.publicPrice;
          newPrices.privateCampaignPrice += existingAcc.price;

          updatedAccounts.push(existingAcc);
        } else {
          newAccountsDto.push(accDto);
        }
      }

      if (newAccountsDto.length > 0) {
        const newAccounts = await buildProposalAccountsBatch(newAccountsDto);

        if (newAccounts.accounts.length > 0) {
          updatedAccounts.push(...newAccounts.accounts);
          newPrices.publicCampaignPrice += newAccounts.publicCampaignPrice;
          newPrices.privateCampaignPrice += newAccounts.privateCampaignPrice;
        } else {
          this.logger.warn(`Can't proceed new accounts while updating proposal campaign`);
        }
      }

      option.addedAccounts = updatedAccounts;
      option.publicCampaignPrice = newPrices.publicCampaignPrice;
      option.privateCampaignPrice = newPrices.privateCampaignPrice;
    }

    if (data.campaignContent) {
      option.campaignContent = data.campaignContent.map(
        (itemDto: CampaignContentItemDto): CampaignContentItem => mapContentItemDtoToModel(itemDto),
      );
      option.campaignContent = await this.mediaService.applyMediaCacheForCreate(
        option.campaignContent,
      );
    }

    await option.save();
  }

  /**
   * Deep copy of an existing proposal account so mutating the result never
   * affects the original document or another entry that shares the same
   * accountId. Mongoose subdocuments expose `toObject()` (a deep plain copy
   * with ObjectId instances preserved); the fallback covers plain objects.
   */
  private cloneAccount<TAccount extends ProposalAccountLike>(account: TAccount): TAccount {
    const maybeDoc = account as unknown as { toObject?: () => unknown };

    if (typeof maybeDoc.toObject === 'function') {
      return maybeDoc.toObject() as TAccount;
    }

    return {
      ...account,
      selectedContent: { ...account.selectedContent },
    };
  }
}
