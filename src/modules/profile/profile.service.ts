import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import {ClientUpdatedPersonalDetailsDto, UpdateClientPersonalDetailsDto} from './dto/client/update-client.dto';
import {ClientSession, PipelineStage, Types} from 'mongoose';
import {UpdateUserPasswordDto} from './dto/update-password.dto';
import {
    AddSocialAccountDto,
    DeleteSocialAccountDto,
    InfluencerUpdatedPersonalDetailsDto,
    UpdateInfluencerPersonalDetailsDto,
    UpdateSocialMediaAccountDto
} from './dto/influencer/update-influencer.dto';
import * as process from 'node:process';
import {AppGateway} from '../websocket/app.gateway';
import sendMail from "../../integrations/nodemailer/nodemailer";
import {
    Influencer,
    InfluencerCountryStats,
    InfluencerMusicGenre,
    SocialAccount,
    UserNotificationMethods
} from "../../database/schemas/users/influencer.schema";
import {MigrateAccountDto} from "../migrations/dto/migrate-account.dto";
import {SocialAccountMigrationContext} from "../migrations/types/migrations.types";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {NotificationMethodsEnum, Role, UserPayload} from "../../common/types/user.types";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {normalizeDtoToMusicGenres, normalizeStringToMusicGenres} from "../../common/utils/genres";
import {
    InfluencerAccountDetails,
    SocialAccountDetails,
    SocialAccountVerifiedStatus
} from "../../common/types/influencer/influencer.types";
import {mapInfluencerToAccountDetailsDto, mapToSocialAccountDetailsDto} from "../../common/mappers/influencer.mapper";
import {ClientAccountDetails} from "../../common/types/client/client.types";
import {mapClientToAccountDetailsDto} from "../../common/mappers/client.mapper";
import {
    AgreementAccountsListDto,
    FoundAccountDto,
    GetSocialAccountDetailsParamsDto,
    InfluencerAccountDetailsDto
} from "./dto/influencer/get-profile.dto";
import {GetFilteredAccountsBodyDto, SearchSocialAccountsDto} from "./dto/client/search-social-accounts.dto";
import {GetFilterOptionsDataDto} from "./dto/client/filter-options.dto";
import {InvoiceDetailsDto, UpdateInvoiceDetailsDto} from "./dto/invoice-details.dto";
import {InvoiceDetailsRepository} from "../../database/repositories/invoices/invoice-details.repository";
import {mapToInvoiceDetailsDto} from "../../common/mappers/invoice.mapper";
import {
    InternationalBankTransferDto,
    PaymentDetailsDto,
    PaymentMethodRequestEnum,
    PayPalDto,
    UKBankTransferDto,
    UpdatePaymentDetailsDto
} from "./dto/payment-details.dto";
import {UkBankTransferDetailsRepository} from "../../database/repositories/invoices/uk-transfer-details.repository";
import {
    InternationalBankTransferDetailsRepository
} from "../../database/repositories/invoices/international-transfer-details.repository";
import {PaypalDetailsRepository} from "../../database/repositories/invoices/paypal-details.repository";
import {ObjId} from "../../common/types/base.types";
import {
    mapToInternationalBankTransferDto,
    mapToPayPalDto,
    mapToUkBankTransferDto
} from "../../common/mappers/payment-details.mapper";
import {InvoicePaymentMethodEnum} from "../../common/types/influencer/invoice.types";
import {InfluencerConfirmationStatusEnum} from "../../common/types/influencer/promo.types";
import {AuthService} from "../auth/auth.service";
import {LoginResponseDto} from "../auth/dto/login.dto";
import {setRefreshTokenCookie} from "../../common/utils/cookie.util";
import {Response} from "express";
import {EmailService} from "../email/email.service";
import {areCountriesValid} from "../../common/utils/countries.util";

const bcrypt = require('bcryptjs');

@Injectable()
export class ProfileService {
    private readonly logger = new Logger('ProfileService');

    constructor(
        private readonly webSocketService: AppGateway,
        private readonly authService: AuthService,
        private readonly emailService: EmailService,
        // users
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
        // invoice details
        private readonly invoiceDetailsRepo: InvoiceDetailsRepository,
        // payment details
        private readonly ukTransferDetailsRepo: UkBankTransferDetailsRepository,
        private readonly internationalTransferDetailsRepo: InternationalBankTransferDetailsRepository,
        private readonly paypalDetailsRepo: PaypalDetailsRepository
    ) {
    }

    // ------------ UTILS ---------------


