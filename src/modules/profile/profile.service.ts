import {
    BadRequestException,
    ConflictException,
    Injectable, InternalServerErrorException, Logger,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import {ClientUpdatedPersonalDetailsDto, UpdateClientPersonalDetailsDto} from './dto/client/update-client.dto';
import {ClientSession, Types} from 'mongoose';
import {UpdateUserPasswordDto} from './dto/update-password.dto';
import {
    AddSocialMediasDto,
    DeleteSocialAccountDto,
    InfluencerUpdatedPersonalDetailsDto,
    UpdateInfluencerPersonalDetailsDto,
    UpdateSocialMediaAccountDto
} from './dto/influencer/update-influencer.dto';
import * as process from 'node:process';
import {AppGateway} from '../websocket/app.gateway';
import sendMail from "../../integrations/nodemailer/nodemailer";
import {Influencer, SocialAccount} from "../../database/schemas/users/influencer.schema";
import {MigrateAccountDto} from "../migrations/dto/migrate-account.dto";
import {SocialAccountMigrationContext} from "../migrations/types/migrations.types";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {Role} from "../../common/types/auth.types";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {CreateSocialAccountDto} from "../auth/dto/create-influencer.dto";
import {normalizeMusicGenres} from "../../common/utils/genres";
import {InfluencerAccountDetails, SocialAccountDetails} from "../../common/types/influencer/influencer.types";
import {mapInfluencerToAccountDetailsDto, mapToSocialAccountDetailsDto} from "../../common/mappers/influencer.mapper";
import {ClientAccountDetails} from "../../common/types/client/client.types";
import {mapClientToAccountDetailsDto} from "../../common/mappers/client.mapper";
import {
    FoundAccountDto,
    GetSocialAccountDetailsParamsDto,
    InfluencerAccountDetailsDto
} from "./dto/influencer/get-profile.dto";
import {SocialAccountSearchFiltersDto} from "./dto/client/search-social-accounts.dto";

const bcrypt = require('bcryptjs');

@Injectable()
export class ProfileService {
    constructor(
        private readonly webSocketService: AppGateway,
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
    ) {
    }

    private readonly logger = new Logger('ProfileService');

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

    // Updates client's personal information (firstName, company, email, phone)
    async updatePersonalClient(data: UpdateClientPersonalDetailsDto): Promise<ClientUpdatedPersonalDetailsDto> {
        const {_id, firstName, company, email, phone} = data;

        const updateData: Partial<{
            firstName: string;
            company: string;
            email: string;
            phone: string;
        }> = {};

        if (firstName) updateData.firstName = firstName.trim();
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
            company: updatedUser.company,
            email: updatedUser.email,
            phone: updatedUser.phone,
        };
    }

    // Updates influencer's personal information (firstName, email, phone)
    async updatePersonalInfluencer(data: UpdateInfluencerPersonalDetailsDto): Promise<InfluencerUpdatedPersonalDetailsDto> {
        const {_id, firstName, email, phone} = data;

        const updateData: Partial<{
            firstName: string;
            email: string;
            phone: string;
        }> = {};

        if (firstName) updateData.firstName = firstName.trim();
        if (email) updateData.email = email.trim().toLowerCase();
        if (phone) updateData.phone = phone.trim();

        const updatedUser = await this.influencerRepo.findOneAndUpdate(
            {_id: new Types.ObjectId(_id)},
            {$set: updateData},
            {new: true}
        );

        if (!updatedUser) {
            throw new NotFoundException("Client not found");
        }

        return {
            firstName: updatedUser.firstName,
            email: updatedUser.email,
            phone: updatedUser.phone,
        };
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
                $match: { _id: new Types.ObjectId(influencerId) }
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
                $match: { 'accounts._id': new Types.ObjectId(accountId) }
            },
            {
                $replaceRoot: { newRoot: '$accounts' }
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

        const socialAccountId = new Types.ObjectId(data.socialAccountId);

        const accountIndex = socialMediaAccounts.findIndex(
            (account) => account._id.equals(socialAccountId),
        );

        if (accountIndex === -1) throw new NotFoundException(`Social account not found`)

        const updateFields: Partial<SocialAccount> = {};
        for (const [key, value] of Object.entries(data)) {
            if (
                value !== undefined &&
                key !== "influencerId" &&
                key !== "socialAccountId" &&
                key !== "socialMedia"
            ) {
                updateFields[key] = value as any;
            }
        }

        // if there's no fields to update - return account in current state (without updating)
        if (Object.keys(updateFields).length === 0) {
            return mapToSocialAccountDetailsDto(socialMediaAccounts[accountIndex]);
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

        return mapToSocialAccountDetailsDto(updatedInfluencer[data.socialMedia].find((acc) =>
            acc._id.equals(socialAccountId),
        ));
    }

//     // TODO: UPDATE
//     async sendMailAboutChangingPrice(data: SendMailPriceChangeDto) {
//         if (!data) {
//             return {
//                 code: 400,
//                 message: 'Not enough arguments',
//             };
//         }
//
//         const influencer = await this.influencerModel.findOne({_id: data.influencerId});
//
//         if (!influencer) {
//             return {
//                 code: 404,
//                 message: 'User not found',
//             };
//         }
//
//         const socialMediaAccounts = influencer[data.typeOfSocialMedia];
//
//         if (!socialMediaAccounts || socialMediaAccounts.length === 0) {
//             return {
//                 code: 404,
//                 message: `No accounts found for type: ${data.typeOfSocialMedia}`,
//             };
//         }
//
//         const accountIndex = socialMediaAccounts.findIndex(
//             (account) => account._id.toString() === data.accountId,
//         );
//
//         if (accountIndex === -1) {
//             return {
//                 code: 404,
//                 message: 'Account not found',
//             };
//         }
//
//         const account = socialMediaAccounts[accountIndex];
//
//         let emailContent = `
//             <p>Hi,</p>
//             <p>The influencer <strong>${influencer.firstName}</strong> has requested to update the price for their ${data.typeOfSocialMedia} account <strong>${account.instagramUsername}</strong> from €${account.price} to €${data.newPrice}.</p>
// <a href="${process.env.SERVER}/profile/influencer/verify-new-social-media-price?influencerId=${data.influencerId}&socialMedia=${data.typeOfSocialMedia}&networkUsername=${encodeURIComponent(account.instagramUsername)}&isPriceGoodToGo=${true}&newPrice=${data.newPrice}">ACCEPT</a>
// <a href="${process.env.SERVER}/profile/influencer/verify-new-social-media-price?influencerId=${data.influencerId}&socialMedia=${data.typeOfSocialMedia}&networkUsername=${encodeURIComponent(account.instagramUsername)}&isPriceGoodToGo=${false}&newPrice=${data.newPrice}">DECLINE</a>
//         `;
//
//         await sendMail(
//             // "nazarkozynets030606@zohomail.eu",
//             'admin@soundinfluencers.com',
//             'soundinfluencers',
//             emailContent,
//             'html',
//         );
//
//         await sendMail(
//             influencer.email,
//             'soundinfluencers',
//             `
//                 <p>Hi ${influencer.firstName}</p>
//                 <br>
//                 <p>We've received your price change request and we will come back to you ASAP.</p>
//                 <br>
//                 <p>Thanks for your patience</p>
//                 <p>SoundInfluencers Team</p>
//             `,
//         );
//
//         return {
//             code: 200,
//             message: 'Email sent successfully',
//         };
//     }
//
//     // TODO: UPDATE
//     async changeSocialMediaPrice(
//         influencerId: string,
//         socialMedia: string,
//         networkUsername: string,
//         isPriceGoodToGo: boolean,
//         newPrice: string,
//     ) {
//         if (!influencerId || !socialMedia || !networkUsername || isPriceGoodToGo === undefined) {
//             return {
//                 code: 400,
//                 message: 'Not enough arguments',
//             };
//         }
//
//         if (isPriceGoodToGo) {
//             const influencer = await this.influencerModel.findOne({_id: influencerId});
//
//             if (!influencer) {
//                 return {
//                     code: 404,
//                     message: 'User not found',
//                 };
//             }
//
//             const socialMediaAccounts = influencer[socialMedia];
//
//             if (!socialMediaAccounts || socialMediaAccounts.length === 0) {
//                 return {
//                     code: 404,
//                     message: `No accounts found for type: ${socialMedia}`,
//                 };
//             }
//
//             const accountIndex = socialMediaAccounts.findIndex(
//                 (account) => account.instagramUsername === networkUsername,
//             );
//
//             if (accountIndex === -1) {
//                 return {
//                     code: 404,
//                     message: 'Account not found',
//                 };
//             }
//
//             socialMediaAccounts[accountIndex].price = newPrice;
//             socialMediaAccounts[accountIndex].publicPrice = (parseFloat(newPrice) * 2).toString();
//
//             influencer[socialMedia] = socialMediaAccounts;
//             await influencer.save();
//
//             return {
//                 code: 200,
//                 message: 'Social media account updated successfully',
//             };
//         } else {
//             return {
//                 code: 200,
//                 message: 'Price change request declined',
//             };
//         }
//     }
//

    // Deletes influencer's social account
    async deleteSocialAccount(data: DeleteSocialAccountDto) {
        if (!data.influencerId) throw new BadRequestException('Not enough arguments');

        const influencer = await this.influencerRepo.findOne({_id: new Types.ObjectId(data.influencerId)});
        if (!influencer) throw new NotFoundException("Influencer not found");

        const socialMediaAccounts = influencer[data.socialMedia];
        if (!socialMediaAccounts || socialMediaAccounts.length === 0) throw new NotFoundException(`Influencer (${influencer.email}) - No social accounts found for type: ${data.socialMedia}`)

        const accountIndex = socialMediaAccounts.findIndex(
            (account) => account._id.toString() === data.socialAccountId,
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

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    }

    // Creates new social accounts and return updated influencer
    async addSocialMediaAccounts(data: AddSocialMediasDto): Promise<InfluencerAccountDetails> {
        const {influencerId} = data;
        if (!influencerId) throw new BadRequestException('Influencer id is missing');

        let errors = [];

        const influencer = await this.influencerRepo.findById(influencerId);

        if (!influencer) throw new NotFoundException(`Influencer not found`);

        const socialMedias = Object.values(SocialMediaEnum);

        let dataToSendWithEmail = {
            influencerId: influencerId,
            accounts: [],
        };

        // usernames map for check duplicates
        const usernameMap = new Map<string, string[]>();

        for (const network of socialMedias) {
            const accounts = data[network] ?? [];

            for (const acc of accounts) {
                if (!acc?.username) continue;

                const key = acc.username;

                if (!usernameMap.has(key)) {
                    usernameMap.set(key, []);
                }

                usernameMap.get(key)!.push(network);
            }
        }

        // creating request
        const or: any[] = [];

        for (const [username, networks] of usernameMap.entries()) {
            for (const network of networks) {
                or.push(
                    {[`${network}.username`]: username}
                );
            }
        }

        // Getting influencers with the same social account names
        const influencers = await this.influencerRepo.findMany(
            {$or: or},
            socialMedias.reduce((acc, n) => {
                acc[n] = 1;
                return acc;
            }, {} as any),
        );

        const conflicts: { network: string; username: string }[] = [];

        // Pushing info about duplicates
        for (const influencer of influencers) {
            for (const network of socialMedias) {
                const accounts = influencer[network] ?? [];

                for (const acc of accounts) {
                    if (usernameMap.has(acc.username) || usernameMap.has((acc as any).instagramUsername)) {
                        conflicts.push({
                            network,
                            username: acc.username,
                        });
                    }
                }
            }
        }

        // throwing conflict error
        if (conflicts.length) {
            throw new ConflictException({
                message: 'Some usernames already exist',
                conflicts,
            });
        }

        // func for creating mail
        // todo: parsing initial price
        const emailContent = (socialMedia: SocialMediaEnum, item: CreateSocialAccountDto) => {
            if (socialMedia === 'spotify' || socialMedia === 'soundcloud') {
                return `
                    <ul>
            <li><strong>${socialMedia === 'spotify' ? 'Spotify playlist name' : 'SoundCloud account name'}: ${item.username}</strong></li>
            <li><strong>${socialMedia === 'spotify' ? 'Spotify playlist link' : 'SoundCloud link'}: ${item.profileLink}</strong></li>
            <li><strong>Followers: ${item.followers}</strong></li>
            <li><strong>Logo: ${item.logoUrl}</strong></li>
            <li><strong>Price: ${item.price}€</strong></li>
            <li><strong>Initial Price: ${item.price}</strong></li>
</ul>
                `;
            } else if (socialMedia === 'press') {
                return `
                    <ul>
            <li><strong>Brand account name: ${item.username}</strong></li>
            <li><strong>Website link: ${item.profileLink}</strong></li>
            <li><strong>Website link: ${item.followers}</strong></li>
            <li><strong>Logo: ${item.logoUrl}</strong></li>
            <li><strong>Music Genres: ${item.musicGenres}</strong></li>
            <li><strong>Price: ${item.price}€</strong></li>
            <li><strong>Initial Price: ${item.price}</strong></li>
            `;
            } else {
                return `
                    <ul>
            <li><strong>Username: ${item.username}</strong></li>
            <li><strong>Link: ${item.profileLink}</strong></li>
            <li><strong>Followers: ${item.followers}</strong></li>
            <li><strong>Logo: ${item.logoUrl}</strong></li>
            <li><strong>Music Styles: ${item.musicGenres}</strong></li>
            <li><strong>Price: ${item.price}€</strong></li>
            <li><strong>Initial Price: ${item.price}</strong></li>
</ul>
                `;
            }
        };

        for (const network of socialMedias) {
            const accounts: CreateSocialAccountDto[] = data[network] || [];
            const socialMediaAccounts: SocialAccount[] = influencer[network] || [];

            try {
                for (const account of accounts) {
                    const formattedMusicGenres = normalizeMusicGenres(account.musicGenres) ?? [];

                    // todo: parsing initial price
                    const accountId = new Types.ObjectId();
                    socialMediaAccounts.push({
                        ...(account.profileCategory === "creator" && {
                            creatorCategories: account.creatorCategories ?? [],
                        }),
                        _id: accountId,
                        username: account.username,
                        profileLink: account.profileLink,
                        followers: account.followers,
                        logoUrl: account.logoUrl,
                        profileCategory: account.profileCategory,
                        price: account.price,
                        initialPrice: account.price,
                        publicPrice: account.price * 2,
                        musicGenres: formattedMusicGenres,
                        countries: account.countries,
                        categories: account.categories,
                        engagementRate: null,
                        averageViews: null,
                        currency: account.currency,
                        isHidden: false,
                        isDeleted: false,
                        isVerified: false
                    });

                    influencer[network] = socialMediaAccounts;

                    dataToSendWithEmail.accounts.push(accountId);
                }
            } catch (err) {
                console.error('Error adding social media account:', err);
                errors.push(`Error adding ${network} account. ${err}`);
            }
        }

        const session = await this.influencerRepo.startSession();
        session.startTransaction();

        try {
            await influencer.save({session});
            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }

        try {
            await sendMail(
                process.env.EMAIL_USER,
                'soundinfluencers',
                `<p>Request from ${influencer.firstName} (${influencer.email}) to add a new Brand</p>
            <b>Details:</b><br/>
            ${socialMedias
                    .map((network) =>
                        data[network]
                            ?.map(
                                (item, index) => `
                <p><strong>Network: ${network} (${index + 1} account)</strong></p>

                ${emailContent(network, item)}
            `,
                            )
                            .join(''),
                    )
                    .join('')}

            <h2>Do you want to verify these accounts?</h2>
<a href="${process.env.SERVER}/profile/influencer/verify-new-accounts?influencerId=${dataToSendWithEmail.influencerId}&accounts=${encodeURIComponent(JSON.stringify(dataToSendWithEmail.accounts))}&isVerified=${true}">ACCEPT</a>
        <a href="${process.env.SERVER}/profile/influencer/verify-new-accounts?influencerId=${dataToSendWithEmail.influencerId}&accounts=${encodeURIComponent(JSON.stringify(dataToSendWithEmail.accounts))}&isVerified=${false}">DECLINE</a>
`,
                'html',
            );
        } catch (err) {
            this.logger.warn(`New social accounts for influencer ${influencerId} were added but email failed`, err);
        }

        let result: InfluencerAccountDetailsDto = null;
        try {
            result = mapInfluencerToAccountDetailsDto(influencer);
        } catch (err) {
            this.logger.warn(`Error mapping influencer ${influencerId} to AccountDetailsDto: ${err.message}`);
        }
        return result;
    }

    // Verifies new social accounts
    async verifyNewSocialMediaAccounts(
        influencerId: string,
        accountIds: string[],
        isVerified: boolean,
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

                accounts.forEach((account) => {
                    if (accountIds.includes(account._id.toString())) {
                        account.isVerified = isVerified;
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

    // Returns filtered social accounts (currently using at create campaign page)
    async findAccountsByFilter(
        filters: SocialAccountSearchFiltersDto & {
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
        pipeline.push({
            $project: {
                allAccounts: {
                    $reduce: {
                        // гарантируем, что каждый соцблок — массив
                        input: socialFields.map(f => ({ $ifNull: [`$${f}`, []] })),
                        initialValue: [],
                        in: { $concatArrays: ['$$value', '$$this'] }
                    }
                }
            }
        });

        // Разворачиваем аккаунты
        pipeline.push({ $unwind: '$allAccounts' });

        // Базовые фильтры аккаунта
        pipeline.push({
            $match: {
                'allAccounts.isDeleted': false,
                'allAccounts.isHidden': false,
                'allAccounts.isVerified': true,
            }
        });

        // profileCategory
        if (filters.profileTypes?.length) {
            pipeline.push({
                $match: {
                    'allAccounts.profileCategory': { $in: filters.profileTypes }
                }
            });
        }

        // budget + currency
        if (filters.budget) {
            pipeline.push({
                $match: {
                    'allAccounts.price': { $lte: filters.budget }
                }
            });
        }

        if (filters.currency) {
            pipeline.push({
                $match: {
                    'allAccounts.currency': filters.currency
                }
            });
        }

        // musicGenres (and / or)
        if (filters.musicGenres?.length) {
            if (filters.musicGenresFilterMethod === 'and') {
                filters.musicGenres.forEach(genre => {
                    pipeline.push({
                        $match: {
                            'allAccounts.musicGenres.genre': genre
                        }
                    });
                });
            } else {
                pipeline.push({
                    $match: {
                        'allAccounts.musicGenres.genre': { $in: filters.musicGenres }
                    }
                });
            }
        }

        // countries
        if (filters.countries?.length) {
            pipeline.push({
                $match: {
                    'allAccounts.countries.country': { $in: filters.countries }
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
                    'allAccounts.categories': { $in: categories }
                }
            });
        }

        // bestMatch score
        if (sortBy === 'bestMatch') {
            pipeline.push({
                $addFields: {
                    score: {
                        $cond: [
                            { $gt: ['$allAccounts.followers', 0] },
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

        // todo: получать курс до этого, чтобы возвращать правильный

        // returned type
        pipeline.push({
            $addFields: {
                allAccounts: {
                    $map: {
                        input: { $ifNull: ['$allAccounts', []] },
                        as: 'acc',
                        in: {
                            accountId: '$$acc._id',
                            influencerId: '$_id',
                            username: '$$acc.username',
                            logoUrl: '$$acc.logoUrl',
                            followers: '$$acc.followers',
                            prices: {
                                EUR: { $ifNull: ['$$acc.publicPrice', 0] },
                                USD: { $multiply: [{ $ifNull: ['$$acc.publicPrice', 0] }, 1.08] },
                                GBP: { $multiply: [{ $ifNull: ['$$acc.publicPrice', 0] }, 0.92] }
                            },
                            socialMedia: '$$acc.socialMedia',
                            countries: {
                                $map: {
                                    input: { $ifNull: ['$$acc.countries', []] },
                                    as: 'c',
                                    in: {
                                        country: '$$c.country',
                                        percentage: { $ifNull: ['$$c.percentage', 0] }
                                    }
                                }
                            },
                            musicGenres: {
                                $map: {
                                    input: { $ifNull: ['$$acc.musicGenres', []] },
                                    as: 'm',
                                    in: '$$m.genre'
                                }
                            },
                            creatorCategories: { $ifNull: ['$$acc.creatorCategories', []] },
                            categories: { $ifNull: ['$$acc.categories', []] }
                        }
                    }
                }
            }
        });

        // сортировка
        const sortStage: any = {};
        switch (sortBy) {
            case 'bestMatch':
                pipeline.push({
                    $addFields: {
                        'allAccounts.score': {
                            $cond: [
                                { $eq: ['$allAccounts.followers', 0] },
                                Number.MAX_SAFE_INTEGER,
                                { $divide: ['$allAccounts.publicPrice', '$allAccounts.followers'] }
                            ]
                        }
                    }
                });
                sortStage['allAccounts.score'] = 1;
                break;
            case 'lowestPrice':
                sortStage['allAccounts.price'] = 1;
                break;
            case 'highestPrice':
                sortStage['allAccounts.price'] = -1;
                break;
            case 'lowestFollowers':
                sortStage['allAccounts.followers'] = 1;
                break;
            case 'highestFollowers':
                sortStage['allAccounts.followers'] = -1;
                break;
            default:
                sortStage['allAccounts.followers'] = -1;
                break;
        }
        pipeline.push({ $sort: sortStage });

        // Пагинация
        pipeline.push({
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit }
                ],
                total: [
                    { $count: 'count' }
                ]
            }
        });

        const result = await this.influencerRepo.aggregate(pipeline);

        // разворачиваем массив аккаунтов
        return result[0]?.data.map(d => d.allAccounts) || [];
    }

    // // TODO: UPDATE
    // async getInfluencersWithSocialMedia(socialMedia: string) {
    //     try {
    //         const getInfluencersAll = await this.influencerRepo.findMany(
    //             {statusVerify: 'accept'},
    //             {
    //                 lean: true,
    //                 select: ['-password', '-balance', '-phone', '-email'],
    //             }
    //         );
    //
    //         const influencersList = getInfluencersAll.map((item) => {
    //             const socialMediaAccounts = item[socialMedia];
    //
    //             if (Array.isArray(socialMediaAccounts)) {
    //                 return socialMediaAccounts
    //                     .filter(
    //                         (account) =>
    //                             account.isHidden !== true &&
    //                             account.isDeleted !== true &&
    //                             account.isVerified === true,
    //                     )
    //                     .map((account) => ({
    //                         ...account,
    //                         _id: item._id,
    //                     }));
    //             }
    //
    //             return [];
    //         });
    //
    //         return {
    //             code: 200,
    //             influencers: influencersList.flat(),
    //         };
    //     } catch (err) {
    //         console.log(err);
    //         return {
    //             code: 500,
    //             message: err.message || 'An error occurred while fetching influencers.',
    //         };
    //     }
    // }
    //
    // // TODO: UPDATE
    // async getInfluencersWithoutSocialMedia() {
    //     try {
    //         const influencers = await this.influencerRepo
    //             .findMany({statusVerify: 'accept'}, {
    //                 lean: true,
    //                 select: ['-password', '-balance', '-phone', '-email'],
    //             });
    //
    //         const allAccounts = influencers.map((influencer) => {
    //             const socialMediaKeys = [
    //                 'instagram',
    //                 'tiktok',
    //                 'spotify',
    //                 'soundcloud',
    //                 'facebook',
    //                 'youtube',
    //                 'press',
    //             ];
    //
    //             const accounts = socialMediaKeys.flatMap((socialMedia) => {
    //                 const socialMediaAccounts = influencer[socialMedia];
    //                 if (Array.isArray(socialMediaAccounts)) {
    //                     return socialMediaAccounts
    //                         .filter((account) => account.isHidden !== true)
    //                         .map((account) => ({
    //                             ...account,
    //                             socialMedia,
    //                             _id: influencer._id,
    //                             firstName: influencer.firstName,
    //                         }));
    //                 }
    //                 return [];
    //             });
    //
    //             return accounts;
    //         });
    //
    //         return {
    //             code: 200,
    //             influencers: allAccounts.flat(),
    //         };
    //     } catch (err) {
    //         console.error(err);
    //         return {
    //             code: 500,
    //             message: err.message || 'An error occurred while fetching all influencer accounts.',
    //         };
    //     }
    // }
    //
    // // TODO: UPDATE
    // async getClients() {
    //     try {
    //         const getClientsAll = await this.clientRepo
    //             .findMany({statusVerify: 'accept'}, {
    //                 lean: true,
    //                 select: ['-password']
    //             });
    //
    //         return {
    //             code: 200,
    //             clients: getClientsAll,
    //         };
    //     } catch (err) {
    //         console.log(err);
    //         return {
    //             code: 500,
    //             message: err,
    //         };
    //     }
    // }
    //
    // // TODO: UPDATE
    // async getInfluencerById(id: string) {
    //     try {
    //         const getInfluencer = await this.influencerRepo.findOne({_id: new mongoose.Types.ObjectId(id)})
    //
    //         return {
    //             code: 200,
    //             influencer: getInfluencer,
    //         };
    //     } catch (err) {
    //         console.log(err);
    //         return {
    //             code: 500,
    //             message: err,
    //         };
    //     }
    // }
    //
    // // TODO: UPDATE
    // async getOneSocialNetworkAccount(
    //     influencerId: string,
    //     socialMedia: string,
    //     networkUsername: string,
    // ) {
    //     if (!influencerId || !socialMedia || !networkUsername) {
    //         return {
    //             code: 400,
    //             message: 'Not enough arguments',
    //         };
    //     }
    //
    //     const influencer = await this.influencerRepo.findOne({
    //         _id: new mongoose.Types.ObjectId(influencerId),
    //     });
    //     if (!influencer) {
    //         return {
    //             code: 404,
    //             message: 'Influencer not found',
    //         };
    //     }
    //
    //     const socialMediaAccounts = influencer[socialMedia];
    //
    //     if (!socialMediaAccounts) {
    //         return {
    //             code: 404,
    //             message: 'Social media not found',
    //         };
    //     }
    //
    //     const account = socialMediaAccounts.find((item) => item.instagramUsername === networkUsername);
    //
    //     if (!account) {
    //         return {
    //             code: 404,
    //             message: 'Account not found',
    //         };
    //     }
    //
    //     return {
    //         code: 200,
    //         account,
    //     };
    // }
    //
    // // TODO: UPDATE
    // async getClientById(id: string) {
    //     try {
    //         const objectId = new Types.ObjectId(id);
    //
    //         const getClient = await this.clientRepo.findOne({_id: objectId});
    //
    //         return {
    //             code: 200,
    //             client: getClient,
    //         };
    //     } catch (err) {
    //         console.log(err);
    //         return {
    //             code: 500,
    //             message: err,
    //         };
    //     }
    // }
}
