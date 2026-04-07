import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import {isMongoId} from "class-validator";

import {InfluencerRepository} from "../../../database/repositories/users/influencer.repository";
import {ObjId} from "../../../common/types/base.types";
import {Influencer, SocialAccount} from "../../../database/schemas/users/influencer.schema";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {UpdateSocialAccountDto} from "../dto/influencer/update-influencer.dto";
import {AdminUpdateSocialAccountDto} from "../../admin/dto/influencers/admin-update-influencer.dto";
import {SocialAccountDetails, SocialAccountLabelStatus} from "../../../common/types/influencer/influencer.types";
import {EmailService} from "../../../integrations/email/email.service";
import {
    mapToAdminSocialAccountForListDto,
    mapToSocialAccountDetailsDto
} from "../../../common/mappers/influencer.mapper";
import {AccountVerifiedStatus} from "../../../common/types/user.types";
import {areCountriesValid} from "../../../common/utils/countries.util";
import {CurrencyCode, getAvailableCurrenciesLabel} from "../../../common/types/finance.types";
import {InfluencerToAdminEmails} from "../../../integrations/email/email.templates";
import {normalizeDtoToMusicGenres} from "../../../common/utils/genres";
import {SocialAccountDetailsDto} from "../dto/influencer/get-profile.dto";
import {AdminSocialAccountForListDto} from "../../admin/dto/influencers/admin-influencers.dto";

type UpdateSocialAccountInput =
    | UpdateSocialAccountDto
    | AdminUpdateSocialAccountDto;

interface IUpdateSocialAccountService {
    // Executes service
    execute(
        data: UpdateSocialAccountInput,
        isForAdmin?: boolean
    ): Promise<SocialAccountDetails | AdminSocialAccountForListDto>;

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
    private readonly logger = new Logger("UpdateSocialAccountService");

    constructor(
        private readonly influencerRepository: InfluencerRepository,
        private readonly emailService: EmailService,
    ) {
    }

