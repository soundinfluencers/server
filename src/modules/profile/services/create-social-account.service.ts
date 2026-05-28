import { AddSocialAccountDto } from '../dto/influencer/update-influencer.dto';
import { Influencer, SocialAccount } from '../../../database/schemas/users/influencer.schema';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { ExchangeRateService } from '../../../integrations/exchange-rate/exchange-rate.service';
// import {EmailService} from "../../../integrations/email/email.service";
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import {
  AdminCreateSocialAccountDto,
  CreateSocialAccountDto,
  MusicGenreDto,
} from '../../auth/dto/create-influencer.dto';
import { CurrencyCode, getAvailableCurrenciesLabel } from '../../../common/types/finance.types';
import { Types } from 'mongoose';
import { AccountVerifiedStatus } from '../../../common/types/user.types';
import { SocialAccountLabelStatus } from '../../../common/types/influencer/influencer.types';
import { areCountriesValid } from '../../../common/utils/countries.util';
import { getArrayFromAccountMusicGenres } from '../../../common/utils/genres';
import {
  CREATE_ADMIN_REQUEST_SERVICE,
  CreateAdminRequestService,
} from '../../admin/services/requests/create-admin-request.service';
import { RequestForAdminType } from '../../../common/types/request-for-admin/request-for-admin.types';

interface ICreateSocialAccountService {
  // Executes service and returns result
  execute<T>(
    data: AddSocialAccountDto,
    mapResult: (influencer: Influencer, account: SocialAccount) => T,
    isForAdmin?: boolean,
  ): Promise<T>;
}

@Injectable()
export class CreateSocialAccountService implements ICreateSocialAccountService {
  private readonly logger = new Logger('CreateSocialAccountService');

  constructor(
    private readonly influencerRepo: InfluencerRepository,
    private readonly exchangeRateService: ExchangeRateService,
    // private readonly emailService: EmailService,
    @Inject(CREATE_ADMIN_REQUEST_SERVICE)
    private readonly createAdminRequestService: CreateAdminRequestService,
  ) {}

  async execute<T>(
    data: AddSocialAccountDto,
    mapResult: (influencer: Influencer, account: SocialAccount) => T,
    isForAdmin = false,
  ): Promise<T> {
    const { influencerId, socialMedia, payload } = data;

    if (!influencerId) {
      throw new BadRequestException('Influencer id is missing');
    }
    if (!socialMedia) {
      throw new BadRequestException('Please select social media');
    }
    if (!payload) {
      throw new BadRequestException('Please provide payload');
    }

    const influencer = await this.findInfluencer(influencerId);

    // Validating
    if (!payload?.username) {
      throw new BadRequestException('Username is required');
    }
    if (!areCountriesValid(payload.countries)) {
      throw new BadRequestException('Countries not valid');
    }

    // Checking if account username already taken
    await this.checkDuplicate(socialMedia, payload.username);

    // Normalizing music genres and countries
    const normalized = this.normalizeGenresAndCountries(payload);

    // Calculating price
    const { price, publicPrice } = await this.calculatePrice(payload);

    // Building account object
    const account = this.buildAccount({
      payload,
      normalized,
      price,
      publicPrice,
      isForAdmin,
    });

    // Inserting new account into influencer's socialAccounts array
    influencer[socialMedia] = [...(influencer[socialMedia] ?? []), account];

    // Saving new account with transaction
    await this.saveWithTransaction(influencer);

    // Creating admin request when account added from influencer's side
    if (!isForAdmin) {
      await this.createAdminRequestSafe(influencer, account, data);
    }

    // Sending mails if account was created from influencer's side
    if (!isForAdmin) {
      await this.sendEmailSafe(account, data);
    }

    // Returning mapped result
    return mapResult(influencer, account);
  }

  // Find influencer
  private async findInfluencer(influencerId: string): Promise<Influencer> {
    if (!influencerId) {
      throw new BadRequestException('Influencer id is missing');
    }

    const influencer = await this.influencerRepo.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    return influencer;
  }

  // Check if username already taken
  private async checkDuplicate(socialMedia: SocialMediaEnum, username: string) {
    const duplicate = await this.influencerRepo.findOne({
      [`${socialMedia}.username`]: username,
    });

    if (duplicate) {
      throw new ConflictException({
        message: 'Username already exists',
        network: socialMedia,
        username,
      });
    }
  }

  // Normalize payload
  private normalizeGenresAndCountries(payload: CreateSocialAccountDto): {
    musicGenres: MusicGenreDto[];
    countries: { country: string; percentage: number }[];
  } {
    const musicGenres = Array.isArray(payload.musicGenres)
      ? payload.musicGenres.filter(Boolean)
      : [];

    const countries = Array.isArray(payload.countries)
      ? payload.countries
          .filter((c) => c?.country && typeof c.percentage === 'number')
          .map((c) => ({
            country: c.country,
            percentage: c.percentage,
          }))
      : [];

    return { musicGenres, countries };
  }

