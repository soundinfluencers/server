import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateInfluencerDto, CreateSocialAccountDto } from './dto/create-influencer.dto';
import { ClientSession, Types } from 'mongoose';
import { Response } from 'express';
import { clearRefreshTokenCookie, setRefreshTokenCookie } from '../../common/utils/cookie.util';
import { ClientRepository } from '../../database/repositories/users/client.repository';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import { VerifyClientRepository } from '../../database/repositories/verify-users/verify-client.repository';
import { VerifyInfluencerRepository } from '../../database/repositories/verify-users/verify-influencer.repository';
import { GetMeResponseDto, LoginDto, LoginResponseDto } from './dto/login.dto';
import { Influencer, SocialAccount } from '../../database/schemas/users/influencer.schema';
import { SocialMediaEnum } from '../../common/types/social-media.types';
import { normalizeDtoToMusicGenres } from '../../common/utils/genres';
import { AdminRepository } from '../../database/repositories/users/admin.repository';
import { AccountVerifiedStatus, Role } from '../../common/types/user.types';
import { Client } from '../../database/schemas/users/client.schema';
import { Admin } from '../../database/schemas/users/admin.schema';
import { areCountriesValid } from '../../common/utils/countries.util';
import { SocialAccountLabelStatus } from '../../common/types/influencer/influencer.types';
import { ExchangeRateService } from '../../integrations/exchange-rate/exchange-rate.service';
import { CurrencyCode, getAvailableCurrenciesLabel } from '../../common/types/finance.types';
import { EmailService } from '../../integrations/email/email.service';
import {
  AdminToClientEmails,
  AdminToInfluencerEmails,
  ClientToAdminEmails,
  InfluencerToAdminEmails,
} from '../../integrations/email/email.templates';
import { mapCreateInfluencerToSignupEmailDto } from '../../integrations/email/mappers/profile-email.mapper';
import { ObjId } from '../../common/types/base.types';
import { AuthSessionRepository } from '../../database/repositories/auth/auth-session.repository';
import {
  CREATE_ADMIN_REQUEST_SERVICE,
  CreateAdminRequestService,
} from '../admin/services/requests/create-admin-request.service';
import { RequestForAdminType } from '../../common/types/request-for-admin/request-for-admin.types';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

type AuthUser = Client | Influencer | Admin;

type RefreshTokenPayload = {
  sub: string;
  sid: string;
  role: Role;
  jti: string;
  _id?: string;
  iat?: number;
  exp?: number;
};