    async execute(
        data: UpdateSocialAccountInput,
        isForAdmin: boolean = false
    ): Promise<SocialAccountDetails | AdminSocialAccountForListDto> {
        const {influencerId, socialAccountId, socialMedia} = this.validateInput(data);

        // Find influencer by id
        const influencer = await this.findInfluencerById(influencerId);

        // Find social account
        const socialAccount = this.findSocialAccount(
            influencer,
            socialMedia,
            socialAccountId,
        );

        this.validateSocialAccountBeforeUpdate(socialAccount);
        this.validateCountries(data);

        const updateFields = this.buildUpdateFields(data);

        await this.handlePriceChangeIfNeeded({
            data,
            influencer,
            socialAccount,
            socialMedia,
            influencerId,
            socialAccountId,
            updateFields,
        });

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
                    costPerFollower: Number((socialAccount?.price / socialAccount?.followers)?.toFixed(6)) ?? 0
                })
                : mapToSocialAccountDetailsDto(socialAccount);
        }

        this.normalizeUpdateFields(updateFields);

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
                costPerFollower: Number((updatedAccount?.price / updatedAccount?.followers)?.toFixed(6)) ?? 0,
                isHidden: updatedAccount.isHidden,
                internalNote: influencer.internalNote
            })
            : mapToSocialAccountDetailsDto(updatedAccount);
    }

    // Finds influencer by id
    async findInfluencerById(influencerId: ObjId): Promise<Influencer> {
        const influencer = await this.influencerRepository.findOne({
            _id: influencerId,
        });

        if (!influencer) throw new NotFoundException("Influencer not found.");

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
            (account) => account._id.equals(socialAccountId),
        );

        if (accountIndex === -1) throw new NotFoundException("Social account not found");

        const socialAccount = influencer[socialMedia][accountIndex];

        if (!socialAccount) throw new NotFoundException("Social account not found");

        return socialAccount;
    }

    private validateInput(data: UpdateSocialAccountInput): {
        influencerId: ObjId;
        socialAccountId: ObjId;
        socialMedia: SocialMediaEnum;
    } {
        if (!data.influencerId) {
            throw new BadRequestException("Not enough arguments");
        }

        if (!isMongoId(data.influencerId)) {
            throw new BadRequestException("Invalid influencer id.");
        }

        if (!data.accountId || !isMongoId(data.accountId)) {
            throw new BadRequestException("Invalid social account id.");
        }

        return {
            influencerId: new ObjId(data.influencerId),
            socialAccountId: new ObjId(data.accountId),
            socialMedia: data.socialMedia,
        };
    }

    private validateSocialAccountBeforeUpdate(socialAccount: SocialAccount): void {
        if (socialAccount.verifiedStatus !== AccountVerifiedStatus.accept) {
            throw new ForbiddenException(
                "Wait for admin approval before updating an account with a requested price change",
            );
        }
    }

    private validateCountries(data: UpdateSocialAccountInput): void {
        if (data.countries !== undefined && !areCountriesValid(data.countries)) {
            throw new BadRequestException("Countries not valid");
        }
    }

    private buildUpdateFields(data: UpdateSocialAccountInput): Partial<SocialAccount> {
        const updateFields: Partial<SocialAccount> = {};

        for (const [key, value] of Object.entries(data)) {
            if (
                value !== undefined &&
                key !== "influencerId" &&
                key !== "accountId" &&
                key !== "socialMedia" &&
                key !== "price" &&
                key !== "currency"
            ) {
                updateFields[key as keyof SocialAccount] = value as never;
            }
        }

        return updateFields;
    }

    private async handlePriceChangeIfNeeded(params: {
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

        const isPriceChanged =
            data.price !== undefined &&
            data.price !== null &&
            data.price !== socialAccount.price;

        // for creating change price request
        if (!isPriceChanged) return;

        if (!data.currency || !Object.values(CurrencyCode).includes(data.currency)) {
            throw new BadRequestException(
                `Currency for ${socialMedia} account ${socialAccount.username} is not valid. ` +
                `Try to use one of these: ${getAvailableCurrenciesLabel()}`
            );
        }

        try {
            await this.emailService.send(
                InfluencerToAdminEmails.priceChangeRequest({
                    influencerName: influencer.firstName,
                    influencerEmail: influencer.email,
                    accountUsername: socialAccount.username,
                    accountSocialMedia: socialMedia,
                    oldPrice: socialAccount.price,
                    newPrice: data.price,
                    currency: data.currency,
                    acceptLink:
                        `${process.env.SERVER}/profile/influencer/verify-new-accounts` +
                        `?influencerId=${String(influencerId)}` +
                        `&accounts=${encodeURIComponent(JSON.stringify([String(socialAccountId)]))}` +
                        `&isVerified=true` +
                        `&newPrice=${data.price}` +
                        `&currency=${data.currency}`,
                    declineLink:
                        `${process.env.SERVER}/profile/influencer/verify-new-accounts` +
                        `?influencerId=${String(influencerId)}` +
                        `&accounts=${encodeURIComponent(JSON.stringify([String(socialAccountId)]))}` +
                        `&isVerified=false` +
                        `&newPrice=${data.price}` +
                        `&currency=${data.currency}`,
                }),
            );

            updateFields.verifiedStatus = AccountVerifiedStatus.waitForAdmin as never;
            updateFields.labelStatus = SocialAccountLabelStatus.priceChanged as never;
        } catch (e) {
            this.logger.error(
                `Error sending mail about price change for ${socialMedia} account ${String(socialAccountId)}`,
                e instanceof Error ? e.stack : String(e),
            );

            throw new InternalServerErrorException(
                "Creating price change request failed. Try again later",
            );
        }
    }

    private normalizeUpdateFields(updateFields: Partial<SocialAccount>): void {
        if (updateFields.musicGenres?.length) {
            updateFields.musicGenres = normalizeDtoToMusicGenres(
                updateFields.musicGenres as never,
            ) as never;
        }
    }

    private async updateSocialAccountInDb(params: {
        influencerId: ObjId;
        socialAccountId: ObjId;
        socialMedia: SocialMediaEnum;
        updateFields: Partial<SocialAccount>;
    }): Promise<void> {
        const {influencerId, socialAccountId, socialMedia, updateFields} = params;

        const updateResult = await this.influencerRepository.updateOne(
            {
                _id: influencerId,
                [`${socialMedia}._id`]: socialAccountId,
            },
            {
                $set: Object.fromEntries(
                    Object.entries(updateFields).map(([key, value]) => [
                        `${socialMedia}.$.${key}`,
                        value,
                    ]),
                ),
            },
        );

        if (updateResult.modifiedCount === 0) {
            throw new InternalServerErrorException("Failed to update social account");
        }
    }

    private async findUpdatedSocialAccount(params: {
        influencerId: ObjId;
        socialAccountId: ObjId;
        socialMedia: SocialMediaEnum;
    }): Promise<SocialAccount> {
        const {influencerId, socialAccountId, socialMedia} = params;

        const updatedInfluencer = await this.influencerRepository.findOne({
            _id: influencerId,
        });

        if (!updatedInfluencer) {
            throw new NotFoundException("Updated influencer not found");
        }

        const updatedAccount = updatedInfluencer[socialMedia]?.find(
            (acc: SocialAccount) => acc._id.equals(socialAccountId),
        );

        if (!updatedAccount) {
            throw new NotFoundException("Updated social account not found");
        }

        return updatedAccount;
    }
}