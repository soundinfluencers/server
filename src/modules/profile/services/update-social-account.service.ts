import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { isMongoId } from 'class-validator';

import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { ObjId } from '../../../common/types/base.types';
import { Influencer, SocialAccount } from '../../../database/schemas/users/influencer.schema';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { UpdateSocialAccountDto } from '../dto/influencer/update-influencer.dto';
import { AdminUpdateSocialAccountDto } from '../../admin/dto/influencers/admin-update-influencer.dto';
import {
  InfluencerProfileCategory,
  SocialAccountLabelStatus,
} from '../../../common/types/influencer/influencer.types';
import {
  mapToAdminSocialAccountForListDto,
  mapToSocialAccountDetailsDto,
} from '../../../common/mappers/influencer.mapper';
import { AccountVerifiedStatus } from '../../../common/types/user.types';
import { areCountriesValid } from '../../../common/utils/countries.util';
import { CurrencyCode, getAvailableCurrenciesLabel } from '../../../common/types/finance.types';
import { AdminSocialAccountForListDto } from '../../admin/dto/influencers/admin-influencers.dto';
import {
  CREATE_ADMIN_REQUEST_SERVICE,
  CreateAdminRequestService,
} from '../../admin/services/requests/create-admin-request.service';
import { RequestForAdminType } from '../../../common/types/request-for-admin/request-for-admin.types';
import { EmailService } from '../../../integrations/email/email.service';
import { InfluencerToAdminEmails } from '../../../integrations/email/email.templates';
import { SocialAccountDetailsDto } from '../dto/influencer/get-profile.dto';
import { ExchangeRateService } from 'src/integrations/exchange-rate/exchange-rate.service';
import { FilteredNestLogger } from 'src/common/logger/filtered-nest-logger';

type UpdateSocialAccountInput = UpdateSocialAccountDto | AdminUpdateSocialAccountDto;

interface IUpdateSocialAccountService {
  // Executes service
  execute(
    data: UpdateSocialAccountInput,
    isForAdmin?: boolean,
  ): Promise<SocialAccountDetailsDto | AdminSocialAccountForListDto>;

  // Finds influencer by id
  findInfluencerById(influencerId: ObjId): Promise<Influencer>;

  // Finds social account index in influencer socialAccounts array
  findSocialAccount(
    influencer: Influencer,
    socialMedia: SocialMediaEnum,
    socialAccountId: ObjId,
  ): SocialAccount;
}

@Injectable()
export class UpdateSocialAccountService implements IUpdateSocialAccountService {
  private readonly logger = new FilteredNestLogger('UpdateSocialAccountService');

  constructor(
    private readonly influencerRepository: InfluencerRepository,
    @Inject(CREATE_ADMIN_REQUEST_SERVICE)
    private readonly createAdminRequestService: CreateAdminRequestService,
    private readonly emailService: EmailService,
    private readonly exchangeRateService: ExchangeRateService,
  ) { }

