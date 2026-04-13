import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException} from "@nestjs/common";
import {InfluencerRepository} from "../../../database/repositories/users/influencer.repository";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {AdminInfluencersListDto, AdminSocialAccountForListDto} from "../dto/influencers/admin-influencers.dto";
import {AdminInfluencersQueryDto} from "../dto/influencers/admin-influencers-query.dto";
import {
    mapInfluencerToAccountDetailsDto,
    mapToAdminInfluencerListItem,
    mapToAdminSocialAccountForListDto, mapToSocialAccountDetailsDto,
} from "../../../common/mappers/influencer.mapper";
import {XlsxImporter} from "../../../common/utils/import/xlsx/xlsx-import";
import {Influencer, SocialAccount} from "../../../database/schemas/users/influencer.schema";
import {
    AdminUpdateInfluencerPersonalDto,
    AdminUpdateSocialAccountDto
} from "../dto/influencers/admin-update-influencer.dto";
import {UpdateSocialAccountService} from "../../profile/services/update-social-account.service";
import {AddSocialAccountDto, InfluencerUpdatedPersonalDto} from "../../profile/dto/influencer/update-influencer.dto";
import {UpdateInfluencerService} from "../../profile/services/update-influencer.service";
import {
    GetSocialAccountDetailsParamsDto,
    InfluencerAccountDetailsDto
} from "../../profile/dto/influencer/get-profile.dto";
import {SocialAccountDetails} from "../../../common/types/influencer/influencer.types";
import {Types} from "mongoose";
import {CreateSocialAccountService} from "../../profile/services/create-social-account.service";

// Interface for AdminInfluencersService, AdminInfluencersController
export interface IAdminInfluencersService {
    // Get paginated influencers list with optional platform filter and search
    getPaginated(query: AdminInfluencersQueryDto): Promise<AdminInfluencersListDto>;

    // Get influencer's details
    getDetails(influencerId: string): Promise<InfluencerAccountDetailsDto>;

    // Updates influencer's personal information
    // 1) Returns just updated personal info if accountId IS NOT provided;
    // 2) Returns AdminSocialAccountForListDto if accountId IS provided
    updatePersonalInfo(
        influencerId: string,
        data: AdminUpdateInfluencerPersonalDto,
        accountId?: string
    ): Promise<InfluencerUpdatedPersonalDto | AdminSocialAccountForListDto>;

    // Create new social account
    createSocialAccount(data: AddSocialAccountDto): Promise<InfluencerAccountDetailsDto>;

    // Update social account
    updateSocialAccount(data: AdminUpdateSocialAccountDto): Promise<AdminSocialAccountForListDto>;

    // Import xlsx file with new social accounts
    importXlsxSocialAccounts(
        socialMedia: SocialMediaEnum,
        file: Express.Multer.File
    ): Promise<void>;

    // Returns detailed social account
    getDetailedSocialAccount(data: GetSocialAccountDetailsParamsDto): Promise<SocialAccountDetails>;
}

@Injectable()
export class AdminInfluencersService implements IAdminInfluencersService {
    constructor(
        private readonly influencerRepo: InfluencerRepository,
        // For importing xlsx files
        private readonly xlsxImporter: XlsxImporter,
        // For updating influencer's personal info
        private readonly updateInfluencerService: UpdateInfluencerService,
        // For creating social account
        private readonly createSocialAccountService: CreateSocialAccountService,
        // For updating social account
        private readonly updateSocialAccountService: UpdateSocialAccountService,
    ) {
    }

    // Get paginated influencers list with optional platform filter and search
    async getPaginated(query: AdminInfluencersQueryDto): Promise<AdminInfluencersListDto> {
        const result = await this.influencerRepo.findInfluencers(query);

        return {
            ...result,
            items: result.items?.length > 0 ? result.items.map(acc => mapToAdminSocialAccountForListDto(acc)) : []
        }
    }

    // Get influencer's details
    async getDetails(influencerId: string): Promise<InfluencerAccountDetailsDto> {
        if (!influencerId) throw new BadRequestException('Influencer ID is required');

        const influencer = await this.influencerRepo.findById(influencerId);
        if (!influencer) throw new NotFoundException('Influencer not found');

        return mapInfluencerToAccountDetailsDto(influencer);
    }

    // Create new social account
    async createSocialAccount(data: AddSocialAccountDto): Promise<InfluencerAccountDetailsDto> {
        return this.createSocialAccountService.execute(
            data,
            (influencer: Influencer): InfluencerAccountDetailsDto => mapInfluencerToAccountDetailsDto(influencer),
            true
        );
    }