    private capitalize = (s: string): string => {
        if (!s) return s;
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    private escapeRegex = (input: string): string => {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }


    // ------------- ORCHESTRATORS -------------


    // Updates user's payment details
    async updatePaymentDetailsOrchestrator(data: UpdatePaymentDetailsDto, userInfo: UserPayload): Promise<PaymentDetailsDto> {
        let paymentDetails: PaymentDetailsDto = {};

        switch (data.selectedPaymentMethod) {
            case InvoicePaymentMethodEnum.ukBankTransfer:
                paymentDetails.ukBankTransfer = await this.updateUkTransferDetails(data.ukBankTransfer, userInfo);
                break;
            case InvoicePaymentMethodEnum.internationalBankTransfer:
                paymentDetails.internationalBankTransfer = await this.updateInternationalTransferDetails(data.internationalBankTransfer, userInfo);
                break;
            case InvoicePaymentMethodEnum.paypal:
                paymentDetails.paypal = await this.updatePaypalDetails(data.paypal, userInfo);
                break;
            default:
                throw new BadRequestException('Unsupported payment method');
        }

        return paymentDetails;
    }


    // ------------- SERVICES -------------


    // Returns client's account details
    async getClientAccountDetails(clientId: string): Promise<ClientAccountDetails> {
        if (!clientId) throw new BadRequestException('Client ID is required');

        const client = await this.clientRepo.findById(clientId);
        if (!client) throw new NotFoundException('Client not found');

        return mapClientToAccountDetailsDto(client);
    }

    // Returns influencer's account details
    async getInfluencerAccountDetails(influencerId: string): Promise<InfluencerAccountDetails> {
        if (!influencerId) throw new BadRequestException('Influencer ID is required');

        const influencer = await this.influencerRepo.findById(influencerId);
        if (!influencer) throw new NotFoundException('Influencer not found');

        return mapInfluencerToAccountDetailsDto(influencer);
    }

    // Updates client's personal information
    async updatePersonalClient(data: UpdateClientPersonalDetailsDto): Promise<ClientUpdatedPersonalDetailsDto> {
        const {_id, firstName, logoUrl, company, email, phone} = data;

        const updateData: Partial<{
            firstName: string;
            logoUrl: string;
            company: string;
            email: string;
            phone: string;
        }> = {};

        if (firstName) updateData.firstName = firstName.trim();
        if (logoUrl) updateData.logoUrl = logoUrl.trim();
        if (company) updateData.company = company.trim();
        if (email) updateData.email = email.trim().toLowerCase();
        if (phone) updateData.phone = phone.trim();

        const updatedUser = await this.clientRepo.findOneAndUpdate(
            {_id: new Types.ObjectId(_id)},
            {$set: updateData},
            {new: true}
        );

        if (!updatedUser) {
            throw new NotFoundException("Client not found");
        }

        return {
            firstName: updatedUser.firstName,
            logoUrl: updateData?.logoUrl,
            company: updatedUser.company,
            email: updatedUser.email,
            phone: updatedUser.phone,
        };
    }

    // Updates influencer's personal information
    async updatePersonalInfluencer(data: UpdateInfluencerPersonalDetailsDto): Promise<InfluencerUpdatedPersonalDetailsDto> {
        const {influencerId, firstName, logoUrl, lastName, email, phone} = data;

        const updateData: Partial<{
            firstName: string;
            lastName: string;
            logoUrl: string;
            email: string;
            phone: string;
        }> = {};

        if (firstName) updateData.firstName = firstName.trim();
        if (lastName) updateData.lastName = lastName.trim();
        if (logoUrl) updateData.logoUrl = logoUrl.trim();
        if (email) updateData.email = email.trim().toLowerCase();
        if (phone) updateData.phone = phone.trim();

        const updatedUser = await this.influencerRepo.findOneAndUpdate(
            {_id: new Types.ObjectId(influencerId)},
            {$set: updateData},
            {new: true}
        );

        if (!updatedUser) {
            throw new NotFoundException("Client not found");
        }

        return {
            firstName: updatedUser.firstName,
            lastName: updatedUser?.lastName,
            logoUrl: updateData?.logoUrl,
            email: updatedUser.email,
            phone: updatedUser.phone,
        };
    }

    // Updates influencer's selected notification methods
    async updateNotificationMethodsInfluencer(
        method: NotificationMethodsEnum,
        userInfo: UserPayload,
    ): Promise<UserNotificationMethods> {

        if (!Object.values(NotificationMethodsEnum).includes(method)) {
            throw new BadRequestException('Invalid notification method');
        }

        const update: Record<string, boolean> = {
            [`notificationMethods.${NotificationMethodsEnum.whatsapp}`]:
                method === NotificationMethodsEnum.whatsapp,
            [`notificationMethods.${NotificationMethodsEnum.telegram}`]:
                method === NotificationMethodsEnum.telegram,
        };

        const influencer = await this.influencerRepo.findOneAndUpdate(
            {_id: new ObjId(userInfo._id)},
            {$set: update},
            {
                new: true,
                select: ['notificationMethods'],
                lean: true,
            }
        );

        if (!influencer) {
            throw new NotFoundException('Influencer not found');
        }

        return influencer.notificationMethods;
    }

    // Returns current user invoice details
    async getInvoiceDetails(userId: string, userRole: Role): Promise<InvoiceDetailsDto> {
        const invoiceDetails = await this.invoiceDetailsRepo.findOne({
            userId: new Types.ObjectId(userId),
            userRole: userRole,
        });

        if (invoiceDetails) {
            return mapToInvoiceDetailsDto(invoiceDetails);
        }

        return {};
    }

    // Updates user's invoice details {
    async updateInvoiceDetails(data: UpdateInvoiceDetailsDto): Promise<InvoiceDetailsDto> {
        const {userId, userRole, firstName, lastName, address, country, company, vatNumber} = data;

        const updateData: Partial<{
            firstName: string;
            lastName: string;
            address: string;
            country: string;
            company: string;
            vatNumber: string;
        }> = {};

        if (firstName) updateData.firstName = firstName.trim();
        if (lastName) updateData.lastName = lastName.trim();
        if (address) updateData.address = address.trim();
        if (country) updateData.country = country.trim();
        if (company) updateData.company = company.trim();
        if (vatNumber) updateData.vatNumber = vatNumber.trim();

        const updatedInvoiceDetails = await this.invoiceDetailsRepo.findOneAndUpdate(
            {
                userId: new Types.ObjectId(userId),
                userRole: userRole,
            },
            {$set: updateData},
            {new: true, upsert: true}
        );

        if (!updatedInvoiceDetails) {
            throw new InternalServerErrorException("Something went wrong");
        }

        return mapToInvoiceDetailsDto(updatedInvoiceDetails);
    }

    // Returns current user payment methods details
    async getPaymentDetails(
        userInfo: UserPayload,
        selectedPaymentMethod: PaymentMethodRequestEnum = PaymentMethodRequestEnum.all
    ): Promise<PaymentDetailsDto> {
        let paymentDetails: PaymentDetailsDto = {};
        switch (selectedPaymentMethod) {
            case PaymentMethodRequestEnum.ukBankTransfer:
                try {
                    const ukDetails = await this.ukTransferDetailsRepo.findOne({
                        userId: new ObjId(userInfo._id),
                        userRole: userInfo.role
                    });

                    if (ukDetails) {
                        paymentDetails.ukBankTransfer = mapToUkBankTransferDto(ukDetails);
                    }
                } catch (err) {
                    this.logger.error(`Error getting ${selectedPaymentMethod} payment details for ${userInfo.role} ${userInfo._id}`, err);
                    throw new InternalServerErrorException(`Error getting payment details`);
                }
                break;
            case PaymentMethodRequestEnum.internationalBankTransfer:
                try {
                    const internationalDetails = await this.internationalTransferDetailsRepo.findOne({
                        userId: new ObjId(userInfo._id),
                        userRole: userInfo.role
                    });

                    if (internationalDetails) {
                        paymentDetails.internationalBankTransfer = mapToInternationalBankTransferDto(internationalDetails);
                    }
                } catch (err) {
                    this.logger.error(`Error getting ${selectedPaymentMethod} payment details for ${userInfo.role} ${userInfo._id}`, err);
                    throw new InternalServerErrorException(`Error getting payment details`);
                }
                break;
            case PaymentMethodRequestEnum.paypal:
                try {
                    const paypalDetails = await this.paypalDetailsRepo.findOne({
                        userId: new ObjId(userInfo._id),
                        userRole: userInfo.role
                    });

                    if (paypalDetails) {
                        paymentDetails.paypal = mapToPayPalDto(paypalDetails);
                    }
                } catch (err) {
                    this.logger.error(`Error getting ${selectedPaymentMethod} payment details for ${userInfo.role} ${userInfo._id}`, err);
                    throw new InternalServerErrorException(`Error getting payment details`);
                }
                break;
            case PaymentMethodRequestEnum.all: {
                try {
                    const ukDetails = await this.ukTransferDetailsRepo.findOne({
                        userId: new ObjId(userInfo._id),
                        userRole: userInfo.role
                    });

                    if (ukDetails) {
                        paymentDetails.ukBankTransfer = mapToUkBankTransferDto(ukDetails);
                    }
                } catch (err) {
                    this.logger.error(`Error getting ${selectedPaymentMethod} payment details for ${userInfo.role} ${userInfo._id}`, err);
                }

                try {
                    const internationalDetails = await this.internationalTransferDetailsRepo.findOne({
                        userId: new ObjId(userInfo._id),
                        userRole: userInfo.role
                    });

                    if (internationalDetails) {
                        paymentDetails.internationalBankTransfer = mapToInternationalBankTransferDto(internationalDetails);
                    }
                } catch (err) {
                    this.logger.error(`Error getting ${selectedPaymentMethod} payment details for ${userInfo.role} ${userInfo._id}`, err);
                }

                try {
                    const paypalDetails = await this.paypalDetailsRepo.findOne({
                        userId: new ObjId(userInfo._id),
                        userRole: userInfo.role
                    });

                    if (paypalDetails) {
                        paymentDetails.paypal = mapToPayPalDto(paypalDetails);
                    }
                } catch (err) {
                    this.logger.error(`Error getting ${selectedPaymentMethod} payment details for ${userInfo.role} ${userInfo._id}`, err);
                }
                break;
            }
            default:
                throw new BadRequestException("Unknown payment method");
        }

        return paymentDetails;
    }

    // updates uk bank transfer details
    private async updateUkTransferDetails(data: UKBankTransferDto, userInfo: UserPayload): Promise<UKBankTransferDto> {
        const updateData: Partial<{
            beneficiary: string;
            beneficiaryAddress: string;
            sortCode: string;
            accountNumber: string;
        }> = {};

        if (data.beneficiary) updateData.beneficiary = data.beneficiary.trim();
        if (data.beneficiaryAddress) updateData.beneficiaryAddress = data.beneficiaryAddress.trim();
        if (data.sortCode) updateData.sortCode = data.sortCode.trim();
        if (data.accountNumber) updateData.accountNumber = data.accountNumber.trim();

        const updatedPaymentDetails = await this.ukTransferDetailsRepo.findOneAndUpdate(
            {
                userId: new ObjId(userInfo._id),
                userRole: userInfo.role,
            },
            {$set: updateData},
            {new: true, upsert: true}
        );

        if (!updatedPaymentDetails) {
            throw new InternalServerErrorException("Something went wrong");
        }

        return mapToUkBankTransferDto(updatedPaymentDetails);
    }

    // updates international bank transfer details
    private async updateInternationalTransferDetails(data: InternationalBankTransferDto, userInfo: UserPayload): Promise<InternationalBankTransferDto> {
        const updateData: Partial<{
            beneficiary: string;
            beneficiaryAddress: string;
            iban: string;
            bankName: string;
            bankCountry: string;
            bankAccountCurrency: string;
            swiftBicCode: string;
        }> = {};

        if (data.beneficiary) updateData.beneficiary = data.beneficiary.trim();
        if (data.beneficiaryAddress) updateData.beneficiaryAddress = data.beneficiaryAddress.trim();
        if (data.iban) updateData.iban = data.iban.trim();
        if (data.bankName) updateData.bankName = data.bankName.trim();
        if (data.bankCountry) updateData.bankCountry = data.bankCountry.trim();
        if (data.bankAccountCurrency) updateData.bankAccountCurrency = data.bankAccountCurrency.trim();
        if (data.swiftBicCode) updateData.swiftBicCode = data.swiftBicCode.trim();

        const updatedPaymentDetails = await this.internationalTransferDetailsRepo.findOneAndUpdate(
            {
                userId: new ObjId(userInfo._id),
                userRole: userInfo.role,
            },
            {$set: updateData},
            {new: true, upsert: true}
        );

        if (!updatedPaymentDetails) {
            throw new InternalServerErrorException("Something went wrong");
        }

        return mapToInternationalBankTransferDto(updatedPaymentDetails);
    }

    // updates paypal transfer details
    private async updatePaypalDetails(data: PayPalDto, userInfo: UserPayload): Promise<PayPalDto> {
        if (!data.paypalEmail) throw new BadRequestException('PayPal email required');

        const updatedPaymentDetails = await this.paypalDetailsRepo.findOneAndUpdate(
            {
                userId: new ObjId(userInfo._id),
                userRole: userInfo.role,
            },
            {$set: {paypalEmail: data.paypalEmail}},
            {new: true, upsert: true}
        );

        if (!updatedPaymentDetails) {
            throw new InternalServerErrorException("Something went wrong");
        }

        return mapToPayPalDto(updatedPaymentDetails);
    }

    // Updates user's password
    async updateUserPassword(data: UpdateUserPasswordDto) {
        const {currentPassword, newPassword, _id, role} = data;

        if (!currentPassword || !newPassword || !_id) {
            throw new BadRequestException("Not enough arguments");
        }

        if (!role) {
            throw new UnauthorizedException("Not enough access");
        }

        if (role === Role.client) {
            const client = await this.clientRepo.findOne({_id: new Types.ObjectId(_id)});

            if (!client) {
                throw new NotFoundException("Client not found");
            }

            if (bcrypt.compareSync(currentPassword, client.password)) {
                await this.clientRepo.findOneAndUpdate(
                    {_id: new Types.ObjectId(_id)},
                    {
                        password: bcrypt.hashSync(newPassword),
                    },
                );
            } else {
                throw new BadRequestException("Passwords don't match");
            }
        } else if (role === Role.influencer) {
            const influencer = await this.influencerRepo.findOne({_id: new Types.ObjectId(_id)});

            if (!influencer) {
                throw new NotFoundException("Influencer not found");
            }

            if (bcrypt.compareSync(data.currentPassword, influencer.password)) {
                await this.influencerRepo.findOneAndUpdate(
                    {_id: new Types.ObjectId(_id)},
                    {
                        password: bcrypt.hashSync(newPassword),
                    },
                );
            } else {
                throw new BadRequestException("Passwords don't match");
            }
        } else {
            throw new UnauthorizedException('Not enough access');
        }
    }

    // Returns detailed social account
    async getDetailedSocialAccount(data: GetSocialAccountDetailsParamsDto): Promise<SocialAccountDetails> {
        const {influencerId, socialMedia, accountId} = data;

        if (!influencerId || !socialMedia || !accountId) throw new BadRequestException("Not enough arguments");

        const accountAggregation = await this.influencerRepo.aggregate([
            {
                $match: {
                    _id: new Types.ObjectId(influencerId),
                    isDeleted: {$ne: true},
                }
            },
            {
                $project: {
                    accounts: `$${socialMedia}`
                }
            },
            {
                $unwind: '$accounts'
            },
            {
                $match: {'accounts._id': new Types.ObjectId(accountId)}
            },
            {
                $replaceRoot: {newRoot: '$accounts'}
            }
        ]);

        if (!accountAggregation.length) {
            throw new NotFoundException('Social account not found');
        }

        const account: SocialAccount = accountAggregation[0];

        return mapToSocialAccountDetailsDto(account);
    }

    // Updates influencer's social account
    async updateSocialAccount(data: UpdateSocialMediaAccountDto): Promise<SocialAccountDetails> {
        if (!data.influencerId) throw new BadRequestException("Not enough arguments");

        const influencer = await this.influencerRepo.findOne({_id: new Types.ObjectId(data.influencerId)});
        if (!influencer) throw new NotFoundException("Influencer not found");

        const socialMediaAccounts = influencer[data.socialMedia];
        if (!socialMediaAccounts || socialMediaAccounts.length === 0) throw new NotFoundException(`No accounts found for type: ${data.socialMedia}`);

        const socialAccountId = new Types.ObjectId(data.accountId);

        const accountIndex = socialMediaAccounts.findIndex(
            (account) => account._id.equals(socialAccountId),
        );

        if (accountIndex === -1) throw new NotFoundException(`Social account not found`)

        const socialAccount = influencer[data.socialMedia][accountIndex];

        if (!socialAccount) throw new NotFoundException('Social account not found');

        if (!areCountriesValid(data.countries)) {
            throw new BadRequestException('Countries not valid');
        }

        const updateFields: Partial<SocialAccount> = {};
        for (const [key, value] of Object.entries(data)) {
            if (
                value !== undefined &&
                key !== "influencerId" &&
                key !== "socialAccountId" &&
                key !== "socialMedia" &&
                key !== "price"
            ) {
                updateFields[key] = value as any;
            }
        }

        const isPriceChanged = data.price !== undefined && data.price !== null && data.price !== socialAccount.price;

        // for creating change price request
        if (isPriceChanged) {
            try {
                await this.emailService.sendPriceChangeRequestEmail({
                    influencerName: influencer.firstName,
                    influencerEmail: influencer.email,
                    accountUsername: socialAccount.username,
                    accountSocialMedia: data.socialMedia,
                    oldPrice: socialAccount.price,
                    newPrice: data.price,
                    acceptLink: `${process.env.SERVER}/profile/influencer/verify-new-accounts?influencerId=${data.influencerId}&accounts=${encodeURIComponent(JSON.stringify([data.accountId]))}&isVerified=true&newPrice=${data.price}`,
                    declineLink: `${process.env.SERVER}/profile/influencer/verify-new-accounts?influencerId=${data.influencerId}&accounts=${encodeURIComponent(JSON.stringify([data.accountId]))}&isVerified=false`,
                });

                updateFields.verifiedStatus = SocialAccountVerifiedStatus.priceChanged;
            } catch (e) {
                this.logger.error(`Error sending mail about price change for ${data.socialMedia} account ${data.accountId}`, e);
                throw new InternalServerErrorException("Creating price change request failed. Try again later");
            }
        }

        // if there's no fields to update - return account in current state (without updating)
        if (Object.keys(updateFields).length === 0) {
            return mapToSocialAccountDetailsDto(socialMediaAccounts[accountIndex]);
        }

        if (updateFields?.musicGenres?.length > 0) {
            updateFields.musicGenres = normalizeDtoToMusicGenres(updateFields.musicGenres);
        }

        const updateResult = await this.influencerRepo.updateOne(
            {
                _id: influencer._id,
                [`${data.socialMedia}._id`]: socialAccountId,
            },
            {
                $set: Object.fromEntries(
                    Object.entries(updateFields).map(([key, value]) => [
                        `${data.socialMedia}.$.${key}`,
                        value,
                    ]),
                ),
            },
        );

        if (updateResult.modifiedCount === 0)
            throw new InternalServerErrorException("Failed to update social account");

        const updatedInfluencer = await this.influencerRepo.findOne({
            _id: influencer._id,
        });

        return mapToSocialAccountDetailsDto(updatedInfluencer[data.socialMedia].find((acc: SocialAccount) =>
            acc._id.equals(socialAccountId),
        ));
    }

    // Returns list of social accounts that were verified by admin and need agreement from influencer
    async getAgreementAccountsList(influencerId: string, role?: Role): Promise<AgreementAccountsListDto> {
        if (role && role !== Role.influencer) throw new ForbiddenException('Not enough access');

        const influencer = await this.influencerRepo.findById(influencerId, {lean: true});

        if (!influencer) throw new NotFoundException('Influencer not found');

        const result: Partial<AgreementAccountsListDto> = {
            agreementType: 'profileCreate'
        };

        for (const key of Object.values(SocialMediaEnum) as SocialMediaEnum[]) {
            const accounts = (influencer as any)[key] as SocialAccount[] | undefined;
            if (!accounts?.length) continue;

            if (result.agreementType === 'profileCreate') {
                const hasAccepted = accounts?.some(acc => acc.agreementStatus === InfluencerConfirmationStatusEnum.accept);

                if (hasAccepted) {
                    result.agreementType = 'accountAdd';
                }
            }

            const filtered = accounts
                .filter(
                    (acc) =>
                        acc.agreementStatus == null ||
                        acc.agreementStatus === InfluencerConfirmationStatusEnum.wait,
                )
                .map((acc) => ({
                    username: acc.username,
                    price: acc.price,
                }));

            if (filtered.length) {
                (result as any)[key] = filtered;
            }
        }

        return result as AgreementAccountsListDto;
    }

    // Updates influencer's agreement response to new social accounts
    async updateSocialAccountsAgreement(
        influencerId: string,
        response: InfluencerConfirmationStatusEnum,
        res: Response,
        role?: Role,
    ): Promise<LoginResponseDto> {
        if (role && role !== Role.influencer) throw new ForbiddenException('Not enough access');

        const _id = new Types.ObjectId(influencerId);

        const setObj: Record<string, any> = {};
        for (const key of Object.values(SocialMediaEnum) as SocialMediaEnum[]) {
            setObj[`${key}.$[acc].agreementStatus`] = response;
        }

        const session = await this.influencerRepo.startSession();
        session.startTransaction();

        try {
            await this.influencerRepo.updateOne(
                {
                    _id,
                    agreementStatus: {$in: [null, InfluencerConfirmationStatusEnum.wait]},
                },
                {$set: {agreementStatus: response}},
                {session},
            );

            const updateResult = await this.influencerRepo.updateOneWithArrayFilters(
                {_id},
                {$set: setObj},
                {
                    arrayFilters: [
                        {'acc.agreementStatus': {$in: [null, InfluencerConfirmationStatusEnum.wait]}},
                    ],
                    session
                },
            );
            if (!updateResult.matchedCount) throw new NotFoundException('Influencer not found');

            await session.commitTransaction();
        } catch (err) {
            this.logger.error(`Error updating agreement status for influencer ${influencerId}`, err);
            await session.abortTransaction();
            throw new InternalServerErrorException('Something went wrong');
        } finally {
            await session.endSession();
        }

        const updatedInfluencer = await this.influencerRepo.findById(influencerId, {lean: true});
        const accessToken = this.authService.generateAccessToken(updatedInfluencer);
        const refreshToken = this.authService.generateRefreshToken(updatedInfluencer);

        await this.authService.saveRefreshToken(updatedInfluencer._id, refreshToken);
        setRefreshTokenCookie(res, refreshToken);

        return {
            accessToken,
            firstName: updatedInfluencer.firstName,
            role: updatedInfluencer.role as Role,
            balance: (updatedInfluencer as any).balance ?? undefined,
            logoUrl: (updatedInfluencer as any).logoUrl ?? undefined,
            ...(updatedInfluencer.role === Role.influencer
                ? {agreementStatus: (updatedInfluencer as Influencer).agreementStatus ?? InfluencerConfirmationStatusEnum.wait}
                : {}),
        };
    }

    // Deletes influencer's social account
    async deleteSocialAccount(data: DeleteSocialAccountDto) {
        if (!data.influencerId) throw new BadRequestException('Not enough arguments');

        const influencer = await this.influencerRepo.findOne({_id: new Types.ObjectId(data.influencerId)});
        if (!influencer) throw new NotFoundException("Influencer not found");

        const socialMediaAccounts = influencer[data.socialMedia];
        if (!socialMediaAccounts || socialMediaAccounts.length === 0) throw new NotFoundException(`Influencer (${influencer.email}) - No social accounts found for type: ${data.socialMedia}`)

        const accountIndex = socialMediaAccounts.findIndex(
            (account) => account._id.toString() === data.accountId,
        );

        if (accountIndex === -1) throw new NotFoundException(`Social account not found`);
        const session = await this.influencerRepo.startSession();

        try {
            session.startTransaction();

            await this.influencerRepo.updateOne(
                {_id: influencer._id},
                {$set: {[`${data.socialMedia}.${accountIndex}.isDeleted`]: true}},
                {session}
            );

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }

        try {
            const socialMediaAccountName = socialMediaAccounts[accountIndex].username;

            const emailContent = `
        <p>Hi,</p>
        <p>The Influencer <strong>${influencer.firstName}</strong> deleted <strong>${data.socialMedia}</strong> account <strong>${socialMediaAccountName}</strong></p>
        <br>
        ${data.deleteReason ? `<p><strong>Reason:</strong> ${data.deleteReason}</p>` : ''}
    `;

            await sendMail(
                process.env.EMAIL_USER,
                'soundinfluencers',
                emailContent,
                'html',
            );
        } catch (err) {
            this.logger.warn(`${data.socialMedia} ${socialMediaAccounts[accountIndex].username} deleted status updated but email failed`, err);
        }
    }

    // Creates new social accounts and return updated influencer
    async addSocialAccount(
        data: AddSocialAccountDto,
    ): Promise<InfluencerAccountDetailsDto> {
        const {influencerId, socialMedia, payload} = data;

        if (!influencerId) {
            throw new BadRequestException('Influencer id is missing');
        }

        const influencer = await this.influencerRepo.findById(influencerId);
        if (!influencer) {
            throw new NotFoundException('Influencer not found');
        }

        // ---- DUPLICATE CHECK ----
        if (!payload?.username) {
            throw new BadRequestException('Username is required');
        }

        if (!areCountriesValid(data.payload.countries)) {
            throw new BadRequestException('Countries not valid');
        }

        const duplicate = await this.influencerRepo.findOne({
            [`${socialMedia}.username`]: payload.username,
        });

        if (duplicate) {
            throw new ConflictException({
                message: 'Username already exists',
                network: socialMedia,
                username: payload.username,
            });
        }

        // ---- NORMALIZE DATA ----
        const musicGenres = Array.isArray(payload.musicGenres)
            ? payload.musicGenres.filter(Boolean)
            : [];

        const countries =
            Array.isArray(payload.countries)
                ? payload.countries
                    .filter(
                        (c): c is InfluencerCountryStats =>
                            typeof c?.country === 'string' &&
                            c.country.trim().length > 0 &&
                            typeof c.percentage === 'number',
                    )
                    .map((c) => ({
                        country: c.country,
                        percentage: c.percentage,
                    }))
                : [];

        // ---- CREATE ACCOUNT ----
        const accountId = new Types.ObjectId();

        const newAccount: SocialAccount = {
            ...(payload.profileCategory === 'creator' && {
                creatorCategories: payload.creatorCategories ?? [],
            }),
            _id: accountId,
            username: payload.username,
            profileLink: payload.profileLink,
            followers: payload.followers,
            logoUrl: payload.logoUrl,
            profileCategory: payload.profileCategory,
            price: payload.price,
            initialPrice: payload.price,
            publicPrice: payload.price * 2,
            musicGenres,
            countries,
            categories: payload.categories,
            engagementRate: null,
            averageViews: null,
            currency: payload.currency,
            isHidden: false,
            isDeleted: false,
            verifiedStatus: SocialAccountVerifiedStatus.new,
        };

        influencer[socialMedia] = [
            ...(influencer[socialMedia] ?? []),
            newAccount,
        ];

        // ---- TRANSACTION ----
        const session = await this.influencerRepo.startSession();
        session.startTransaction();

        try {
            await influencer.save({session, validateBeforeSave: false});
            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }

        // ---- EMAIL ----
        try {
            let emailHtml = '';

            if (socialMedia === 'spotify' || socialMedia === 'soundcloud') {
                emailHtml = `
<ul>
    <li><strong>${socialMedia === 'spotify' ? 'Spotify playlist name' : 'SoundCloud account name'}:</strong> ${payload.username}</li>
    <li><strong>Link:</strong> ${payload.profileLink}</li>
    <li><strong>Followers:</strong> ${payload.followers}</li>
    <li><strong>Logo:</strong> ${payload.logoUrl}</li>
    <li><strong>Price:</strong> ${payload.price}€</li>
    <li><strong>Initial price:</strong> ${payload.price}€</li>
</ul>`;
            } else if (socialMedia === 'press') {
                emailHtml = `
<ul>
    <li><strong>Brand name:</strong> ${payload.username}</li>
    <li><strong>Website:</strong> ${payload.profileLink}</li>
    <li><strong>Visitors:</strong> ${payload.followers}</li>
    <li><strong>Logo:</strong> ${payload.logoUrl}</li>
    <li><strong>Music genres:</strong> ${musicGenres.join(', ')}</li>
    <li><strong>Price:</strong> ${payload.price}€</li>
    <li><strong>Initial price:</strong> ${payload.price}€</li>
</ul>`;
            } else {
                emailHtml = `
<ul>
    <li><strong>Username:</strong> ${payload.username}</li>
    <li><strong>Link:</strong> ${payload.profileLink}</li>
    <li><strong>Followers:</strong> ${payload.followers}</li>
    <li><strong>Logo:</strong> ${payload.logoUrl}</li>
    <li><strong>Music genres:</strong> ${musicGenres.join(', ')}</li>
    <li><strong>Price:</strong> ${payload.price}€</li>
    <li><strong>Initial price:</strong> ${payload.price}€</li>
</ul>`;
            }

            await sendMail(
                process.env.EMAIL_USER,
                'soundinfluencers',
                `
<p>Request from ${influencer.firstName} (${influencer.email})</p>

<p><strong>Network:</strong> ${socialMedia}</p>

${emailHtml}

<h2>Do you want to verify this account?</h2>

<a href="${process.env.SERVER}/profile/influencer/verify-new-accounts
?influencerId=${influencerId}
&accounts=${encodeURIComponent(JSON.stringify([accountId]))}
&isVerified=true">ACCEPT</a>

<a href="${process.env.SERVER}/profile/influencer/verify-new-accounts
?influencerId=${influencerId}
&accounts=${encodeURIComponent(JSON.stringify([accountId]))}
&isVerified=false">DECLINE</a>
`,
                'html',
            );
        } catch (err) {
            this.logger.warn(
                `Account ${accountId.toString()} added but email failed`,
                err,
            );
        }

        // ---- RESPONSE ----
        return mapInfluencerToAccountDetailsDto(influencer);
    }

    // Verifies new social accounts
    async verifyNewSocialMediaAccounts(
        influencerId: string,
        accountIds: string[],
        isVerified: boolean,
        newPrice?: number,
    ) {
        if (!influencerId || !accountIds || accountIds.length === 0 || isVerified === undefined) throw new BadRequestException("Not enough arguments");

        const influencer = await this.influencerRepo.findById(influencerId);

        if (!influencer) throw new NotFoundException("Influencer not found");

        const socialNetworks = Object.values(SocialMediaEnum);

        let updatedAccounts = [];

        const session = await this.influencerRepo.startSession();
        session.startTransaction();

        try {
            socialNetworks.forEach((network) => {
                const accounts = influencer[network] || [];

                accounts.forEach((account: SocialAccount) => {
                    if (accountIds.includes(account._id.toString())) {
                        const accountPrice = newPrice ? newPrice : account.price;
                        const accountPublicPrice = newPrice ? newPrice * 2 : account.publicPrice;

                        account.verifiedStatus = isVerified === true ? SocialAccountVerifiedStatus.accept : SocialAccountVerifiedStatus.decline;
                        account.price = accountPrice;
                        account.publicPrice = accountPublicPrice;

                        updatedAccounts.push({
                            network,
                            account,
                        });
                    }
                });
            });

            await influencer.save({session});
            await session.commitTransaction();

            this.webSocketService.server.emit('brands approved', {
                influencerId,
                updatedAccounts,
                isVerified,
            });
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    }

    // Moves social account obj to new owner obj
    async moveSocialAccount(
        data: MigrateAccountDto,
        session: ClientSession,
    ): Promise<SocialAccountMigrationContext> {
        const {influencerId, socialAccountToMigrateId, socialMediaOfAccount} = data;

        if (!influencerId || !socialAccountToMigrateId || !socialMediaOfAccount) {
            throw new BadRequestException('Not enough arguments');
        }

        const socialAccountObjectId = new Types.ObjectId(socialAccountToMigrateId);

        // Find target influencer
        const targetInfluencer = await this.influencerRepo.findOne({_id: new Types.ObjectId(influencerId)}, {session});
        if (!targetInfluencer) {
            throw new NotFoundException(`Influencer with id ${influencerId} not found`);
        }

        // Find influencer with target social account
        const sourceInfluencer: Influencer = await this.influencerRepo.findBySocialAccount(socialMediaOfAccount, socialAccountObjectId);
        if (!sourceInfluencer) {
            throw new NotFoundException('Social account not found');
        }

        if (sourceInfluencer._id.toString() === targetInfluencer._id.toString()) {
            throw new BadRequestException('Cannot migrate social account to the same influencer');
        }

        // Get target social account
        const socialAccount = sourceInfluencer[socialMediaOfAccount].find(acc =>
            acc._id.equals(socialAccountObjectId),
        );
        if (!socialAccount) {
            throw new NotFoundException('Social account not found');
        }

        // Delete social account from old owner
        await this.influencerRepo.pullSocialAccount(
            sourceInfluencer._id,
            socialMediaOfAccount,
            socialAccountObjectId,
            {session},
        );

        const alreadyExists = targetInfluencer[socialMediaOfAccount].some(acc =>
            acc._id === socialAccountObjectId,
        );
        if (alreadyExists) {
            throw new ConflictException('Social account already exists on target influencer');
        }

        // Adding social account to new owner
        await this.influencerRepo.pushSocialAccount(
            targetInfluencer._id,
            socialMediaOfAccount,
            socialAccount,
            {session},
        );

        return {
            socialAccountId: socialAccountObjectId,
            socialMedia: socialMediaOfAccount,
            socialAccountUsername: socialAccount.username ?? (socialAccount as any).instagramUsername,
            socialAccount: socialAccount,
            sourceInfluencerId: sourceInfluencer._id,
            targetInfluencerId: targetInfluencer._id,
            targetInfluencerEmail: targetInfluencer.email
        };
    }

    // Returns filters for getting filtered social accounts (currently using at create campaign page)
    async getFilterOptions(): Promise<GetFilterOptionsDataDto> {
        const CANONICAL_ALLOWED_GENRES = [
            'Techno (Melodic, Minimal)',
            'Techno (Hard, Peak)',
            'House (Tech House)',
            'House (Melodic, Afro)',
            'EDM',
            'D&B',
            'Bass',
            'Psy, Trance',
            'Dubstep',
            'Garage',
            'Dance Pop',
        ] as const;

        const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
        const allowedKeys = CANONICAL_ALLOWED_GENRES.map(norm);
        const canonicalByKey = new Map<string, string>(
            CANONICAL_ALLOWED_GENRES.map(v => [norm(v), v]),
        );

        const cap = (s: string) => {
            if (!s) return s;
            return s.charAt(0).toUpperCase() + s.slice(1);
        };

        // ----------------------------
        // 1) Собираем allAccounts из всех соцсетей
        // ----------------------------
        const socialFields = Object.values(SocialMediaEnum);
        const socialFieldEntries = socialFields.map(f => ({k: f, v: `$${f}`}));

        // ----------------------------
        // 2) BASE агрегация: platforms/profileTypes/countries/categories/creatorCategories
        // ----------------------------
        const basePipeline: PipelineStage[] = [
            {
                $project: {
                    allAccounts: {
                        $reduce: {
                            input: socialFieldEntries,
                            initialValue: [],
                            in: {
                                $concatArrays: [
                                    '$$value',
                                    {
                                        $map: {
                                            input: {$ifNull: ['$$this.v', []]},
                                            as: 'acc',
                                            in: {$mergeObjects: ['$$acc', {socialMedia: '$$this.k'}]},
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            {$unwind: '$allAccounts'},
            {
                $match: {
                    'allAccounts.verifiedStatus': SocialAccountVerifiedStatus.accept,
                    'allAccounts.agreementStatus': InfluencerConfirmationStatusEnum.accept,
                    'allAccounts.isDeleted': {$ne: true},
                    'allAccounts.isHidden': {$ne: true},
                },
            },
            {
                $facet: {
                    platforms: [
                        {$group: {_id: '$allAccounts.socialMedia', count: {$sum: 1}}},
                        {$project: {_id: 0, id: '$_id', count: 1}},
                        {$sort: {count: -1, id: 1}},
                    ],

                    profileTypes: [
                        {$match: {'allAccounts.profileCategory': {$type: 'string', $ne: ''}}},
                        {$group: {_id: '$allAccounts.profileCategory', count: {$sum: 1}}},
                        {$project: {_id: 0, id: '$_id', count: 1}},
                        {$sort: {count: -1, id: 1}},
                    ],

                    countries: [
                        {$unwind: {path: '$allAccounts.countries', preserveNullAndEmptyArrays: false}},
                        {$match: {'allAccounts.countries.country': {$type: 'string', $ne: ''}}},
                        {$group: {_id: '$allAccounts.countries.country', count: {$sum: 1}}},
                        {$project: {_id: 0, id: '$_id', count: 1}},
                        {$sort: {count: -1, id: 1}},
                    ],

                    // 4) categories counts (allAccounts.categories)  -> additional topics
                    categories: [
                        {$unwind: {path: '$allAccounts.categories', preserveNullAndEmptyArrays: false}},
                        {
                            $project: {
                                cat: {
                                    $toLower: {
                                        $trim: {input: '$allAccounts.categories'},
                                    },
                                },
                            },
                        },
                        {
                            $match: {
                                cat: {$type: 'string', $ne: ''},
                            },
                        },
                        {$group: {_id: '$cat', count: {$sum: 1}}},
                        {$project: {_id: 0, id: '$_id', count: 1}},
                        {$sort: {count: -1, id: 1}},
                    ],

                    // music categories = creatorCategories
                    creatorCategories: [
                        {$unwind: {path: '$allAccounts.creatorCategories', preserveNullAndEmptyArrays: false}},
                        {$match: {'allAccounts.creatorCategories': {$type: 'string', $ne: ''}}},
                        {$group: {_id: '$allAccounts.creatorCategories', count: {$sum: 1}}},
                        {$project: {_id: 0, id: '$_id', count: 1}},
                        {$sort: {count: -1, id: 1}},
                    ],
                },
            },
        ];

        const [aggBase] = await this.influencerRepo.aggregate<{
            platforms: { id: string; count: number }[];
            profileTypes: { id: string; count: number }[];
            countries: { id: string; count: number }[];
            categories: { id: string; count: number }[];
            creatorCategories: { id: string; count: number }[];
        }>(basePipeline).exec();

        // ----------------------------
        // 3) GENRES агрегация: flatten + normalize + whitelist
        // ----------------------------
        const genresPipeline: PipelineStage[] = [
            {
                $project: {
                    allAccounts: {
                        $reduce: {
                            input: socialFieldEntries,
                            initialValue: [],
                            in: {
                                $concatArrays: [
                                    '$$value',
                                    {
                                        $map: {
                                            input: {$ifNull: ['$$this.v', []]},
                                            as: 'acc',
                                            in: {$mergeObjects: ['$$acc', {socialMedia: '$$this.k'}]},
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            {$unwind: '$allAccounts'},
            {
                $match: {
                    'allAccounts.verifiedStatus': SocialAccountVerifiedStatus.accept,
                    'allAccounts.isDeleted': {$ne: true},
                    'allAccounts.isHidden': {$ne: true},
                },
            },
            {$unwind: {path: '$allAccounts.musicGenres', preserveNullAndEmptyArrays: false}},
            {
                $project: {
                    genre: '$allAccounts.musicGenres.genre',
                    subGenres: {$ifNull: ['$allAccounts.musicGenres.subGenres', []]},
                },
            },
            {$match: {genre: {$type: 'string', $ne: ''}}},

            // normalize genre + subs in mongo (lower + trim + collapse spaces "  ")
            {
                $project: {
                    genreNorm: {
                        $toLower: {
                            $replaceAll: {
                                input: {$trim: {input: '$genre'}},
                                find: '  ',
                                replacement: ' ',
                            },
                        },
                    },
                    subNorms: {
                        $map: {
                            input: '$subGenres',
                            as: 's',
                            in: {
                                $toLower: {
                                    $replaceAll: {
                                        input: {$trim: {input: '$$s'}},
                                        find: '  ',
                                        replacement: ' ',
                                    },
                                },
                            },
                        },
                    },
                },
            },

            // flatten: ["techno (hard, peak)"] or ["edm"]
            {
                $project: {
                    flat: {
                        $cond: [
                            {$gt: [{$size: '$subNorms'}, 0]},
                            {
                                $map: {
                                    input: '$subNorms',
                                    as: 'sub',
                                    in: {$concat: ['$genreNorm', ' (', '$$sub', ')']},
                                },
                            },
                            ['$genreNorm'],
                        ],
                    },
                },
            },
            {$unwind: '$flat'},

            // whitelist only
            {$match: {flat: {$in: allowedKeys}}},

            {$group: {_id: '$flat', count: {$sum: 1}}},
            {$project: {_id: 0, key: '$_id', count: 1}},
            {$sort: {count: -1, key: 1}},
        ];

        const flatGenreCounts = await this.influencerRepo.aggregate<{
            key: string;
            count: number
        }>(genresPipeline).exec();

        // ----------------------------
        // 4) Собираем music-genre block: parent + children (строго из canonical)
        // ----------------------------
        const byGenre = new Map<string, { total: number; subs: Map<string, number> }>();

        for (const row of flatGenreCounts) {
            const canonical = canonicalByKey.get(row.key);
            if (!canonical) continue;

            const m = canonical.match(/^(.+?)\s*\((.+)\)$/);
            if (m) {
                const parent = m[1].trim();
                const sub = m[2].trim();

                if (!byGenre.has(parent)) byGenre.set(parent, {total: 0, subs: new Map()});
                const obj = byGenre.get(parent)!;

                obj.total += row.count;
                obj.subs.set(sub, (obj.subs.get(sub) ?? 0) + row.count);
            } else {
                const parent = canonical.trim();
                if (!byGenre.has(parent)) byGenre.set(parent, {total: 0, subs: new Map()});
                byGenre.get(parent)!.total += row.count;
            }
        }

        const musicGenreFilters = Array.from(byGenre.entries())
            .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))
            .map(([parent, data]) => {
                const children = Array.from(data.subs.entries())
                    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                    .map(([sub, count]) => ({
                        id: `(${sub})`,
                        filterName: sub,
                        count,
                        group: 'genres',
                    }));

                return {
                    id: parent,
                    filterName: parent,
                    count: data.total,
                    group: 'genres',
                    ...(children.length ? {children} : {}),
                };
            });

        // ----------------------------
        // 5) Build blocks for frontend
        // ----------------------------
        const platformsBlock = {
            id: 'social-platforms-1',
            title: 'Social Media Platforms',
            filters: (aggBase?.platforms ?? []).map(p => ({
                id: p.id,
                group: 'socialMedia',
                filterName: cap(p.id),
                count: p.count,
            })),
        };

        const musicGenreBlock = {
            id: 'music-genre',
            title: 'Music Genre',
            AndOrFlag: [{method: 'And'}, {method: 'Or'}],
            filters: musicGenreFilters,
        };

        const profileTypeBlock = {
            id: 'profile-type',
            title: 'Profile Type',
            filters: (aggBase?.profileTypes ?? []).map(p => ({
                id: cap(p.id)?.toLowerCase(), // UI label
                group: 'profileType',
                filterName: cap(p.id),
                count: p.count,
            })),
        };

        const musicCategoriesBlock = {
            id: 'music-categories',
            title: 'Music Categories',
            filters: (aggBase?.creatorCategories ?? []).map(x => ({
                id: x.id,
                group: 'musicCategories',
                filterName: x.id,
                count: x.count,
            })),
        };

        const countriesBlock = {
            id: 'countries',
            title: 'Countries of Following',
            filters: (aggBase?.countries ?? []).map(c => ({
                id: c.id,
                group: 'countries',
                filterName: c.id,
                count: c.count,
            })),
        };

        const additionalTopicsBlock = {
            id: 'additional-topics',
            title: 'Additional Topics',
            filters: (aggBase.categories ?? []).map((x: any) => ({
                id: x.id,
                group: 'addTopics',
                filterName: this.capitalize(x.id),
                count: x.count,
            })),
        };

        // ----------------------------
        // 6) Final response
        // ----------------------------
        return {
            filterArr: [
                platformsBlock,
                profileTypeBlock,
                musicGenreBlock,
                musicCategoriesBlock,
                countriesBlock,
                additionalTopicsBlock,
            ],
        };
    }

    // Returns filtered social accounts (currently using at create campaign page)
    async findAccountsByFilter(
        filters: GetFilteredAccountsBodyDto & {
            page?: number;
            limit?: number;
            sortBy?: string;
        }
    ): Promise<FoundAccountDto[]> {
        const {
            socialMedias,
            page = 1,
            limit = 20,
            sortBy = 'bestMatch',
        } = filters;

        const skip = (page - 1) * limit;

        // Какие соцсети разворачиваем
        const socialFields = socialMedias?.length
            ? socialMedias
            : Object.values(SocialMediaEnum);

        // Pipeline
        const pipeline: any[] = [];

        // Объединяем все выбранные соцсети в один массив
        const socialFieldEntries = socialFields.map(f => ({
            k: f,
            v: `$${f}`
        }));

        pipeline.push({
            $project: {
                influencerId: '$_id',
                allAccounts: {
                    $reduce: {
                        input: socialFieldEntries,
                        initialValue: [],
                        in: {
                            $concatArrays: [
                                '$$value',
                                {
                                    $map: {
                                        input: {$ifNull: ['$$this.v', []]},
                                        as: 'acc',
                                        in: {
                                            $mergeObjects: [
                                                '$$acc',
                                                {socialMedia: '$$this.k'}
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        });

        // Разворачиваем аккаунты
        pipeline.push({$unwind: '$allAccounts'});

        // Базовые фильтры аккаунта
        pipeline.push({
            $match: {
                'allAccounts.isDeleted': {$ne: true},
                'allAccounts.isHidden': {$ne: true},
                'allAccounts.verifiedStatus': SocialAccountVerifiedStatus.accept,
                'allAccounts.agreementStatus': InfluencerConfirmationStatusEnum.accept
            }
        });

        // profileCategory
        if (filters.profileTypes?.length) {
            pipeline.push({
                $match: {
                    'allAccounts.profileCategory': {$in: filters.profileTypes}
                }
            });
        }

        // budget + currency
        if (filters.budget) {
            pipeline.push({
                $match: {
                    'allAccounts.publicPrice': {$lte: filters.budget}
                }
            });
        }

        // musicGenres (and / or)
        if (filters.musicGenres?.length) {
            const normalizedGenres: InfluencerMusicGenre[] = normalizeStringToMusicGenres(filters.musicGenres);

            if (filters.musicGenresFilterMethod === 'and') {
                pipeline.push({
                    $match: {
                        $and: normalizedGenres.flatMap(g =>
                            (g.subGenres.length ? g.subGenres : [null]).map(sub =>
                                sub
                                    ? {'allAccounts.musicGenres': {$elemMatch: {genre: g.genre, subGenres: sub}}}
                                    : {'allAccounts.musicGenres': {$elemMatch: {genre: g.genre}}}
                            )
                        )
                    }
                });
            } else {
                pipeline.push({
                    $match: {
                        $or: normalizedGenres.flatMap(g =>
                            (g.subGenres.length ? g.subGenres : [null]).map(sub =>
                                sub
                                    ? {'allAccounts.musicGenres': {$elemMatch: {genre: g.genre, subGenres: sub}}}
                                    : {'allAccounts.musicGenres': {$elemMatch: {genre: g.genre}}}
                            )
                        )
                    }
                });
            }
        }

        // countries
        if (filters.countries?.length) {
            pipeline.push({
                $match: {
                    'allAccounts.countries.country': {$in: filters.countries}
                }
            });
        }

        // categories
        const categories = [
            ...(filters.additionalTopics || []),
            ...(filters.musicCategories || []),
            ...(filters.entertainmentCategories || []),
        ];

        if (categories.length) {
            pipeline.push({
                $match: {
                    'allAccounts.categories': {$in: categories}
                }
            });
        }

        // bestMatch score (для сортировки)
        if (sortBy === 'bestMatch') {
            pipeline.push({
                $addFields: {
                    score: {
                        $cond: [
                            {$gt: ['$allAccounts.followers', 0]},
                            {
                                $divide: [
                                    '$allAccounts.publicPrice',
                                    '$allAccounts.followers'
                                ]
                            },
                            Number.MAX_SAFE_INTEGER
                        ]
                    }
                }
            });
        }

        // Возвращаем только нужные поля DTO
        pipeline.push({
            $project: {
                _id: 0,
                accountId: '$allAccounts._id',
                influencerId: '$_id',
                username: '$allAccounts.username',
                logoUrl: '$allAccounts.logoUrl',
                followers: '$allAccounts.followers',
                prices: {
                    EUR: {$ifNull: ['$allAccounts.publicPrice', 0]},
                    USD: {$multiply: [{$ifNull: ['$allAccounts.publicPrice', 0]}, 1.08]},
                    GBP: {$multiply: [{$ifNull: ['$allAccounts.publicPrice', 0]}, 0.92]}
                },
                socialMedia: '$allAccounts.socialMedia',
                countries: {
                    $map: {
                        input: {$ifNull: ['$allAccounts.countries', []]},
                        as: 'c',
                        in: {
                            country: '$$c.country',
                            percentage: {$ifNull: ['$$c.percentage', 0]}
                        }
                    }
                },
                musicGenres: {
                    $reduce: {
                        input: {$ifNull: ['$allAccounts.musicGenres', []]},
                        initialValue: [],
                        in: {
                            $concatArrays: [
                                '$$value',
                                {
                                    $cond: [
                                        {$gt: [{$size: {$ifNull: ['$$this.subGenres', []]}}, 0]},
                                        {
                                            $map: {
                                                input: '$$this.subGenres',
                                                as: 'sg',
                                                in: {$concat: ['$$this.genre', ' (', '$$sg', ')']}
                                            }
                                        },
                                        ['$$this.genre']
                                    ]
                                }
                            ]
                        }
                    }
                },
                creatorCategories: {$ifNull: ['$allAccounts.creatorCategories', []]},
                categories: {$ifNull: ['$allAccounts.categories', []]}
            }
        });

        // сортировка
        const sortStage: any = {};
        switch (sortBy) {
            case 'bestMatch':
                sortStage['score'] = 1;
                break;
            case 'lowestPrice':
                sortStage['prices.EUR'] = 1;
                break;
            case 'highestPrice':
                sortStage['prices.EUR'] = -1;
                break;
            case 'lowestFollowers':
                sortStage['followers'] = 1;
                break;
            case 'highestFollowers':
                sortStage['followers'] = -1;
                break;
            default:
                sortStage['followers'] = -1;
                break;
        }
        pipeline.push({$sort: sortStage});

        // Пагинация
        pipeline.push({
            $facet: {
                data: [
                    {$skip: skip},
                    {$limit: limit}
                ],
                total: [
                    {$count: 'count'}
                ]
            }
        });

        const result = await this.influencerRepo.aggregate(pipeline);

        return result[0]?.data || [];
    }

    // Searching social accounts
    async searchSocialAccounts(dto: SearchSocialAccountsDto): Promise<FoundAccountDto[]> {
        const queryRaw = (dto.query ?? '').trim();
        if (!queryRaw) throw new BadRequestException('query is required');

        const socialMedias = dto.socialMedias ?? [];
        if (!socialMedias.length) throw new BadRequestException('socialMedias is required');

        const page = Math.max(1, Number(dto.page ?? 1));
        const limit = Math.min(50, Math.max(1, Number(dto.limit ?? 20)));
        const skip = (page - 1) * limit;

        const q = this.escapeRegex(queryRaw);
        const usernameRegex = new RegExp(`^${q}`, 'i');

        const concatParts = socialMedias.map((sm) => ({
            $map: {
                input: `$${sm}`,
                as: 'a',
                in: {
                    $mergeObjects: ['$$a', {socialMedia: sm}],
                },
            },
        }));

        const matchAcc = {
            'acc.verifiedStatus': SocialAccountVerifiedStatus.accept,
            'acc.isHidden': {$ne: true},
            'acc.isDeleted': {$ne: true},
        };

        const pipeline: any[] = [
            {
                $project: {
                    influencerId: '$_id',
                    accAll: {$concatArrays: concatParts},
                },
            },
            {$unwind: '$accAll'},
            {$set: {acc: '$accAll'}},

            {$match: matchAcc},

            {$match: {'acc.username': usernameRegex}},

            {$skip: skip},
            {$limit: limit},

            {
                $project: {
                    _id: 0,
                    accountId: {$toString: '$acc._id'},
                    influencerId: {$toString: '$influencerId'},
                    username: '$acc.username',
                    logoUrl: '$acc.logoUrl',
                    followers: '$acc.followers',
                    socialMedia: '$acc.socialMedia',
                    countries: {$ifNull: ['$acc.countries', []]},

                    musicGenres: {
                        $cond: [
                            {$isArray: '$acc.musicGenres'},
                            {$map: {input: '$acc.musicGenres', as: 'g', in: '$$g.genre'}},
                            '$$REMOVE',
                        ],
                    },
                    creatorCategories: {$ifNull: ['$acc.creatorCategories', '$$REMOVE']},
                    categories: {$ifNull: ['$acc.categories', '$$REMOVE']},

                    // todo: currency conversion
                    prices: {
                        EUR: {$ifNull: ['$acc.publicPrice', {$literal: 0}]},
                        USD: {$literal: 0},
                        GBP: {$literal: 0},
                    },
                },
            },
        ];

        return this.influencerRepo.aggregate<FoundAccountDto>(pipeline).allowDiskUse(true);
    }
}