  async execute(
    data: UpdateSocialAccountInput,
    isForAdmin: boolean = false,
  ): Promise<SocialAccountDetailsDto | AdminSocialAccountForListDto> {
    this.logger.debug(`PAYLOAD: ${JSON.stringify(data, null, '\t')}`);
    const { influencerId, socialAccountId, socialMedia } = this.validateInput(data);

    this.validateProfileCategoryFields(data);
    this.validateCountries(data);

    // Find influencer by id
    const influencer = await this.findInfluencerById(influencerId);

    // Find social account
    const socialAccount = this.findSocialAccount(influencer, socialMedia, socialAccountId);

    if (isForAdmin === false) {
      this.validateAccountVerifiedStatus(
        socialAccount.verifiedStatus ?? AccountVerifiedStatus.waitForAdmin,
      );
    }

    const updateFields = this.buildUpdateFields(data, isForAdmin);

    const isPriceChanged = data.price !== undefined && data.price !== null && data.price !== socialAccount.price;

    if (isPriceChanged === true) {
      switch (isForAdmin) {
        case false:
          await this.handleInfluencerPriceChange({
            data,
            influencer,
            socialAccount,
            socialMedia,
            influencerId,
            socialAccountId,
            updateFields,
          });
          break;
        case true:
          const parsedPricesInfo = await this.handleAdminPriceChange({
            // currentInitialPrice:
            //   Number.isFinite(socialAccount.initialPrice) && socialAccount.initialPrice > 0
            //     ? socialAccount.initialPrice
            //     : socialAccount.price,
            requestedInitialPrice: data.price,
            requestedCurrency: data.currency,
          });

          this.logger.debug(`PARSED PRICES RESULT FROM handleAdminPriceChange: ${JSON.stringify(parsedPricesInfo, null, '\t')}`);

          if (!parsedPricesInfo) {
            this.logger.error(
              `Can't parse prices for ${socialMedia} social account ${socialAccount.username}, ${JSON.stringify(parsedPricesInfo, null, '\t')}`,
            );
            throw new InternalServerErrorException(
              'Something went wrong while saving your account. Try again later.',
            );
          }

          updateFields.price = parsedPricesInfo.price;
          updateFields.publicPrice = parsedPricesInfo.publicPrice;
          updateFields.initialPrice = parsedPricesInfo.initialPrice;
          updateFields.currency = parsedPricesInfo.currency;

          break;
        default:
          break;
      }
    }

    this.logger.debug(`UPDATE FIELDS FOR UPDATING SOCIAL ACCOUNT: \nLENGTH: ${Object.keys(updateFields).length}\nOBJECT: ${JSON.stringify(updateFields, null, '\t')}`);

    // if there's no fields to update - return account in current state (without updating)
    if (Object.keys(updateFields).length === 0) {
      return isForAdmin
        ? mapToAdminSocialAccountForListDto({
          ...socialAccount,
          influencerId: influencerId,
          firstName: influencer.firstName,
          lastName: influencer.lastName,
          email: influencer.email,
          phone: influencer.phone,
          accountId: socialAccount._id,
          balance: influencer.balance,
          socialMedia: socialMedia,
          costPerFollower:
            Number((socialAccount?.price / socialAccount?.followers)?.toFixed(6)) ?? 0,
        })
        : mapToSocialAccountDetailsDto(socialAccount);
    }


    await this.updateSocialAccountInDb({
      influencerId,
      socialAccountId,
      socialMedia,
      updateFields,
    });

    const updatedAccount = await this.findUpdatedSocialAccount({
      influencerId,
      socialAccountId,
      socialMedia,
    });

    return isForAdmin
      ? mapToAdminSocialAccountForListDto({
        influencerId: influencerId,
        firstName: influencer.firstName,
        lastName: influencer.lastName,
        email: influencer.email,
        phone: influencer.phone,
        balance: influencer.balance,
        accountId: updatedAccount._id,
        username: updatedAccount.username,
        socialMedia: socialMedia,
        logoUrl: updatedAccount.logoUrl,
        followers: updatedAccount.followers,
        profileLink: updatedAccount.profileLink,
        publicPrice: updatedAccount.publicPrice,
        price: updatedAccount.price,
        initialPrice: updatedAccount.initialPrice,
        currency: updatedAccount.currency,
        costPerFollower:
          Number((updatedAccount?.price / updatedAccount?.followers)?.toFixed(6)) ?? 0,
        isHidden: updatedAccount.isHidden,
        internalNote: influencer.internalNote,
      })
      : mapToSocialAccountDetailsDto(updatedAccount);
  }

  // Finds influencer by id
  async findInfluencerById(influencerId: ObjId): Promise<Influencer> {
    const influencer = await this.influencerRepository.findOne({
      _id: influencerId,
    });

    if (!influencer) throw new NotFoundException('Influencer not found.');

    return influencer;
  }

  // Finds social account index in influencer socialAccounts array
  findSocialAccount(
    influencer: Influencer,
    socialMedia: SocialMediaEnum,
    socialAccountId: ObjId,
  ): SocialAccount {
    const socialMediaAccounts: SocialAccount[] = influencer[socialMedia];

    if (!socialMediaAccounts || socialMediaAccounts.length === 0) {
      throw new NotFoundException(`No accounts found for social media: ${socialMedia}`);
    }

    const accountIndex = socialMediaAccounts.findIndex(
      (account) => account._id.toString() === socialAccountId.toString(),
    );

    if (accountIndex === -1) throw new NotFoundException('Social account not found');

    const socialAccount = influencer[socialMedia][accountIndex];

    if (!socialAccount) throw new NotFoundException('Social account not found');

    return socialAccount;
  }