  // Calculate price
  private async calculatePrice(
    payload: CreateSocialAccountDto,
  ): Promise<{ price: number; publicPrice: number }> {
    if (!Object.values(CurrencyCode).includes(payload.currency)) {
      throw new BadRequestException(`Currency not valid. Use: ${getAvailableCurrenciesLabel()}`);
    }

    const rate =
      payload.currency !== CurrencyCode.EUR
        ? await this.exchangeRateService.getRate(payload.currency, 'EUR')
        : 1;

    const sanitized = parseFloat(String(payload.price).replace(/[^\d.-]/g, '')) || 0;

    const price = Math.round(sanitized * rate);
    const publicPrice = price * 2;

    return { price, publicPrice };
  }

  // Build account object
  private buildAccount(params: {
    payload: CreateSocialAccountDto | AdminCreateSocialAccountDto;
    normalized: any;
    price: number;
    publicPrice: number;
    isForAdmin: boolean;
  }): SocialAccount {
    const { payload, normalized, price, publicPrice, isForAdmin } = params;

    const engagementRate: number | null = isForAdmin
      ? ((payload as AdminCreateSocialAccountDto).engagementRate ?? null)
      : null;

    const averageViews: number | null = isForAdmin
      ? ((payload as AdminCreateSocialAccountDto).averageViews ?? null)
      : null;

    return {
      _id: new Types.ObjectId(),
      username: payload.username,
      profileLink: payload.profileLink,
      followers: payload.followers,
      logoUrl: payload.logoUrl,
      profileCategory: payload.profileCategory,

      ...(payload.profileCategory === 'creator' && {
        creatorCategories: payload.creatorCategories ?? [],
      }),

      price,
      publicPrice,
      initialPrice: payload.price,
      currency: payload.currency,

      musicGenres: normalized.musicGenres,
      countries: normalized.countries,
      categories: payload.categories,

      engagementRate: engagementRate,
      averageViews: averageViews,

      isHidden: false,
      isDeleted: false,

      verifiedStatus: isForAdmin
        ? AccountVerifiedStatus.accept
        : AccountVerifiedStatus.waitForAdmin,
      labelStatus: isForAdmin
        ? SocialAccountLabelStatus.accept
        : SocialAccountLabelStatus.waitForAdmin,
    };
  }

  // Transaction saving
  private async saveWithTransaction(influencer: Influencer): Promise<void> {
    const session = await this.influencerRepo.startSession();
    session.startTransaction();

    try {
      await influencer.save({ session, validateBeforeSave: false });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  private async createAdminRequestSafe(
    influencer: Influencer,
    account: SocialAccount,
    data: AddSocialAccountDto,
  ): Promise<void> {
    try {
      await this.createAdminRequestService.exec({
        requestType: RequestForAdminType.NEW_SOCIAL_ACCOUNT_REQUEST,
        payload: {
          influencerId: (influencer as any)._id.toString(),
          influencerName: influencer.firstName ?? influencer.email,
          socialAccountId: account._id.toString(),
          socialMedia: data.socialMedia,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Account ${account._id.toString()} added but admin request creation failed`,
        err,
      );
    }
  }

  // todo: refactor
  // Send email about new social account creation
  private async sendEmailSafe(account: SocialAccount, data: AddSocialAccountDto) {
    try {
      const socialMedia = data.socialMedia;
      let emailHtml = '';

      if (socialMedia === 'spotify' || socialMedia === 'soundcloud') {
        emailHtml = `
<ul>
    <li><strong>${socialMedia === 'spotify' ? 'Spotify playlist name' : 'SoundCloud account name'}:</strong> ${account.username}</li>
    <li><strong>Link:</strong> ${account.profileLink}</li>
    <li><strong>Followers:</strong> ${account.followers}</li>
    <li><strong>Logo:</strong> ${account.logoUrl}</li>
    <li><strong>Price:</strong> ${account.price}€</li>
    <li><strong>Initial price:</strong> ${account.initialPrice}€</li>
</ul>`;
      } else if (socialMedia === 'press') {
        emailHtml = `
<ul>
    <li><strong>Brand name:</strong> ${account.username}</li>
    <li><strong>Website:</strong> ${account.profileLink}</li>
    <li><strong>Visitors:</strong> ${account.followers}</li>
    <li><strong>Logo:</strong> ${account.logoUrl}</li>
    <li><strong>Music genres:</strong> ${getArrayFromAccountMusicGenres(account.musicGenres)?.join(', ') ?? ''}</li>
    <li><strong>Price:</strong> ${account.price}€</li>
    <li><strong>Initial price:</strong> ${account.initialPrice}€</li>
</ul>`;
      } else {
        emailHtml = `
<ul>
    <li><strong>Username:</strong> ${account.username}</li>
    <li><strong>Link:</strong> ${account.profileLink}</li>
    <li><strong>Followers:</strong> ${account.followers}</li>
    <li><strong>Logo:</strong> ${account.logoUrl}</li>
    <li><strong>Music genres:</strong> ${getArrayFromAccountMusicGenres(account.musicGenres)?.join(', ') ?? ''}</li>
    <li><strong>Price:</strong> ${account.price}€</li>
    <li><strong>Initial price:</strong> ${account.price}€</li>
</ul>`;
      }
    } catch (err) {
      this.logger.warn(`Account ${account._id.toString()} added but email failed`, err);
    }
  }
}