    // Update social account
    async updatePersonalInfo(influencerId: string, data: AdminUpdateInfluencerPersonalDto, accountId?: string): Promise<AdminSocialAccountForListDto | InfluencerUpdatedPersonalDto> {
        const updated = await this.updateInfluencerService.exec(influencerId, data);

        if (typeof accountId === 'string' && accountId.trim() !== '') {
            const readModel = mapToAdminInfluencerListItem(updated, accountId);
            return mapToAdminSocialAccountForListDto(readModel);
        } else {
            return {
                firstName: updated.firstName,
                lastName: updated.lastName,
                logoUrl: updated.logoUrl,
                email: updated.email,
                phone: updated.phone
            } satisfies InfluencerUpdatedPersonalDto;
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

    async updateSocialAccount(data: AdminUpdateSocialAccountDto): Promise<AdminSocialAccountForListDto> {
        return await this.updateSocialAccountService.execute(data, true) as AdminSocialAccountForListDto;
    }

    // Import xlsx file with new social accounts
    async importXlsxSocialAccounts(
        socialMedia: SocialMediaEnum,
        file: Express.Multer.File,
    ): Promise<void> {
        const accounts: Partial<Influencer>[] = await this.xlsxImporter.importInfluencers(file, socialMedia);

        if (accounts.length === 0) {
            throw new InternalServerErrorException(
                "Something went wrong. Didn't proceed any account",
            );
        }

        // Group imported rows by email and merge duplicated rows inside the same file
        const grouped: Record<string, Partial<Influencer>> = {};

        for (const item of accounts) {
            const email = item.email?.trim().toLowerCase();

            if (!email) {
                continue;
            }

            if (!grouped[email]) {
                grouped[email] = {
                    ...item,
                    email,
                    instagram: item.instagram ?? [],
                    tiktok: item.tiktok ?? [],
                    spotify: item.spotify ?? [],
                    soundcloud: item.soundcloud ?? [],
                    facebook: item.facebook ?? [],
                    youtube: item.youtube ?? [],
                    press: item.press ?? [],
                };

                continue;
            }

            const existingGrouped = grouped[email];

            // Merge only the target social media array for duplicated rows in the same file
            const currentAccounts = (existingGrouped[socialMedia] ?? []) as SocialAccount[];
            const newAccounts = (item[socialMedia] ?? []) as SocialAccount[];

            const mergedMap = new Map<string, SocialAccount>();

            for (const socialAccount of currentAccounts) {
                const key = socialAccount.username?.trim().toLowerCase()
                    || socialAccount.profileLink?.trim().toLowerCase()
                    || String(socialAccount._id);

                mergedMap.set(key, socialAccount);
            }

            for (const socialAccount of newAccounts) {
                const key = socialAccount.username?.trim().toLowerCase()
                    || socialAccount.profileLink?.trim().toLowerCase()
                    || String(socialAccount._id);

                if (!mergedMap.has(key)) {
                    mergedMap.set(key, socialAccount);
                    continue;
                }

                const existingSocialAccount = mergedMap.get(key)!;

                // Update duplicated account with newer imported values
                mergedMap.set(key, {
                    ...existingSocialAccount,
                    ...socialAccount,
                    _id: existingSocialAccount._id ?? socialAccount._id,
                } as SocialAccount);
            }

            existingGrouped[socialMedia] = Array.from(mergedMap.values()) as any;

            // Fill empty base influencer fields from duplicated rows if needed
            if (!existingGrouped.firstName && item.firstName) {
                existingGrouped.firstName = item.firstName;
            }

            if (!existingGrouped.lastName && item.lastName) {
                existingGrouped.lastName = item.lastName;
            }

            if (!existingGrouped.phone && item.phone) {
                existingGrouped.phone = item.phone;
            }

            if (!existingGrouped.logoUrl && item.logoUrl) {
                existingGrouped.logoUrl = item.logoUrl;
            }
        }

        const emails = Object.keys(grouped);

        if (emails.length === 0) {
            throw new InternalServerErrorException(
                "Something went wrong. Didn't find valid accounts with email",
            );
        }

        // Load all existing influencers by email in a single query
        const existingInfluencers = await this.influencerRepo.findMany({
            email: {$in: emails},
        });

        const existingMap = new Map<string, Influencer>();

        for (const influencer of existingInfluencers) {
            if (influencer.email) {
                existingMap.set(influencer.email.toLowerCase(), influencer);
            }
        }

        // Build bulk operations
        const ops: any[] = [];

        for (const [email, importedInfluencer] of Object.entries(grouped)) {
            const found = existingMap.get(email);
            const importedSocialAccounts = (importedInfluencer[socialMedia] ?? []) as SocialAccount[];

            if (!importedSocialAccounts.length) {
                continue;
            }

            // Insert a new influencer if email does not exist in database
            if (!found) {
                ops.push({
                    insertOne: {
                        document: importedInfluencer,
                    },
                });

                continue;
            }

            const existingSocialAccounts = (found[socialMedia] ?? []) as SocialAccount[];

            // Merge existing DB accounts with imported accounts by username/profileLink
            const mergedMap = new Map<string, SocialAccount>();

            for (const socialAccount of existingSocialAccounts) {
                const key = socialAccount.username?.trim().toLowerCase()
                    || socialAccount.profileLink?.trim().toLowerCase()
                    || String(socialAccount._id);

                mergedMap.set(key, socialAccount);
            }

            for (const socialAccount of importedSocialAccounts) {
                const key = socialAccount.username?.trim().toLowerCase()
                    || socialAccount.profileLink?.trim().toLowerCase()
                    || String(socialAccount._id);

                if (!mergedMap.has(key)) {
                    mergedMap.set(key, socialAccount);
                    continue;
                }

                const existingSocialAccount = mergedMap.get(key)!;

                // Update existing account with imported values
                mergedMap.set(key, {
                    ...existingSocialAccount,
                    ...socialAccount,
                    _id: existingSocialAccount._id ?? socialAccount._id,
                } as SocialAccount);
            }

            const mergedAccounts = Array.from(mergedMap.values());

            ops.push({
                updateOne: {
                    filter: {_id: found._id},
                    update: {
                        $set: {
                            [socialMedia]: mergedAccounts,
                        },
                    },
                },
            });
        }

        if (ops.length === 0) {
            return;
        }

        // Execute bulk operations in chunks to avoid very large payloads
        const chunkSize = 500;

        for (let i = 0; i < ops.length; i += chunkSize) {
            const chunk = ops.slice(i, i + chunkSize);

            const result = await this.influencerRepo.bulkWrite(chunk, {ordered: false});

            if ((result as any)?.mongoose?.results?.length) {
                (result as any).mongoose.results.forEach((item: any, index: number) => {
                    if (item instanceof Error) {
                        console.log(`bulk op #${index} failed`);
                        console.log(item.message);
                        console.log(item);
                    }
                });
            }
        }
    }
}