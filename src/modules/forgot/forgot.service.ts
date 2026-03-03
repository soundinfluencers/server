import {
    BadRequestException,
    ConflictException,
    Injectable, InternalServerErrorException, Logger,
    NotFoundException
} from '@nestjs/common';
import {Client} from "../../database/schemas/users/client.schema";
import {Influencer} from "../../database/schemas/users/influencer.schema";
import {ForgotRepository} from "./repositories/forgot.repository";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {ObjId} from "../../common/types/base.types";
import {EmailService} from "../../integrations/email/email.service";
import {Role} from "../../common/types/user.types";
import {createHash, randomBytes} from "node:crypto";
import {ClientSession} from "mongoose";
import {CloseForgotRequestDto, CreateNewForgotRequestDto} from "./dto/forgot.dto";
import {Forgot} from "./schemas/forgot.schema";
import {AdminToClientEmails, ClientToAdminEmails} from "../../integrations/email/email.templates";

const bcrypt = require('bcryptjs');

function generateResetToken() {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return {token, tokenHash};
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

    private async resetPassword(role: Role, userId: ObjId, forgotId: ObjId, newPassword: string, session: ClientSession) {
        session.startTransaction();

        try {
            await this.forgotRepo.findOneAndDelete({_id: forgotId}, {session});

            const passwordHash = bcrypt.hashSync(newPassword);

            if (role === Role.client) {
                await this.clientRepo.findOneAndUpdate({_id: userId}, {password: passwordHash}, {session});
            } else if (role === Role.influencer) {
                await this.influencerRepo.findOneAndUpdate({_id: userId}, {password: passwordHash}, {session});
            } else {
                throw new BadRequestException('Unsupported role');
            }

            await session.commitTransaction();
        } catch (e) {
            await session.abortTransaction();
            throw new InternalServerErrorException('Something went wrong');
        } finally {
            await session.endSession();
        }
    }

    // FIRST STEP: creates request for resetting password and sends email with code
    async createResetPasswordRequest(data: CreateNewForgotRequestDto) {
        const {email, role} = data;

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
            throw new ConflictException('Reset link already sent. Please check your email or try again later.');
        }

        const {token, tokenHash} = generateResetToken();

        const forgotRequestId = new ObjId();

        await this.forgotRepo.create({
            _id: forgotRequestId,
            userId: user._id,
            userRole: user.role,
            tokenHash,
        });

        try {
            await this.emailService.send(AdminToClientEmails.forgotPassword({
                userFirstName: user.firstName,
                email,
                link: `${process.env.SERVER_CLIENT}/reset-password/${token}`,
            }));
        } catch (err) {
            await this.forgotRepo.findOneAndDelete({_id: forgotRequestId});

            this.logger.error(`Sending reset password link email failed for user ${user._id}`);
            throw new InternalServerErrorException('Something went wrong. Try again later.');
        }
    }

    // SECOND STEP: checks code, sets new auto-generated password and sends email with it
    async closeResetPasswordRequest(data: CloseForgotRequestDto): Promise<void> {
        const {token, newPassword} = data;

        const tokenHash = createHash('sha256').update(token).digest('hex');

        const forgot: Forgot = await this.forgotRepo.findOne({tokenHash});
        if (!forgot) throw new NotFoundException('Token invalid or expired');

        const role = forgot.userRole;

        let user: Client | Influencer = undefined;

        switch (role) {
            case Role.client:
                user = await this.clientRepo.findById(forgot.userId.toString());
                break;
            case Role.influencer:
                user = await this.influencerRepo.findById(forgot.userId.toString());
                break;
            default:
                throw new BadRequestException('Unsupported role');
        }

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const session: ClientSession = await this.forgotRepo.startSession();

        await this.resetPassword(
            user.role,
            user._id,
            forgot._id,
            newPassword,
            session
        );

        try {
            await this.emailService.send(AdminToClientEmails.newPassword({
                userFirstName: user.firstName,
                email: user.email,
            }))
        } catch (err) {
            this.logger.warn(`User ${user.role} ${user._id} reset his password, but email failed`)
        }
    }
}
