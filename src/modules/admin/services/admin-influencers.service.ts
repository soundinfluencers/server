import {BadRequestException, Injectable, InternalServerErrorException} from "@nestjs/common";
import {InfluencerRepository} from "../../../database/repositories/users/influencer.repository";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {AdminInfluencersListDto, AdminSocialAccountsSearchResponseDto} from "../dto/influencers/admin-influencers.dto";
import {mapToAdminSocialAccountForListDto} from "../../../common/mappers/influencer.mapper";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {XlsxImporter} from "../../../common/utils/import/xlsx/xlsx-import";
import {Influencer, SocialAccount} from "../../../database/schemas/users/influencer.schema";

// Interface for AdminInfluencersService, AdminInfluencersController
export interface IAdminInfluencersService {
    // Get paginated influencers list filtered by social media
    getInfluencersList(
        socialMedia: SocialMediaEnum,
        query: PaginationQueryDto,
    ): Promise<AdminInfluencersListDto>;

    // Search social accounts
    searchSocialAccounts(query: SearchQueryDto): Promise<AdminSocialAccountsSearchResponseDto>;

    // Import xlsx file with new social accounts
    importXlsxSocialAccounts(
        socialMedia: SocialMediaEnum,
        file: Express.Multer.File
    ): Promise<void>;
}

@Injectable()
export class AdminInfluencersService implements IAdminInfluencersService {
    constructor(
        private readonly influencerRepo: InfluencerRepository,

        // For importing xlsx files
        private readonly xlsxImporter: XlsxImporter,
    ) {
    }

    // Get paginated influencers list filtered by social media
    async getInfluencersList(socialMedia: SocialMediaEnum, query: PaginationQueryDto): Promise<AdminInfluencersListDto> {
        const list = await this.influencerRepo.findPaginated(
            socialMedia,
            query,
        );

        return {
            ...list,
            items: list.items?.length > 0 ? list.items.map(acc => mapToAdminSocialAccountForListDto(acc)) : []
        }
    }

    // Search social accounts
    async searchSocialAccounts(query: SearchQueryDto): Promise<AdminSocialAccountsSearchResponseDto> {
        const searchResult = await this.influencerRepo.findSocialAccountBySearch(query);
        return {
            ...searchResult,
            items: searchResult.items.map(acc => mapToAdminSocialAccountForListDto(acc))
        }
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

        console.log('socialMedia:', socialMedia);
        console.log('accounts length:', accounts.length);
        console.log('first account:', JSON.stringify(accounts[0], null, 2));

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
            email: { $in: emails },
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
                    filter: { _id: found._id },
                    update: {
                        $set: {
                            [socialMedia]: mergedAccounts,
                        },
                    },
                },
            });
        }

        console.log('grouped emails:', Object.keys(grouped).length);
        console.log('ops length:', ops.length);

        if (ops.length === 0) {
            return;
        }

        // Execute bulk operations in chunks to avoid very large payloads
        const chunkSize = 500;

        for (let i = 0; i < ops.length; i += chunkSize) {
            const chunk = ops.slice(i, i + chunkSize);

            const result = await this.influencerRepo.bulkWrite(chunk, { ordered: false });
            console.log('bulkWrite result:', result);
        }
    }
}