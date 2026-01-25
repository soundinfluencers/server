import {
    BadRequestException,
    ConflictException,
    Injectable, InternalServerErrorException, Logger,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import {ClientUpdatedPersonalDetailsDto, UpdateClientPersonalDetailsDto} from './dto/client/update-client.dto';
import {ClientSession, PipelineStage, Types} from 'mongoose';
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
import {
    Influencer,
    InfluencerCountryStats,
    InfluencerMusicGenre,
    SocialAccount
} from "../../database/schemas/users/influencer.schema";
import {MigrateAccountDto} from "../migrations/dto/migrate-account.dto";
import {SocialAccountMigrationContext} from "../migrations/types/migrations.types";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {Role} from "../../common/types/auth.types";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {CreateSocialAccountDto} from "../auth/dto/create-influencer.dto";
import {
    getArrayFromMusicGenreDto,
    normalizeDtoToMusicGenres,
    normalizeStringToMusicGenres
} from "../../common/utils/genres";
import {InfluencerAccountDetails, SocialAccountDetails} from "../../common/types/influencer/influencer.types";
import {mapInfluencerToAccountDetailsDto, mapToSocialAccountDetailsDto} from "../../common/mappers/influencer.mapper";
import {ClientAccountDetails} from "../../common/types/client/client.types";
import {mapClientToAccountDetailsDto} from "../../common/mappers/client.mapper";
import {
    FoundAccountDto,
    GetSocialAccountDetailsParamsDto,
    InfluencerAccountDetailsDto
} from "./dto/influencer/get-profile.dto";
import {GetFilteredAccountsBodyDto, SearchSocialAccountsDto} from "./dto/client/search-social-accounts.dto";
import {GetFilterOptionsDataDto} from "./dto/client/filter-options.dto";

const bcrypt = require('bcryptjs');

@Injectable()
export class ProfileService {
    private readonly logger = new Logger('ProfileService');

    constructor(
        private readonly webSocketService: AppGateway,
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
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
        const {influencerId, firstName, email, phone} = data;

        const updateData: Partial<{
            firstName: string;
            email: string;
            phone: string;
        }> = {};

        if (firstName) updateData.firstName = firstName.trim();
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
                $match: {_id: new Types.ObjectId(influencerId)}
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

        return mapToSocialAccountDetailsDto(updatedInfluencer[data.socialMedia].find((acc) =>
            acc._id.equals(socialAccountId),
        ));
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
            <li><strong>Music Genres: ${getArrayFromMusicGenreDto(item.musicGenres)}</strong></li>
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
            <li><strong>Music Genres: ${getArrayFromMusicGenreDto(item.musicGenres)}</strong></li>
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
                    const formattedMusicGenres = normalizeDtoToMusicGenres(account.musicGenres) ?? [];
                    const formattedCountries: InfluencerCountryStats[] =
                        Array.isArray(account.countries)
                            ? account.countries
                                .filter(
                                    (c): c is InfluencerCountryStats =>
                                        typeof c?.country === 'string' &&
                                        c.country.trim().length > 0 &&
                                        typeof c.percentage === 'number'
                                )
                                .map((c) => ({
                                    country: c.country,
                                    percentage: c.percentage,
                                }))
                            : [];

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
                        countries: formattedCountries,
                        categories: account.categories,
                        engagementRate: null,
                        averageViews: null,
                        currency: account.currency,
                        isHidden: false,
                        isDeleted: false,
                        isVerified: false
                    } satisfies SocialAccount);

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
            await influencer.save({session, validateBeforeSave: false});
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

    // Returns filters for getting filtered social accounts (currently using at create campaign page)
    async getFilterOptions(): Promise<GetFilterOptionsDataDto> {
        // ----------------------------
        // 0) Константы/утилиты (внутри метода, как просил)
        // ----------------------------
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
                    'allAccounts.isVerified': true,
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
                    'allAccounts.isVerified': true,
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
                id: cap(p.id), // UI label
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
                musicGenreBlock,
                profileTypeBlock,
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
                'allAccounts.isVerified': true,
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

        if (filters.currency) {
            pipeline.push({
                $match: {
                    'allAccounts.currency': filters.currency
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
                    $mergeObjects: ['$$a', { socialMedia: sm }],
                },
            },
        }));

        const matchAcc = {
            'acc.isVerified': true,
            'acc.isHidden': { $ne: true },
            'acc.isDeleted': { $ne: true },
        };

        const pipeline: any[] = [
            {
                $project: {
                    influencerId: '$_id',
                    accAll: { $concatArrays: concatParts },
                },
            },
            { $unwind: '$accAll' },
            { $set: { acc: '$accAll' } },

            { $match: matchAcc },

            { $match: { 'acc.username': usernameRegex } },

            { $skip: skip },
            { $limit: limit },

            {
                $project: {
                    _id: 0,
                    accountId: { $toString: '$acc._id' },
                    influencerId: { $toString: '$influencerId' },
                    username: '$acc.username',
                    logoUrl: '$acc.logoUrl',
                    followers: '$acc.followers',
                    socialMedia: '$acc.socialMedia',
                    countries: { $ifNull: ['$acc.countries', []] },

                    musicGenres: {
                        $cond: [
                            { $isArray: '$acc.musicGenres' },
                            { $map: { input: '$acc.musicGenres', as: 'g', in: '$$g.genre' } },
                            '$$REMOVE',
                        ],
                    },
                    creatorCategories: { $ifNull: ['$acc.creatorCategories', '$$REMOVE'] },
                    categories: { $ifNull: ['$acc.categories', '$$REMOVE'] },

                    // todo: currency conversion
                    prices: {
                        EUR: { $ifNull: ['$acc.publicPrice', { $literal: 0 }] },
                        USD: { $literal: 0 },
                        GBP: { $literal: 0 },
                    },
                },
            },
        ];

        return this.influencerRepo.aggregate<FoundAccountDto>(pipeline).allowDiskUse(true);
    }
}