type LoginSessionContext = {
  userAgent?: string;
  ipAddress?: string;
};

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateRandomDigits(length) {
  const result = [];
  for (let i = 0; i < length; i++) {
    const randomDigit = Math.floor(Math.random() * 10);
    result.push(randomDigit);
  }
  return result.join('');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly clientRepo: ClientRepository,
    private readonly influencerRepo: InfluencerRepository,
    private readonly adminRepo: AdminRepository,
    private readonly verifyClientRepo: VerifyClientRepository,
    private readonly verifyInfluencerRepo: VerifyInfluencerRepository,
    private readonly authSessionRepo: AuthSessionRepository,
    // For parsing currencies
    private readonly exchangeRateService: ExchangeRateService,
    // For sending emails
    private readonly emailService: EmailService,
    @Inject(CREATE_ADMIN_REQUEST_SERVICE)
    private readonly createAdminRequestService: CreateAdminRequestService,
  ) {}

  private readonly logger = new Logger('AuthService');
  private readonly accessKey = process.env.JWT_SECRET;
  private readonly refreshKey = process.env.JWT_REFRESH_SECRET;

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isRefreshTokenMatch(
    storedTokenHash: string | null | undefined,
    refreshToken: string,
  ): boolean {
    if (!storedTokenHash) return false;

    const incomingTokenHash = this.hashToken(refreshToken);

    if (storedTokenHash.length !== incomingTokenHash.length) return false;

    return timingSafeEqual(Buffer.from(storedTokenHash), Buffer.from(incomingTokenHash));
  }

  private async getUserByRole(userId: string, role: Role): Promise<AuthUser | null> {
    switch (role) {
      case Role.client:
        return this.clientRepo.findById(userId);
      case Role.influencer:
        return this.influencerRepo.findById(userId);
      case Role.admin:
        return this.adminRepo.findById(userId);
      default:
        throw new BadRequestException('Unsupported role');
    }
  }

  private getRefreshTokenExpiresAt(): Date {
    return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  }

  private async revokeInvalidRefreshToken(
    sessionId: string | undefined,
    res: Response,
  ): Promise<never> {
    if (sessionId) {
      await this.authSessionRepo.revokeById(sessionId);
    }

    clearRefreshTokenCookie(res);
    throw new UnauthorizedException('Invalid refresh token');
  }

  async issueAuthTokens(
    user: AuthUser,
    res: Response,
    context: LoginSessionContext & {
      sessionId?: string;
    } = {},
  ): Promise<LoginResponseDto> {
    const sessionId = context.sessionId ?? new Types.ObjectId().toString();
    const refreshTokenId = randomUUID();
    const refreshToken = this.generateRefreshToken(user, sessionId, refreshTokenId);
    const accessToken = this.generateAccessToken(user, sessionId);
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAt();

    if (context.sessionId) {
      const updatedSession = await this.authSessionRepo.rotateRefreshToken(
        sessionId,
        refreshTokenHash,
        refreshTokenId,
        expiresAt,
      );

      if (!updatedSession) {
        clearRefreshTokenCookie(res);
        throw new UnauthorizedException('Invalid session');
      }
    } else {
      await this.authSessionRepo.create({
        _id: new Types.ObjectId(sessionId),
        userId: user._id,
        role: user.role,
        refreshTokenHash,
        refreshTokenId,
        expiresAt,
        revokedAt: null,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        lastSeenAt: new Date(),
      });
    }

    setRefreshTokenCookie(res, refreshToken);

    return { accessToken };
  }

  private ensureUserCanAuthenticate(user: AuthUser, res?: Response) {
    if (
      ![AccountVerifiedStatus.accept, AccountVerifiedStatus.waitForUser].includes(
        user.verifiedStatus,
      )
    ) {
      if (res) {
        clearRefreshTokenCookie(res);
      }

      throw new ForbiddenException('Account not verified by admin');
    }
  }

  // Signup client
  async createClient(data: CreateClientDto): Promise<void> {
    if (!data) throw new BadRequestException('Not enough arguments');

    const [existingEmailUser, existingInstagramUser, existingPhoneUser] = await Promise.all([
      this.influencerRepo.findInfluencerByEmail(data.email) ||
        this.clientRepo.findClientByEmail(data.email) ||
        this.adminRepo.findAdminByEmail(data.email),
      this.clientRepo.findClientByInstagramUsername(data.instagramUsername),
      data.phone
        ? this.influencerRepo.findOne({ phone: data.phone }) ||
          this.clientRepo.findOne({ phone: data.phone })
        : null,
    ]);

    if (existingEmailUser) throw new ConflictException('User with this email already exists');

    if (existingInstagramUser)
      throw new ConflictException('User with this instagram already exists');

    if (existingPhoneUser)
      throw new ConflictException('User with this phone number already exists');

    const session: ClientSession = await this.clientRepo.startSession();
    session.startTransaction();

    const userId = new Types.ObjectId();
    const verifyId = new Types.ObjectId();

    try {
      await this.clientRepo.create(
        {
          ...data,
          _id: userId,
          role: Role.client,
          email: data.email.toLowerCase(),
          referenceNumber: generateRandomDigits(6),
          password: bcrypt.hashSync(data.password),
          balance: 0,
          isProposalClient: false,
          isAdmin: false,
        },
        { session },
      );

      await this.verifyClientRepo.create(
        {
          _id: verifyId,
          clientId: userId,
        },
        { session },
      );

      await this.createAdminRequestService.exec({
        requestType: RequestForAdminType.NEW_CLIENT_REQUEST,
        session,
        payload: {
          clientId: userId.toString(),
          clientName: data.firstName,
        },
      });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    try {
      await this.emailService.send(
        ClientToAdminEmails.clientSignup({
          email: data.email.trim(),
          acceptLink: `${process.env.ADMIN_CLIENT}/dashboard/requests`,
          declineLink: `${process.env.ADMIN_CLIENT}/dashboard/requests`,
        }),
      );
    } catch (err) {
      this.logger.warn(`Client ${userId.toString()} created but email failed`, err);
    }
  }

  // Signup influencer
  async createInfluencer(data: CreateInfluencerDto): Promise<void> {
    const checkUser =
      (await this.influencerRepo.exists({ email: data.email })) ||
      (await this.clientRepo.exists({ email: data.email })) ||
      (await this.adminRepo.exists({ email: data.email }));

    if (checkUser) throw new ConflictException('User with this email already exists');

    const socialNetworks = Object.values(SocialMediaEnum);

    for (const network of socialNetworks) {
      const accounts = data[network] || [];
      const usernames = accounts.map((item) => item.username);

      const networkFilter = {
        [`${network}.username`]: { $in: usernames },
        isDeleted: { $ne: true },
      };

      const existingUser = await this.influencerRepo.findOne(networkFilter);

      if (existingUser) {
        throw new ConflictException(
          `Existing username was used while creating new influencer: ${existingUser[network][0].username}`,
        );
      }
    }

    const processedData: { [key: string]: SocialAccount[] } = {};

    // cycle for proceeding each social media accounts list
    for (const network of socialNetworks) {
      const accounts = data[network] || [];

      processedData[network] = await Promise.all(
        accounts.map(async (item: CreateSocialAccountDto): Promise<SocialAccount> => {
          if (!areCountriesValid(item.countries)) {
            throw new BadRequestException('Countries not valid');
          }

          if (!Object.values(CurrencyCode).includes(item.currency)) {
            throw new BadRequestException(
              `Currency for ${network} account ${item.username} is not valid. ` +
                `Try to use one of these: ${getAvailableCurrenciesLabel()}`,
            );
          }

          const exchangeRate: number =
            item.currency !== CurrencyCode.EUR
              ? await this.exchangeRateService.getRate(item.currency.toString(), 'EUR')
              : 1;

          const sanitizedPrice = parseFloat(String(item.price).replace(/[^\d.-]/g, '')) || 0;

          const price = Math.round(sanitizedPrice * exchangeRate);
          const publicPrice = price * 2;

          return {
            _id: new Types.ObjectId(),
            username: item.username,
            profileLink: item.profileLink,
            followers: item.followers ?? 0,
            logoUrl: item.logoUrl,
            price,
            publicPrice,
            initialPrice: sanitizedPrice,
            currency: item.currency,
            profileCategory: item.profileCategory,
            musicGenres: normalizeDtoToMusicGenres(item.musicGenres) ?? [],
            creatorCategories: item.creatorCategories ?? [],
            countries: item.countries ?? [],
            categories: item.categories ?? [],
            engagementRate: null,
            averageViews: null,
            isHidden: false,
            isDeleted: false,
            verifiedStatus: AccountVerifiedStatus.waitForAdmin,
            labelStatus: SocialAccountLabelStatus.waitForAdmin,
          };
        }),
      );
    }

    const userId = new Types.ObjectId();
    const verifyId = new Types.ObjectId();

    const session: ClientSession = await this.influencerRepo.startSession();
    session.startTransaction();

    try {
      await this.influencerRepo.create(
        {
          ...data,
          ...processedData,
          _id: userId,
          email: data.email.toLowerCase(),
          role: Role.influencer,
          password: bcrypt.hashSync(data.password),
          currencyNote: '',
        },
        { session },
      );

      await this.verifyInfluencerRepo.create(
        {
          _id: verifyId,
          influencerId: userId,
        },
        { session },
      );

      await this.createAdminRequestService.exec({
        requestType: RequestForAdminType.NEW_INFLUENCER_REQUEST,
        session,
        payload: {
          influencerId: userId.toString(),
          influencerName: data.firstName,
        },
      });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    try {
      // Send email to admin with verify links
      await this.emailService.send(
        InfluencerToAdminEmails.influencerSignup(
          mapCreateInfluencerToSignupEmailDto(data, {
            acceptLink: `${process.env.ADMIN_CLIENT}/dashboard/requests`,
            declineLink: `${process.env.ADMIN_CLIENT}/dashboard/requests`,
            negotiateLink: ``,
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(`Influencer ${userId.toString()} created but email failed`, err);
    }
  }

  // Login
  async login(
    dto: LoginDto,
    res: Response,
    context: LoginSessionContext = {},
  ): Promise<LoginResponseDto> {
    const email = dto.email.toLowerCase().trim();

    let user: Client | Influencer | Admin = null;

    switch (dto.role) {
      case Role.client:
        user = await this.clientRepo.findClientByEmail(email);
        if (!user) {
          user = await this.influencerRepo.findInfluencerByEmail(email);
        }
        break;
      case Role.influencer:
        user = await this.influencerRepo.findInfluencerByEmail(email);
        if (!user) {
          user = await this.clientRepo.findClientByEmail(email);
        }
        break;
      case Role.admin:
        user = await this.adminRepo.findAdminByEmail(email);
        break;
      default:
        throw new BadRequestException('Unsupported role');
    }

    if (!user) throw new UnauthorizedException('User not found');

    const isPassword = await bcrypt.compare(dto.password, user.password);

    if (!isPassword) throw new UnauthorizedException('Wrong password');

    this.ensureUserCanAuthenticate(user);

    return this.issueAuthTokens(user, res, context);
  }

  // refresh and token replace
  async refresh(refreshToken: string, res: Response): Promise<{ accessToken: string }> {
    if (!refreshToken) throw new UnauthorizedException('No refresh token provided');

    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(refreshToken, this.refreshKey) as RefreshTokenPayload;
    } catch {
      clearRefreshTokenCookie(res);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = payload?.sub ?? payload?._id;
    const sessionId = payload?.sid;

    if (!userId || !sessionId || !payload.role || !payload.jti) {
      clearRefreshTokenCookie(res);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.getUserByRole(userId, payload.role);

    if (!user) {
      clearRefreshTokenCookie(res);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.authSessionRepo.findActiveForUser(sessionId, userId, payload.role);

    if (!session) {
      clearRefreshTokenCookie(res);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (
      session.refreshTokenId !== payload.jti ||
      !this.isRefreshTokenMatch(session.refreshTokenHash, refreshToken)
    ) {
      await this.revokeInvalidRefreshToken(sessionId, res);
    }

    this.ensureUserCanAuthenticate(user, res);

    return this.issueAuthTokens(user, res, { sessionId });
  }

  // Logout
  async logout(refreshToken: string | undefined, res: Response): Promise<void> {
    clearRefreshTokenCookie(res);

    if (!refreshToken) {
      return;
    }

    try {
      const payload = jwt.verify(refreshToken, this.refreshKey) as RefreshTokenPayload;

      const sessionId = payload?.sid;

      if (!sessionId) {
        return;
      }

      await this.authSessionRepo.revokeById(sessionId);
    } catch {
      return;
    }
  }

  // Generates access token
  generateAccessToken(user: AuthUser, sessionId: string) {
    const clientUser = user.role === Role.client ? (user as Client) : null;
    const userId = user._id.toString();

    return jwt.sign(
      {
        sub: userId,
        sid: sessionId,
        _id: userId,
        role: user.role,
        ...(clientUser ? { isProposalClient: !!clientUser.isProposalClient } : {}),
      },
      this.accessKey,
      { expiresIn: '30m' },
    );
  }

  // Generates refresh token
  generateRefreshToken(user: AuthUser, sessionId: string, jti: string = randomUUID()) {
    const userId = user._id.toString();

    return jwt.sign(
      {
        sub: userId,
        sid: sessionId,
        _id: userId,
        role: user.role,
        jti,
      },
      this.refreshKey,
      { expiresIn: '7d' },
    );
  }

  // Verify influencer with sending mail
  async verifyAdminInfluencer(verifyId: string, responseVerify: string) {
    if (!verifyId || !responseVerify) throw new BadRequestException('Not enough arguments');
    if (!['accept', 'cancel'].includes(responseVerify))
      throw new BadRequestException('Invalid response type');

    const checkVerifyAdmin = await this.verifyInfluencerRepo.findById(verifyId);

    if (!checkVerifyAdmin) throw new NotFoundException('Verify influencer document not found');

    const checkInfluencer = await this.influencerRepo.findOne({
      _id: checkVerifyAdmin.influencerId,
    });

    if (!checkInfluencer) throw new NotFoundException('Influencer not found');

    const session = await this.influencerRepo.startSession();
    session.startTransaction();

    try {
      if (responseVerify === 'accept') {
        await this.influencerRepo.updateOne(
          { _id: new Types.ObjectId(checkInfluencer._id) },
          {
            $set: {
              verifiedStatus: AccountVerifiedStatus.waitForUser,
              'instagram.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
              'tiktok.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
              'spotify.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
              'soundcloud.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
              'facebook.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
              'youtube.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
              'press.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
              'instagram.$[].labelStatus': AccountVerifiedStatus.waitForUser,
              'tiktok.$[].labelStatus': AccountVerifiedStatus.waitForUser,
              'spotify.$[].labelStatus': AccountVerifiedStatus.waitForUser,
              'soundcloud.$[].labelStatus': AccountVerifiedStatus.waitForUser,
              'facebook.$[].labelStatus': AccountVerifiedStatus.waitForUser,
              'youtube.$[].labelStatus': AccountVerifiedStatus.waitForUser,
              'press.$[].labelStatus': AccountVerifiedStatus.waitForUser,
            },
          },
          { session },
        );
      } else if (responseVerify === 'cancel') {
        await this.influencerRepo.updateOne(
          { _id: new Types.ObjectId(checkInfluencer._id) },
          {
            $set: {
              verifiedStatus: AccountVerifiedStatus.decline,
              'instagram.$[].verifiedStatus': AccountVerifiedStatus.decline,
              'tiktok.$[].verifiedStatus': AccountVerifiedStatus.decline,
              'spotify.$[].verifiedStatus': AccountVerifiedStatus.decline,
              'soundcloud.$[].verifiedStatus': AccountVerifiedStatus.decline,
              'facebook.$[].verifiedStatus': AccountVerifiedStatus.decline,
              'youtube.$[].verifiedStatus': AccountVerifiedStatus.decline,
              'press.$[].verifiedStatus': AccountVerifiedStatus.decline,
              'instagram.$[].labelStatus': AccountVerifiedStatus.decline,
              'tiktok.$[].labelStatus': AccountVerifiedStatus.decline,
              'spotify.$[].labelStatus': AccountVerifiedStatus.decline,
              'soundcloud.$[].labelStatus': AccountVerifiedStatus.decline,
              'facebook.$[].labelStatus': AccountVerifiedStatus.decline,
              'youtube.$[].labelStatus': AccountVerifiedStatus.decline,
              'press.$[].labelStatus': AccountVerifiedStatus.decline,
            },
          },
          { session },
        );
      }

      await this.verifyInfluencerRepo.findOneAndDelete({ verifyId: verifyId }, { session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    try {
      switch (responseVerify) {
        case 'accept':
          await this.emailService.send(
            AdminToInfluencerEmails.influencerApproved(checkInfluencer.email, {
              firstName: checkInfluencer.firstName ?? checkInfluencer.email,
            }),
          );
          break;
        case 'cancel':
          await this.emailService.send(
            AdminToInfluencerEmails.influencerDeclined(checkInfluencer.email, {
              firstName: checkInfluencer.firstName ?? checkInfluencer.email,
            }),
          );
          break;
        default:
          break;
      }
    } catch (err) {
      this.logger.warn(
        `Influencer ${checkVerifyAdmin.influencerId} was verified but failed email`,
        err,
      );
    }
  }

  // Verify client with sending mail
  async verifyAdminClient(verifyId: string, responseVerify: string) {
    if (!verifyId || !responseVerify) throw new BadRequestException('Not enough arguments');

    const checkVerifyAdmin = await this.verifyClientRepo.findOne({
      _id: new ObjId(verifyId),
    });

    if (!checkVerifyAdmin) throw new NotFoundException('Client not found');

    const checkClient = await this.clientRepo.findOne({
      _id: checkVerifyAdmin.clientId,
    });

    if (!checkClient) throw new NotFoundException('Client not found');

    if (responseVerify === 'accept') {
      await this.clientRepo.findOneAndUpdate(
        { _id: checkClient._id },
        { verifiedStatus: AccountVerifiedStatus.accept },
      );

      await this.verifyClientRepo.findOneAndDelete({ verifyId: verifyId });

      await this.emailService.send(
        AdminToClientEmails.clientApproved(checkClient.email, {
          firstName: checkClient.firstName ?? checkClient.email,
          dashboardUrl: `${process.env.SERVER_CLIENT}`,
        }),
      );
    } else if (responseVerify === 'cancel') {
      await this.clientRepo.findOneAndUpdate(
        { _id: checkClient._id },
        { verifiedStatus: AccountVerifiedStatus.decline },
      );

      await this.verifyClientRepo.findOneAndDelete({ verifyId: verifyId });

      await this.emailService.send(
        AdminToClientEmails.clientDeclined(checkClient.email, {
          firstName: checkClient.firstName ?? checkClient.email,
        }),
      );
    } else {
      throw new BadRequestException("Response can be 'accept' or 'cancel'");
    }
  }

  // Returns current user info (same with login response but without accessToken)
  async getMe(userId: string, userRole: Role, res: Response): Promise<GetMeResponseDto> {
    let user: Client | Influencer | Admin;
    switch (userRole) {
      case Role.client:
        user = await this.clientRepo.findById(userId);
        break;
      case Role.influencer:
        user = await this.influencerRepo.findById(userId);
        break;
      case Role.admin:
        user = await this.adminRepo.findById(userId);
        break;
      default:
        throw new BadRequestException('Unsupported role');
    }

    if (!user) throw new UnauthorizedException('User not found');

    if (
      ![AccountVerifiedStatus.accept, AccountVerifiedStatus.waitForUser].includes(
        user.verifiedStatus,
      )
    ) {
      clearRefreshTokenCookie(res);
      throw new ForbiddenException('Account not verified');
    }

    let dataToReturn: GetMeResponseDto = {
      firstName: user.firstName,
      role: user.role as Role,
      verifiedStatus: user.verifiedStatus as AccountVerifiedStatus,
      balance: (user as any).balance ?? undefined,
      logoUrl: (user as any).logoUrl ?? undefined,
    };

    if (user.role === Role.influencer) {
      for (const key of Object.values(SocialMediaEnum) as SocialMediaEnum[]) {
        const accounts = (user as Influencer)[key] as SocialAccount[] | undefined;
        if (!accounts?.length) continue;

        const needAgreementRedirect = accounts?.some(
          (acc: SocialAccount) => acc.verifiedStatus === AccountVerifiedStatus.waitForUser,
        );

        if (needAgreementRedirect) {
          dataToReturn.needAgreementRedirect = true;
          break;
        }
      }
    }

    return dataToReturn;
  }
}
