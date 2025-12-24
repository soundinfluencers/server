import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable, NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import {CreateClientDto} from './dto/create-client.dto';
import {CreateInfluencerDto, CreateSocialAccountDto} from './dto/create-influencer.dto';
import {ClientSession} from 'mongoose';
import {Types} from 'mongoose';
import {Response} from "express";
import sendMail from "../../integrations/nodemailer/nodemailer";
import {setRefreshTokenCookie} from "../../common/utils/cookie.util";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {VerifyClientRepository} from "../../database/repositories/verify-users/verify-client.repository";
import {VerifyInfluencerRepository} from "../../database/repositories/verify-users/verify-influencer.repository";
import {LoginDto, LoginResponseDto} from "./dto/login.dto";
import {SocialAccount} from "../../database/schemas/users/influencer.schema";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {getArrayFromAccountMusicGenres} from "../../common/utils/genres";

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
        private readonly verifyClientRepo: VerifyClientRepository,
        private readonly verifyInfluencerRepo: VerifyInfluencerRepository
    ) {
    }

    private readonly accessKey = process.env.JWT_SECRET;
    private readonly refreshKey = process.env.JWT_REFRESH_SECRET;

    // Signup client
    async createClient(data: CreateClientDto): Promise<void> {
        if (!data) throw new BadRequestException('Not enough arguments');

        const [existingEmailUser, existingInstagramUser, existingPhoneUser] = await Promise.all([
            this.influencerRepo.findInfluencerByEmail(data.email) ||
            this.clientRepo.findClientByEmail(data.email),
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

        try {
            const userId = new Types.ObjectId();
            await this.clientRepo.create({
                ...data,
                _id: userId,
                email: data.email.toLowerCase(),
                referenceNumber: generateRandomDigits(6),
                password: bcrypt.hashSync(data.password),
                balance: 0,
                isProposalClient: false,
                isAdmin: false,
            }, {session});

            const verifyId = new Types.ObjectId();
            await this.verifyClientRepo.create({
                _id: verifyId,
                clientId: userId,
            }, {session});

            await session.commitTransaction();
            session.endSession();

            await sendMail(
                process.env.EMAIL_USER,
                'SoundInfluencers',
                `<p>Request from a new client ${data.company}</p><b>Details:</b><br/><br/><p>First Name: ${data.firstName}</p>
        <p>Company: ${data.company}</p>
        <p>Company Type: ${data.companyType}</p>
        <p>Instagram: ${data.instagramUsername}</p>
        <p>Email: ${data.email}</p>
        <p>Phone: ${data.phone}</p>
        <p>Referal Code: ${data.referalCode}</p>
        <h2>Do you want to verify this account?</h2>
        <a href="${process.env.SERVER}/auth/verify/client?verifyId=${verifyId.toString()}&responseVerify=accept">ACCEPT</a>
        <a href="${process.env.SERVER}/auth/verify/client?verifyId=${verifyId.toString()}&responseVerify=cancel">CANCEL</a>
        `,
                'html',
            );
            await sendMail(
                data.email,
                'SoundInfluencers',
                `<p>Dear ${data.firstName},</p>
      <p>Hello,</p>
      <p>Thank you for submitting your account request. We will inform you of the outcome shortly.</p>
      <p>Best regards,</p>
      <p>The SoundInfluencers.com Team</p>`,
                'html',
            );
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            throw err;
        }
    }

    // Signup influencer
    async createInfluencer(data: CreateInfluencerDto): Promise<void> {
        if (!data) throw new BadRequestException('Not enough arguments');


        const checkUser =
            (await this.influencerRepo.exists({email: data.email})) ||
            (await this.clientRepo.exists({email: data.email}));

        if (checkUser) throw new ConflictException('User with this email already exists');

        const session: ClientSession = await this.influencerRepo.startSession();

        try {
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
                        `Existing username was used while creating new influencer: ${existingUser[network][0].username}`
                    );
                }
            }

            const processedData: { [key: string]: SocialAccount[] } = {};

            for (const network of socialNetworks) {
                const accounts = data[network] || [];

                processedData[network] = accounts.map((item: CreateSocialAccountDto): SocialAccount => {
                    const sanitizedPrice = parseFloat(String(item.price).replace(/[^\d.-]/g, '')) || 0;
                    const publicPrice = sanitizedPrice * 2;
                    const sanitizedInitialPrice = parseInt(String(item.initialPrice).replace(/[^\d.-]/g, '')) || 0;

                    return {
                        _id: new Types.ObjectId(),
                        username: item.username,
                        profileLink: item.profileLink,
                        followers: item.followers || 0,
                        logoUrl: item.logoUrl,
                        price: sanitizedPrice,
                        publicPrice: publicPrice,
                        initialPrice: sanitizedInitialPrice,
                        currency: item.currency ?? 'EUR',
                        profileCategory: item.profileCategory,
                        musicGenres: item.musicGenres ?? [],
                        creatorCategories: item.creatorCategories ?? [],
                        countries: item.countries ?? [],
                        categories: item.categories ?? [],
                        engagementRate: ['instagram', 'tiktok'].includes(network) ? 0 : null,
                        averageViews: ['instagram', 'tiktok'].includes(network) ? 0 : null,
                        isHidden: false,
                        isDeleted: false,
                        isVerified: true,
                    };
                });
            }

            const userId = new Types.ObjectId();
            await this.influencerRepo.create({
                ...data,
                ...processedData,
                _id: userId,
                email: data.email.toLowerCase(),
                password: bcrypt.hashSync(data.password),
                currencyNote: '',
            }, {session});

            const verifyId = new Types.ObjectId();
            await this.verifyInfluencerRepo.create({
                _id: verifyId,
                influencerId: userId,
            }, {session});

            await session.commitTransaction();
            session.endSession();

            await sendMail(
                process.env.EMAIL_USER,
                'SoundInfluencers',
                `<p>Request from a new partner ${data.firstName}</p>
            <b>Details:</b><br/><p>First Name: ${data.firstName}</p>
            <p>Email: ${data.email}</p>
            <p>Phone: ${data.phone}</p>
            <br/>
            ${socialNetworks
                    .map((network) =>
                        data[network]
                            ?.map(
                                (item, index) => `
                <p><strong>Network: ${network} (${index + 1} account)</strong></p>
                
            <ul>
            <li><strong>Username: ${item.username}</strong></li>
            <li><strong>Link: ${item.profileLink}</strong></li>
            <li><strong>Followers: ${item.followers}</strong></li>
            <li><strong>Logo: ${item.logoUrl}</strong></li>
            <li><strong>Music genres: ${getArrayFromAccountMusicGenres(item.musicGenres).join(', ')}</strong></li>
            <li><strong>Price: ${item.price}€</strong></li>
            <li><strong>Initial Price: ${item.initialPrice}</strong></li>
</ul>`,
                            )
                            .join(''),
                    )
                    .join('')}
            <h2>Do you want to verify your account?</h2>
            <a href="${process.env.SERVER}/auth/verify/influencer?verifyId=${verifyId.toString()}&responseVerify=accept">ACCEPT</a>
            <a href="${process.env.SERVER}/auth/verify/influencer?verifyId=${verifyId.toString()}&responseVerify=cancel">CANCEL</a>`,
                'html',
            );

            await sendMail(
                data.email,
                'SoundInfluencers',
                `<p>Dear ${data.firstName},</p>
            <p>Thank you for submitting your subscription request.</p>
            <p>We will send you an email with a status update shortly.</p>
            <p>Best regards,</p>
            <p>The SoundInfluencers Team</p>`,
                'html',
            );
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            throw err;
        }
    }

    // Login
    async login(dto: LoginDto, res: Response): Promise<LoginResponseDto> {
        const email = dto.email.toLowerCase();

        const user =
            (await this.influencerRepo.findInfluencerByEmail(email)) ||
            (await this.clientRepo.findClientByEmail(email));

        if (!user) throw new UnauthorizedException('User not found');

        const isPassword = await bcrypt.compare(dto.password, user.password);

        if (!isPassword) throw new UnauthorizedException('Wrong password');

        if (user.statusVerify === 'wait') throw new ForbiddenException('Account not verified');

        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);

        await this.saveRefreshToken(user._id, refreshToken);

        setRefreshTokenCookie(res, refreshToken);

        return {
            accessToken: accessToken,
            user: user
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
            throw new UnauthorizedException('Invalid refresh token');
        }

        const user =
            (await this.clientRepo.findById(payload.id)) ||
            (await this.influencerRepo.findById(payload.id));

        if (!user || (user as any).refreshToken !== refreshToken)
            throw new UnauthorizedException('Invalid refresh token');

        const newRefreshToken = this.generateRefreshToken(user);
        await this.saveRefreshToken(user.id, newRefreshToken);

        setRefreshTokenCookie(res, newRefreshToken);

        return {
            accessToken: this.generateAccessToken(user),
        };
    }

    // Logout
    async logout(refreshToken: string, res: Response) {
        if (refreshToken) {
            await this.clientRepo.updateOne(
                {refreshToken},
                {$unset: {refreshToken: ''}},
            );

            await this.influencerRepo.updateOne(
                {refreshToken},
                {$unset: {refreshToken: ''}},
            );
        }

        res.clearCookie('refreshToken', {path: '/auth/refresh'});
    }

    // Generates access token
    private generateAccessToken(user: any) {
        return jwt.sign(
            {_id: user._id, role: user.role},
            this.accessKey,
            {expiresIn: '15m'},
        );
    }

    // Generates refresh token
    private generateRefreshToken(user) {
        return jwt.sign(
            {_id: user._id},
            this.refreshKey,
            {expiresIn: '7d'},
        );
    }

    // Saves refresh token
    private async saveRefreshToken(userId, token) {
        await this.clientRepo.updateOne({_id: userId}, {refreshToken: token});
        await this.influencerRepo.updateOne({_id: userId}, {refreshToken: token});
    }

    // Verify influencer with sending mail
    async verifyAdminInfluencer(verifyId: string, responseVerify: string) {
        if (!verifyId || !responseVerify) throw new BadRequestException('Not enough arguments');

        const checkVerifyAdmin = await this.verifyInfluencerRepo.findOne({
            verifyId: verifyId,
        });

        if (!checkVerifyAdmin) throw new NotFoundException('Influencer not found');

        const checkInfluencer = await this.influencerRepo.findOne({
            _id: checkVerifyAdmin.influencerId,
        });

        if (!checkInfluencer) throw new NotFoundException('Influencer not found');

        if (responseVerify === 'accept') {
            await this.influencerRepo.findOneAndUpdate(
                {_id: checkInfluencer._id},
                {statusVerify: responseVerify},
            );

            await this.verifyInfluencerRepo.findOneAndDelete({verifyId: verifyId});

            sendMail(
                checkInfluencer.email,
                'SoundInfluencers',
                `<p>Dear ${checkInfluencer.firstName},</p>
        <p>Thank you for confirming your information with us. Your account details have been successfully verified.</p> 
        <p>You can now access your personal account by clicking on the link below:</p>
        <a href="${process.env.SERVER_CLIENT}/login/influencer" style="font-weight: 600">*Access Link*</a>
        <p>If you have any questions or encounter any issues, please don't hesitate to contact our support team or reply to this message.</p>
        <p>Best regards,</p>
        <p>SoundInfluencers team</p>`,
                'html',
            );
        } else if (responseVerify === 'cancel') {
            await this.influencerRepo.findOneAndUpdate(
                {_id: checkInfluencer._id},
                {statusVerify: responseVerify},
            );

            await this.verifyInfluencerRepo.findOneAndDelete({verifyId: verifyId});
            sendMail(
                checkInfluencer.email,
                'SoundInfluencers',
                `<p>Hi,</p>
      <p>thanks for the application!</p>
      <p>Unfortunately we're not sure there's a good fit for us right now.</p>
      <p>We suggest trying again in the future 🙂</p> 
      <p>Best Regards</p><p>SoundInfluencers Team</p>`,
                'html',
            );
        } else {
            throw new BadRequestException("Response can be 'accept' or 'cancel'")
        }
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
                {statusVerify: responseVerify},
            );

            await this.verifyClientRepo.findOneAndDelete({verifyId: verifyId});

            sendMail(
                checkClient.email,
                'SoundInfluencers',
                `<p>Dear ${checkClient.firstName},</p>
<p>Thank you for confirming your information with us. Your account details have been successfully verified.</p>
<p>You can now access your personal account by clicking on the link below:</p>
<a href="${process.env.SERVER_CLIENT}/login/client" style="font-weight: 600">*Access Link*</a>
<p>If you have any questions or encounter any issues, please don't hesitate to contact our support team or reply to this message.</p>
<p>Best regards,</p>
<p>SoundInfluencers team</p>`,
                'html',
            );
        } else if (responseVerify === 'cancel') {
            await this.clientRepo.findOneAndUpdate(
                {_id: checkClient._id},
                {statusVerify: responseVerify},
            );

            await this.verifyClientRepo.findOneAndDelete({verifyId: verifyId});
            sendMail(
                checkClient.email,
                'SoundInfluencers',
                `<p>Hi,</p>
      <p>thanks for the application!</p>
      <p>Unfortunately we're not sure there's a good fit for us right now.</p>
      <p>We suggest trying again in the future 🙂</p> 
      <p>Best Regards</p><p>SoundInfluencers Team</p>`,
                'html',
            );
        } else {
            throw new BadRequestException("Response can be 'accept' or 'cancel'");
        }
    }
}