  private validateInput(data: UpdateSocialAccountInput): {
    influencerId: ObjId;
    socialAccountId: ObjId;
    socialMedia: SocialMediaEnum;
  } {
    if (!data.influencerId) {
      throw new BadRequestException('Not enough arguments');
    }

    if (!isMongoId(data.influencerId)) {
      throw new BadRequestException('Invalid influencer id.');
    }

    if (!data.accountId || !isMongoId(data.accountId)) {
      throw new BadRequestException('Invalid social account id.');
    }

    return {
      influencerId: new ObjId(data.influencerId),
      socialAccountId: new ObjId(data.accountId),
      socialMedia: data.socialMedia,
    };
  }

  private validateAccountVerifiedStatus(verifiedStatus: AccountVerifiedStatus): void {
    if (verifiedStatus !== AccountVerifiedStatus.accept) {
      throw new ForbiddenException(
        'Wait for admin approval before updating an account with a requested price change',
      );
    }
  }

  private validateProfileCategoryFields(data: UpdateSocialAccountInput): void {
    if (!data.profileCategory) return;

    switch (data.profileCategory) {
      case InfluencerProfileCategory.community:
        if (data.creatorMusicGenres !== undefined || data.creatorContentFocus !== undefined) {
          throw new BadRequestException(
            "You can't select creator music genres or content focus for community account",
          );
        }
        return;
      case InfluencerProfileCategory.creator:
        if (data.communityMusicGenres !== undefined || data.communityThemeTopics !== undefined) {
          throw new BadRequestException(
            "You can't select community music genres or theme topics for creator account",
          );
        }
        return;
      default:
        throw new BadRequestException('Unsupported profile category');
    }
  }

  private validateCountries(data: UpdateSocialAccountInput): void {
    if (data.countries !== undefined && !areCountriesValid(data.countries)) {
      throw new BadRequestException('Countries not valid');
    }
  }

