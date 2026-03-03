import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import {CreateClientDto} from './dto/create-client.dto';
import {CreateInfluencerDto, CreateSocialAccountDto} from './dto/create-influencer.dto';
import {ClientSession, Types} from 'mongoose';
import {Response} from "express";
import {clearRefreshTokenCookie, setRefreshTokenCookie} from "../../common/utils/cookie.util";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {VerifyClientRepository} from "../../database/repositories/verify-users/verify-client.repository";
import {VerifyInfluencerRepository} from "../../database/repositories/verify-users/verify-influencer.repository";
import {GetMeResponseDto, LoginDto, LoginResponseDto} from "./dto/login.dto";
import {Influencer, SocialAccount} from "../../database/schemas/users/influencer.schema";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {normalizeDtoToMusicGenres} from "../../common/utils/genres";
import {AdminRepository} from "../../database/repositories/users/admin.repository";
import {AccountVerifiedStatus, Role} from "../../common/types/user.types";
import {Client} from "../../database/schemas/users/client.schema";
import {Admin} from "../../database/schemas/users/admin.schema";
import {areCountriesValid} from "../../common/utils/countries.util";
import {SocialAccountLabelStatus} from "../../common/types/influencer/influencer.types";
import {ExchangeRateService} from "../../integrations/exchange-rate/exchange-rate.service";
import {CurrencyCode, getAvailableCurrenciesLabel} from "../../common/types/finance.types";
import {EmailService} from "../../integrations/email/email.service";
import {AdminToInfluencerEmails, InfluencerToAdminEmails} from "../../integrations/email/email.templates";
import {mapCreateInfluencerToSignupEmailDto} from "../../integrations/email/mappers/profile-email.mapper";

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
        // For parsing currencies
        private readonly exchangeRateService: ExchangeRateService,
        // For sending emails
        private readonly emailService: EmailService
    ) {
    }

    private readonly logger = new Logger('AuthService');
    private readonly accessKey = process.env.JWT_SECRET;
    private readonly refreshKey = process.env.JWT_REFRESH_SECRET;

    // Signup client
    async createClient(data: CreateClientDto): Promise<void> {
        if (!data) throw new BadRequestException('Not enough arguments');

        const [existingEmailUser, existingInstagramUser, existingPhoneUser] = await Promise.all([
            this.influencerRepo.findInfluencerByEmail(data.email) ||
            this.clientRepo.findClientByEmail(data.email) ||
            this.adminRepo.findAdminByEmail(data.email),
            this.clientRepo.findClientByInstagramUsername(data.instagramUsername),
            data.phone
                ? this.influencerRepo.findOne({phone: data.phone}) ||
                this.clientRepo.findOne({phone: data.phone})
                : null,
        ]);

        if (existingEmailUser) throw new ConflictException('User with this email already exists');

        if (existingInstagramUser) throw new ConflictException('User with this instagram already exists');

        if (existingPhoneUser) throw new ConflictException('User with this phone number already exists');

        const session: ClientSession = await this.clientRepo.startSession();
        session.startTransaction();

        const userId = new Types.ObjectId();
        const verifyId = new Types.ObjectId();

        try {
            await this.clientRepo.create({
                ...data,
                _id: userId,
                role: Role.client,
                email: data.email.toLowerCase(),
                referenceNumber: generateRandomDigits(6),
                password: bcrypt.hashSync(data.password),
                balance: 0,
                isProposalClient: false,
                isAdmin: false,
            }, {session});

            await this.verifyClientRepo.create({
                _id: verifyId,
                clientId: userId,
            }, {session});

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }

        // try {
      //       await sendMail(
      //           process.env.EMAIL_USER,
      //           'SoundInfluencers',
      //           `<p>Request from a new client ${data.company}</p><b>Details:</b><br/><br/><p>First Name: ${data.firstName}</p>
      //   <p>Company: ${data.company}</p>
      //   <p>Company Type: ${data.companyType}</p>
      //   <p>Instagram: ${data.instagramUsername}</p>
      //   <p>Email: ${data.email}</p>
      //   <p>Phone: ${data.phone}</p>
      //   <p>Referal Code: ${data.referalCode}</p>
      //   <h2>Do you want to verify this account?</h2>
      //   <a href="${process.env.SERVER}/auth/verify/client?verifyId=${verifyId.toString()}&responseVerify=accept">ACCEPT</a>
      //   <a href="${process.env.SERVER}/auth/verify/client?verifyId=${verifyId.toString()}&responseVerify=cancel">CANCEL</a>
      //   `,
      //           'html',
      //       );
      //       await sendMail(
      //           data.email,
      //           'SoundInfluencers',
      //           `<p>Dear ${data.firstName},</p>
      // <p>Hello,</p>
      // <p>Thank you for submitting your account request. We will inform you of the outcome shortly.</p>
      // <p>Best regards,</p>
      // <p>The SoundInfluencers.com Team</p>`,
      //           'html',
      //       );
      //   } catch (err) {
      //       this.logger.warn(`Client ${userId.toString()} created but email failed`, err);
      //   }
    };

    // Signup influencer
    async createInfluencer(data: CreateInfluencerDto): Promise<void> {
        if (!data) throw new BadRequestException('Not enough arguments');

        const checkUser =
            (await this.influencerRepo.exists({email: data.email})) ||
            (await this.clientRepo.exists({email: data.email})) ||
            (await this.adminRepo.exists({email: data.email}));

        if (checkUser) throw new ConflictException('User with this email already exists');

        const socialNetworks = Object.values(SocialMediaEnum);

        for (const network of socialNetworks) {
            const accounts = data[network] || [];
            const usernames = accounts.map((item) => item.username);

            const networkFilter = {
                [`${network}.username`]: {$in: usernames},
                isDeleted: {$ne: true},
            };

            const existingUser = await this.influencerRepo.findOne(networkFilter);

            if (existingUser) {
                throw new ConflictException(
                    `Existing username was used while creating new influencer: ${existingUser[network][0].username}`
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
                            `Try to use one of these: ${getAvailableCurrenciesLabel()}`
                        );
                    }

                    const exchangeRate: number =
                        item.currency !== CurrencyCode.EUR
                            ? await this.exchangeRateService.getRate(
                                item.currency.toString(),
                                'EUR'
                            )
                            : 1;

                    const sanitizedPrice =
                        parseFloat(String(item.price).replace(/[^\d.-]/g, '')) || 0;

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
                        labelStatus: SocialAccountLabelStatus.new
                    };
                })
            );
        }

        const userId = new Types.ObjectId();
        const verifyId = new Types.ObjectId();

        const session: ClientSession = await this.influencerRepo.startSession();
        session.startTransaction();

        try {
            await this.influencerRepo.create({
                ...data,
                ...processedData,
                _id: userId,
                email: data.email.toLowerCase(),
                role: Role.influencer,
                password: bcrypt.hashSync(data.password),
                currencyNote: '',
            }, {session});

            await this.verifyInfluencerRepo.create({
                _id: verifyId,
                influencerId: userId,
            }, {session});

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
                    mapCreateInfluencerToSignupEmailDto(
                        data,
                        {
                            acceptLink: `${process.env.SERVER}/auth/verify/influencer?verifyId=${verifyId.toString()}&responseVerify=accept`,
                            declineLink: `${process.env.SERVER}/auth/verify/influencer?verifyId=${verifyId.toString()}&responseVerify=cancel`,
                            negotiateLink: ``
                        }
                    )
                )
            )

            // Auto-reply to influencer
            await this.emailService.send(AdminToInfluencerEmails.influencerSignupAutoReply(data.email?.trim()?.toLowerCase(), data.firstName?.trim()))
        } catch (err) {
            this.logger.warn(`Influencer ${userId.toString()} created but email failed`, err);
        }
    }

    // Login
    async login(dto: LoginDto, res: Response): Promise<LoginResponseDto> {
        const email = dto.email.toLowerCase().trim();

        let user: Client | Influencer | Admin = null;

        switch (dto.role) {
            case Role.client:
                user = await this.clientRepo.findClientByEmail(email);
                break;
            case Role.influencer:
                user = await this.influencerRepo.findInfluencerByEmail(email);
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

        if (![AccountVerifiedStatus.accept, AccountVerifiedStatus.waitForUser].includes(user.verifiedStatus)) throw new ForbiddenException('Account not verified by admin');

        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);

        await this.saveRefreshToken(user._id, refreshToken);

        setRefreshTokenCookie(res, refreshToken);

        if (AccountVerifiedStatus.waitForUser === user.verifiedStatus) {
            res.redirect(`${process.env.SERVER_CLIENT}/influencer/profile/agreement/:${user._id.toString()}`);
        }

        return {
            accessToken,
        };
    }

    // refresh and token replace
    async refresh(refreshToken: string, res: Response): Promise<{ accessToken: string }> {
        if (!refreshToken)
            throw new UnauthorizedException('No refresh token provided');

        let payload;
        try {
            payload = jwt.verify(refreshToken, this.refreshKey);
        } catch {
            clearRefreshTokenCookie(res);
            throw new UnauthorizedException('Invalid refresh token');
        }

        const user =
            (await this.clientRepo.findById(payload._id)) ||
            (await this.influencerRepo.findById(payload._id)) ||
            (await this.adminRepo.findById(payload._id));

        if (!user || (user as any).refreshToken !== refreshToken) {
            clearRefreshTokenCookie(res);
            throw new UnauthorizedException('Invalid refresh token');
        }

        const newRefreshToken = this.generateRefreshToken(user);
        await this.saveRefreshToken(user._id, newRefreshToken);

        setRefreshTokenCookie(res, newRefreshToken);

        return {
            accessToken: this.generateAccessToken(user),
        };
    }

    // Logout
    async logout(refreshToken: string, userRole: Role, res: Response) {
        if (refreshToken && userRole) {
            switch (userRole) {
                case Role.client:
                    await this.clientRepo.updateOne(
                        {refreshToken},
                        {$unset: {refreshToken: ''}},
                    );
                    break;
                case Role.influencer:
                    await this.influencerRepo.updateOne(
                        {refreshToken},
                        {$unset: {refreshToken: ''}},
                    );
                    break;
                case Role.admin:
                    await this.adminRepo.updateOne(
                        {refreshToken},
                        {$unset: {refreshToken: ''}},
                    );
                    break;
                default:
                    throw new BadRequestException('Unsupported role');
            }
            clearRefreshTokenCookie(res);
        } else {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    // Generates access token
    generateAccessToken(user: any) {
        return jwt.sign(
            {
                _id: user._id,
                role: user.role,
                ...(user.role === Role.client ? {isProposalClient: !!user.isProposalClient} : {}),
            },
            this.accessKey,
            {expiresIn: '30m'},
        );
    }

    // Generates refresh token
    generateRefreshToken(user) {
        return jwt.sign(
            {_id: user._id},
            this.refreshKey,
            {expiresIn: '7d'},
        );
    }

    // Saves refresh token
    async saveRefreshToken(userId, token) {
        await this.clientRepo.updateOne({_id: userId}, {refreshToken: token});
        await this.influencerRepo.updateOne({_id: userId}, {refreshToken: token});
        await this.adminRepo.updateOne({_id: userId}, {refreshToken: token});
    }

    // Verify influencer with sending mail
    async verifyAdminInfluencer(verifyId: string, responseVerify: string) {
        if (!verifyId || !responseVerify) throw new BadRequestException('Not enough arguments');
        if (!['accept', 'cancel'].includes(responseVerify)) throw new BadRequestException('Invalid response type');

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
                    {_id: new Types.ObjectId(checkInfluencer._id)},
                    {
                        $set: {
                            'verifiedStatus': AccountVerifiedStatus.waitForUser,
                            'instagram.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
                            'tiktok.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
                            'spotify.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
                            'soundcloud.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
                            'facebook.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
                            'youtube.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
                            'press.$[].verifiedStatus': AccountVerifiedStatus.waitForUser,
                        },
                    },
                    {session},
                );
            } else if (responseVerify === 'cancel') {
                await this.influencerRepo.updateOne(
                    {_id: new Types.ObjectId(checkInfluencer._id)},
                    {
                        $set: {
                            'verifiedStatus': AccountVerifiedStatus.decline,
                        },
                    },
                    {session},
                );
            }

            await this.verifyInfluencerRepo.findOneAndDelete({verifyId: verifyId}, {session});

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }

      //   try {
      //       switch (responseVerify) {
      //           case 'accept':
      //               await sendMail(
      //                   checkInfluencer.email,
      //                   'SoundInfluencers',
      //                   `<p>Dear ${checkInfluencer.firstName},</p>
      //   <p>Thank you for confirming your information with us. Your account details have been successfully verified.</p>
      //   <p>You can now access your personal account by clicking on the link below:</p>
      //   <a href="${process.env.SERVER_CLIENT}/influencer/profile/agreement/${checkInfluencer._id}" style="font-weight: 600">*Access Link*</a>
      //   <p>If you have any questions or encounter any issues, please don't hesitate to contact our support team or reply to this message.</p>
      //   <p>Best regards,</p>
      //   <p>SoundInfluencers team</p>`,
      //                   'html',
      //               );
      //               break;
      //           case 'cancel':
      //               await sendMail(
      //                   checkInfluencer.email,
      //                   'SoundInfluencers',
      //                   `<p>Hi,</p>
      // <p>thanks for the application!</p>
      // <p>Unfortunately we're not sure there's a good fit for us right now.</p>
      // <p>We suggest trying again in the future 🙂</p>
      // <p>Best Regards</p><p>SoundInfluencers Team</p>`,
      //                   'html',
      //               );
      //               break;
      //           default:
      //               break;
      //       }
      //   } catch (err) {
      //       this.logger.warn(`Influencer ${checkVerifyAdmin.influencerId} was verified but failed email`, err);
      //   }
    }

    // Verify client with sending mail
    async verifyAdminClient(verifyId: string, responseVerify: string) {
        if (!verifyId || !responseVerify) throw new BadRequestException('Not enough arguments');

        const checkVerifyAdmin = await this.verifyClientRepo.findOne({
            verifyId: verifyId,
        });

        if (!checkVerifyAdmin) throw new NotFoundException('Client not found');

        const checkClient = await this.clientRepo.findOne({
            _id: checkVerifyAdmin.clientId,
        });

        if (!checkClient) throw new NotFoundException('Client not found');

        if (responseVerify === 'accept') {
            await this.clientRepo.findOneAndUpdate(
                {_id: checkClient._id},
                {verifiedStatus: AccountVerifiedStatus.accept},
            );

            await this.verifyClientRepo.findOneAndDelete({verifyId: verifyId});

            // await sendMail(
            //     checkClient.email,
            //     'SoundInfluencers',
            //     `<p>Dear ${checkClient.firstName},</p>
// <p>Thank you for confirming your information with us. Your account details have been successfully verified.</p>
// <p>You can now access your personal account by clicking on the link below:</p>
// <a href="${process.env.SERVER_CLIENT}/login/client" style="font-weight: 600">*Access Link*</a>
// <p>If you have any questions or encounter any issues, please don't hesitate to contact our support team or reply to this message.</p>
// <p>Best regards,</p>
// <p>SoundInfluencers team</p>`,
//                 'html',
//             );
        } else if (responseVerify === 'cancel') {
            await this.clientRepo.findOneAndUpdate(
                {_id: checkClient._id},
                {verifiedStatus: AccountVerifiedStatus.decline},
            );

            await this.verifyClientRepo.findOneAndDelete({verifyId: verifyId});
            // await sendMail(
            //     checkClient.email,
            //     'SoundInfluencers',
             // send email about declining account
        } else {
            throw new BadRequestException("Response can be 'accept' or 'cancel'");
        }
    }

    // Returns current user info (same with login response but without accessToken)
    async getMe(userId: string, userRole: Role, res: Response): Promise<GetMeResponseDto> {
        let user: Client | Influencer;
        switch (userRole) {
            case Role.client:
                user = await this.clientRepo.findById(userId)
                break;
            case Role.influencer:
                user = await this.influencerRepo.findById(userId);
                break;
            default:
                throw new BadRequestException('Unsupported role');
        }

        if (!user) throw new UnauthorizedException('User not found');

        if (![AccountVerifiedStatus.accept, AccountVerifiedStatus.waitForUser].includes(user.verifiedStatus)) {
            clearRefreshTokenCookie(res);
            throw new ForbiddenException('Account not verified')
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

                const needAgreementRedirect = accounts?.some((acc: SocialAccount) => acc.verifiedStatus === AccountVerifiedStatus.waitForUser && acc.labelStatus === SocialAccountLabelStatus.new);

                if (needAgreementRedirect) {
                    dataToReturn.needAgreementRedirect = true;
                    break;
                }
            }
        }

        return dataToReturn;
    }
}
