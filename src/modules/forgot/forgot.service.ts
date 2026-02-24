import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable, InternalServerErrorException, Logger,
    NotFoundException
} from '@nestjs/common';
import sendMail from "../../integrations/nodemailer/nodemailer";
import {Client} from "../../database/schemas/users/client.schema";
import {Influencer} from "../../database/schemas/users/influencer.schema";
import {ForgotRepository} from "./repositories/forgot.repository";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {ObjId} from "../../common/types/base.types";
import {EmailService} from "../email/email.service";
import {Role} from "../../common/types/user.types";

const bcrypt = require('bcryptjs');

function generateFourDigitCode() {
    const code = Math.floor(Math.random() * 9000) + 1000;
    return String(code);
}

function generateRandomPassword() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';

    for (let i = 0; i < 8; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        password += characters.charAt(randomIndex);
    }

    return password;
}

@Injectable()
export class ForgotService {
    constructor(
        private readonly forgotRepo: ForgotRepository,
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
        private readonly emailService: EmailService
    ) {
    }

    private readonly logger = new Logger('ForgotService');

    // FIRST STEP: creates request for resetting password and sends email with code
    async createResetPasswordRequest(email: string, role: Role) {
        let user: Client | Influencer = undefined;

        switch (role) {
            case Role.client:
                user = await this.clientRepo.findClientByEmail(email.trim().toLowerCase());
                break;
            case Role.influencer:
                user = await this.influencerRepo.findInfluencerByEmail(email.trim().toLowerCase());
                break;
            default:
                throw new BadRequestException('Unsupported role');
        }

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const checkForgot = await this.forgotRepo.exists({
            userId: user._id,
            userRole: user.role
        });

        if (checkForgot) {
            throw new ConflictException('Reset code already sent. Please check your email or try again later.');
        }

        const code = generateFourDigitCode();
        await this.forgotRepo.create(
            {
                _id: new ObjId(),
                userId: user._id,
                userRole: user.role,
                code: code,
            },
        );

        await this.emailService.sendForgotPasswordEmail({
            userFirstName: user.firstName,
            email: email,
            code: code,
        })
    }

    // SECOND STEP: checks code, sets new auto-generated password and sends email with it
    async closeResetPasswordRequest(email: string, role: Role, code: string) {
        let user: Client | Influencer = undefined;

        switch (role) {
            case Role.client:
                user = await this.clientRepo.findClientByEmail(email.trim().toLowerCase());
                break;
            case Role.influencer:
                user = await this.influencerRepo.findInfluencerByEmail(email.trim().toLowerCase());
                break;
            default:
                throw new BadRequestException('Unsupported role');
        }

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const checkForgot = await this.forgotRepo.findOne({
            userId: user._id,
            userRole: user.role
        });

        if (!checkForgot) {
            throw new NotFoundException('Code does not exist or expired');
        }

        if (code !== checkForgot.code) {
            throw new ForbiddenException('Invalid code')
        }

        const newPassword = generateRandomPassword();

        const session = await this.forgotRepo.startSession();
        session.startTransaction();

        try {
            await this.forgotRepo.findOneAndDelete({
                userId: user._id,
                userRole: user.role
            }, {session});

            await this.emailService.sendNewPasswordEmail({
                userFirstName: user.firstName,
                email: user.email,
                password: newPassword,
            })

            switch (user.role) {
                case Role.client:
                    await this.clientRepo.findOneAndUpdate(
                        {_id: user._id},
                        {
                            password: bcrypt.hashSync(newPassword),
                        },
                        {session}
                    );
                    break;
                case Role.influencer:
                    await this.influencerRepo.findOneAndUpdate(
                        {_id: user._id},
                        {
                            password: bcrypt.hashSync(newPassword),
                        },
                        {session}
                    );
                    break;
                default:
                    throw new Error(`Tried to reset password for unsupported role ${user.role} ${user._id}`);
            }

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            this.logger.error(err);
            throw new InternalServerErrorException('Something went wrong');
        } finally {
            await session.endSession();
        }
    }
}