  private buildUpdateFields(data: UpdateSocialAccountInput, isForAdmin: boolean): Partial<SocialAccount> {
    const updateFields: Partial<SocialAccount> = {};

    const bannedFields = [
      'influencerId',
      'accountId',
      'socialMedia',
      'price',
      'initialPrice',
      'currency',
    ];

    if (isForAdmin === false) {
      bannedFields.push('publicPrice');
    }

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && !bannedFields.includes(key)) {
        updateFields[key as keyof SocialAccount] = value as never;
      }
    }

    return updateFields;
  }

  private async handleInfluencerPriceChange(params: {
    data: UpdateSocialAccountInput;
    influencer: Influencer;
    socialAccount: SocialAccount;
    socialMedia: SocialMediaEnum;
    influencerId: ObjId;
    socialAccountId: ObjId;
    updateFields: Partial<SocialAccount>;
  }): Promise<void> {
    const {
      data,
      influencer,
      socialAccount,
      socialMedia,
      influencerId,
      socialAccountId,
      updateFields,
    } = params;
    if (!data.currency || !Object.values(CurrencyCode).includes(data.currency)) {
      throw new BadRequestException(
        `Currency for ${socialMedia} account ${socialAccount.username} is not valid. ` +
        `Try to use one of these: ${getAvailableCurrenciesLabel()}`,
      );
    }

    try {
      await this.createAdminRequestService.exec({
        requestType: RequestForAdminType.PRICE_UPDATE_REQUEST,
        payload: {
          influencerId: String(influencerId),
          influencerName: influencer.firstName ?? influencer.email,
          socialAccountId: String(socialAccountId),
          socialMedia: socialMedia,
          newPrice: data.price,
          currency: data.currency,
        },
      });

      updateFields.verifiedStatus = AccountVerifiedStatus.waitForAdmin as never;
      updateFields.labelStatus = SocialAccountLabelStatus.priceChanged as never;
    } catch (e) {
      this.logger.error(
        `Error creating price change request for ${socialMedia} account ${String(socialAccountId)}`,
        e instanceof Error ? e.stack : String(e),
      );

      if ((e as any)?.stack?.includes('duplicate key error collection')) {
        throw new ConflictException(
          "There's already an open price change request for this account.",
        );
      }

      throw new InternalServerErrorException(
        'Creating price change request failed. Try again later',
      );
    }

    try {
      const link = `${process.env.ADMIN_CLIENT}/dashboard/requests`;
      await this.emailService.send(
        InfluencerToAdminEmails.priceChangeRequest({
          influencerName: influencer.firstName,
          influencerEmail: influencer.email,
          accountUsername: socialAccount.username,
          accountSocialMedia: socialMedia,
          oldPrice: socialAccount.price,
          newPrice: data.price,
          currency: data.currency,
          acceptLink: link,
          declineLink: link,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Price change request for influencer ${influencerId} and ${socialMedia} social account ${socialAccountId} was created, but email failed`,
        err,
      );
    }
  }

  // Getting current initial price, current currency, requested initial price, requested currency
  // Returning parsed price, publicPrice, initialPrice, currency
  private async handleAdminPriceChange(params: {
    // currentInitialPrice: number; // current value of initialPrice in database
    requestedInitialPrice: number; // value of initialPrice from dto
    requestedCurrency: CurrencyCode; // value of currency from dto
  }): Promise<{
    price: number;
    publicPrice: number;
    initialPrice: number;
    currency: CurrencyCode;
  }> {
    this.logger.debug(`handleAdminPriceChange PAYLOAD: ${JSON.stringify(params, null, '\t')}`);
    
    const { requestedInitialPrice, requestedCurrency } = params;

    // if (currentInitialPrice === requestedInitialPrice) {
    //   return;
    // }

    const returnedValues = {
      price: 0,
      publicPrice: 0,
      initialPrice: 0,
      currency: CurrencyCode.EUR,
    };

    this.logger.debug(`handleAdminPriceChange input: ${JSON.stringify(params, null, '\t')}`);

    const exchangeRate = (await this.exchangeRateService.getRate(requestedCurrency ?? CurrencyCode.EUR, CurrencyCode.EUR)) ?? 1;
    const parsedPrice = Math.round(exchangeRate * requestedInitialPrice);

    returnedValues.price = parsedPrice;
    returnedValues.publicPrice = parsedPrice * 2;
    returnedValues.initialPrice = requestedInitialPrice;
    returnedValues.currency = requestedCurrency;

    this.logger.debug(`handleAdminPriceChange returnedValues: ${JSON.stringify(returnedValues, null, '\t')}`);

    return returnedValues;
  }

  private async updateSocialAccountInDb(params: {
    influencerId: ObjId;
    socialAccountId: ObjId;
    socialMedia: SocialMediaEnum;
    updateFields: Partial<SocialAccount>;
  }): Promise<void> {
    const { influencerId, socialAccountId, socialMedia, updateFields } = params;

    this.logger.debug(`updateSocialAccountInDb updateFields object: ${JSON.stringify(updateFields, null, '\t')}`);

    const updateResult = await this.influencerRepository.updateOne(
      {
        _id: influencerId,
        [`${socialMedia}._id`]: socialAccountId,
      },
      {
        $set: Object.fromEntries(
          Object.entries(updateFields).map(([key, value]) => [`${socialMedia}.$.${key}`, value]),
        ),
      },
    );

    if (updateResult.modifiedCount === 0) {
      throw new InternalServerErrorException('Failed to update social account');
    }
  }

  private async findUpdatedSocialAccount(params: {
    influencerId: ObjId;
    socialAccountId: ObjId;
    socialMedia: SocialMediaEnum;
  }): Promise<SocialAccount> {
    const { influencerId, socialAccountId, socialMedia } = params;

    const updatedInfluencer = await this.influencerRepository.findOne({
      _id: influencerId,
    });

    if (!updatedInfluencer) {
      throw new NotFoundException('Updated influencer not found');
    }

    const updatedAccount = updatedInfluencer[socialMedia]?.find(
      (acc: SocialAccount) => acc._id.toString() === socialAccountId.toString(),
    );

    if (!updatedAccount) {
      throw new NotFoundException('Updated social account not found');
    }

    return updatedAccount;
  }
}
