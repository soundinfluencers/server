import {BadRequestException, Injectable} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {Types} from 'mongoose';
import {Influencer, SocialAccount} from "../../../../database/schemas/users/influencer.schema";
import {AccountVerifiedStatus, Role} from "../../../types/user.types";
import {CurrencyCode} from "../../../types/finance.types";
import {InfluencerProfileCategory, SocialAccountLabelStatus} from "../../../types/influencer/influencer.types";
import {SocialMediaEnum} from "../../../types/social-media.types";
import {XlsxCampaignDto} from "../../../../modules/admin/dto/campaigns/xlsx-campaign.dto";

@Injectable()
export class XlsxImporter {
    private readonly supportedSocials: SocialMediaEnum[] = Object.values(SocialMediaEnum);
    private readonly defaultSocialLogoUrl = "https://dl.dropboxusercontent.com/scl/fi/2azbdbvvujzb5b1yd3iqx/2025-11-28T08-15-10.280Zjusthitsongs_avatar_1764317710280.jpeg?rlkey=b9snlaxtg91cms0678rvxy83y&dl=0";

    async importInfluencers(
        file: Express.Multer.File,
        socialMedia: SocialMediaEnum,
    ): Promise<Partial<Influencer>[]> {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        if (!this.supportedSocials.includes(socialMedia)) {
            throw new BadRequestException("Provided social media isn't supported.")
        }

        const workbook = new ExcelJS.Workbook();

        try {
            await workbook.xlsx.load(file.buffer as any);
        } catch {
            throw new BadRequestException('Invalid xlsx file');
        }

        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            throw new BadRequestException('Workbook does not contain any worksheets');
        }

        const matrix = this.readWorksheetMatrix(worksheet);
        const headerMap = this.findInfluencerTableHeaderRow(matrix, socialMedia);

        return this.readInfluencerRows(matrix, headerMap, socialMedia);
    }

    async importProposalCampaign(file: Express.Multer.File): Promise<XlsxCampaignDto> {
        if (!file) {
            throw new BadRequestException('File is required');
        }

        const workbook = new ExcelJS.Workbook();

        try {
            await workbook.xlsx.load(file.buffer as any);
        } catch {
            throw new BadRequestException('Invalid xlsx file');
        }

        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            throw new BadRequestException('Workbook does not contain any worksheets');
        }

        const matrix = this.readWorksheetMatrix(worksheet);

        const campaignName = this.findValueNearLabel(
            matrix,
            ['project:'],
        );

        const price = this.findNumberNearLabel(
            matrix,
            ['price:'],
        );

        const timeline =
            this.findValueNearLabel(matrix, ['release date:']) ??
            this.findValueNearLabel(matrix, ['timeline:']) ??
            '';

        const socialMediaRaw =
            this.findValueNearLabel(matrix, ['socialmedia']) ??
            this.findValueNearLabel(matrix, ['social media']);

        const socialMedia =
            this.parseCampaignSocialMedia(socialMediaRaw) ?? 'multipromo';

        const headerMap = this.findCampaignTableHeaderRow(matrix);

        const pages = this.readCampaignPages(matrix, headerMap);

        if (!campaignName) {
            throw new BadRequestException('Campaign name not found');
        }

        if (!pages.length) {
            throw new BadRequestException('No campaign pages found in xlsx');
        }

        return {
            campaignName,
            price,
            timeline,
            socialMedia,
            pages,
        };
    }

    private readWorksheetMatrix(
        worksheet: ExcelJS.Worksheet,
    ): (string | null)[][] {
        const matrix: (string | null)[][] = [];

        for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            const rowValues: (string | null)[] = [];

            for (let colNumber = 1; colNumber <= worksheet.columnCount; colNumber++) {
                const value = this.extractCellValue(row.getCell(colNumber).value);
                rowValues.push(this.toNullableString(value));
            }

            matrix.push(rowValues);
        }

        return matrix;
    }

    private findValueNearLabel(
        matrix: (string | null)[][],
        labels: string[],
    ): string | null {
        const normalizedLabels = labels.map((label) => this.normalizeHeader(label));

        for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
            for (let colIndex = 0; colIndex < matrix[rowIndex].length; colIndex++) {
                const current = this.normalizeHeader(matrix[rowIndex][colIndex] ?? '');

                if (!normalizedLabels.includes(current)) continue;

                const sameRowRight = this.toNullableString(matrix[rowIndex][colIndex + 1]);
                if (sameRowRight) return sameRowRight;

                const sameRowRight2 = this.toNullableString(matrix[rowIndex][colIndex + 2]);
                if (sameRowRight2) return sameRowRight2;

                const nextRowSameCol = this.toNullableString(matrix[rowIndex + 1]?.[colIndex]);
                if (nextRowSameCol) return nextRowSameCol;

                const nextRowRight = this.toNullableString(matrix[rowIndex + 1]?.[colIndex + 1]);
                if (nextRowRight) return nextRowRight;
            }
        }

        return null;
    }

    private findNumberNearLabel(
        matrix: (string | null)[][],
        labels: string[],
    ): number | null {
        const raw = this.findValueNearLabel(matrix, labels);

        if (!raw) return null;

        const parsed = this.toNumber(raw, NaN);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private parseCampaignSocialMedia(
        value: unknown,
    ): SocialMediaEnum | 'multipromo' | null {
        const normalized = this.normalizeHeader(this.toNullableString(value) ?? '');

        if (!normalized) return null;
        if (normalized === 'multipromo') return 'multipromo';

        return this.toEnumValue<SocialMediaEnum>(
            normalized,
            Object.values(SocialMediaEnum),
        ) ?? null;
    }

    private findCampaignTableHeaderRow(
        matrix: (string | null)[][],
    ): {
        rowIndex: number;
        columns: {
            platform?: number;
            brandName?: number;
            followers?: number;
            videoLink?: number;
            description?: number;
            storyTag?: number;
            storyLink?: number;
            specialRequest?: number;
        };
    } {
        for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
            const normalizedRow = matrix[rowIndex].map((cell) =>
                this.normalizeHeader(cell ?? ''),
            );

            const columns = {
                platform: normalizedRow.findIndex((v) => v === 'platform'),
                brandName: normalizedRow.findIndex((v) => v === 'brandname'),
                followers: normalizedRow.findIndex((v) => v === 'followers'),
                videoLink: normalizedRow.findIndex((v) => v === 'videolink:' || v === 'videolink'),
                description: normalizedRow.findIndex((v) => v === 'description:' || v === 'description'),
                storyTag: normalizedRow.findIndex((v) => v === 'storytag:' || v === 'storytag'),
                storyLink: normalizedRow.findIndex((v) => v === 'storylink:' || v === 'storylink'),
                specialRequest: normalizedRow.findIndex((v) => v === 'specialrequest:' || v === 'specialrequest'),
            };

            const hasRequiredColumns =
                columns.brandName !== -1 &&
                columns.followers !== -1 &&
                columns.videoLink !== -1 &&
                columns.description !== -1;

            if (hasRequiredColumns) {
                return {
                    rowIndex,
                    columns: {
                        ...(columns.platform !== -1 ? {platform: columns.platform} : {}),
                        ...(columns.brandName !== -1 ? {brandName: columns.brandName} : {}),
                        ...(columns.followers !== -1 ? {followers: columns.followers} : {}),
                        ...(columns.videoLink !== -1 ? {videoLink: columns.videoLink} : {}),
                        ...(columns.description !== -1 ? {description: columns.description} : {}),
                        ...(columns.storyTag !== -1 ? {storyTag: columns.storyTag} : {}),
                        ...(columns.storyLink !== -1 ? {storyLink: columns.storyLink} : {}),
                        ...(columns.specialRequest !== -1 ? {specialRequest: columns.specialRequest} : {}),
                    },
                };
            }
        }

        throw new BadRequestException('Campaign table headers not found');
    }

    private readCampaignPages(
        matrix: (string | null)[][],
        headerMap: {
            rowIndex: number;
            columns: {
                platform?: number;
                brandName?: number;
                followers?: number;
                videoLink?: number;
                description?: number;
                storyTag?: number;
                storyLink?: number;
                specialRequest?: number;
            };
        },
    ): XlsxCampaignDto['pages'] {
        const pages: XlsxCampaignDto['pages'] = [];

        for (let rowIndex = headerMap.rowIndex + 1; rowIndex < matrix.length; rowIndex++) {
            const row = matrix[rowIndex];

            const username = this.getCellByColumn(row, headerMap.columns.brandName);
            const followersRaw = this.getCellByColumn(row, headerMap.columns.followers);
            const mainLink = this.getCellByColumn(row, headerMap.columns.videoLink);
            const description = this.getCellByColumn(row, headerMap.columns.description);
            const taggedUser = this.getCellByColumn(row, headerMap.columns.storyTag);
            const taggedLink = this.getCellByColumn(row, headerMap.columns.storyLink);
            const additionalBrief = this.getCellByColumn(row, headerMap.columns.specialRequest);

            const platformRaw = this.getCellByColumn(row, headerMap.columns.platform);

            const isTotalRow =
                this.normalizeHeader(username ?? '') === 'total:' ||
                this.normalizeHeader(platformRaw ?? '') === 'total:' ||
                this.normalizeHeader(platformRaw ?? '') === 'total';

            if (isTotalRow) {
                break;
            }

            const hasAnyUsefulData = [
                username,
                followersRaw,
                mainLink,
                description,
                taggedUser,
                taggedLink,
                additionalBrief,
            ].some((value) => value !== null && value !== undefined && String(value).trim() !== '');

            if (!hasAnyUsefulData) {
                continue;
            }

            if (!username) {
                continue;
            }

            const followers = this.toNumber(followersRaw, 0);

            pages.push({
                username,
                followers,
                mainLink,
                taggedUser,
                taggedLink,
                description,
                additionalBrief,
            });
        }

        return pages;
    }

    private getCellByColumn(
        row: (string | null)[],
        columnIndex?: number,
    ): string | null {
        if (columnIndex === undefined || columnIndex < 0) return null;
        return this.toNullableString(row[columnIndex]);
    }

    private findInfluencerTableHeaderRow(
        matrix: (string | null)[][],
        socialMedia: SocialMediaEnum,
    ): {
        rowIndex: number;
        columns: {
            brandName?: number;
            firstName?: number;
            lastName?: number;
            phone?: number;
            email?: number;
            profileLink?: number;
            followers?: number;
            price?: number;
            publicPrice?: number;
            initialPrice?: number;
            engagementRate?: number;
            averageViews?: number;
        };
    } {
        for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
            const normalizedRow = matrix[rowIndex].map((cell) =>
                this.normalizeHeader(cell ?? ''),
            );

            const columns = {
                brandName: normalizedRow.findIndex((v) =>
                    ['brandname', 'username', `${socialMedia}username`].includes(v),
                ),
                firstName: normalizedRow.findIndex((v) =>
                    ['firstname', 'name', 'contactname'].includes(v),
                ),
                lastName: normalizedRow.findIndex((v) =>
                    ['lastname', 'surname'].includes(v),
                ),
                phone: normalizedRow.findIndex((v) =>
                    ['phone', 'phonenumber', 'mobilenumber'].includes(v),
                ),
                email: normalizedRow.findIndex((v) =>
                    ['email', 'emailaddress', 'mail'].includes(v),
                ),
                profileLink: normalizedRow.findIndex((v) =>
                    [
                        `${socialMedia}profilelink`,
                        'profilelink',
                        'iglink',
                        'instagramlink',
                        'link',
                        'url',
                    ].includes(v),
                ),
                followers: normalizedRow.findIndex((v) =>
                    [
                        `${socialMedia}followers`,
                        'followers',
                        'ttlittgfollow',
                        'ttfollowers',
                        'igfollowers',
                    ].includes(v),
                ),
                price: normalizedRow.findIndex((v) =>
                    [
                        `${socialMedia}price`,
                        'price',
                        'ttprice',
                        'igprice',
                        'offerprice',
                    ].includes(v),
                ),
                publicPrice: normalizedRow.findIndex((v) =>
                    [`${socialMedia}publicprice`, 'publicprice'].includes(v),
                ),
                initialPrice: normalizedRow.findIndex((v) =>
                    [`${socialMedia}initialprice`, 'initialprice'].includes(v),
                ),
                engagementRate: normalizedRow.findIndex((v) =>
                    [`${socialMedia}engagementrate`, 'engagementrate'].includes(v),
                ),
                averageViews: normalizedRow.findIndex((v) =>
                    [`${socialMedia}averageviews`, 'averageviews', 'averagevie'].includes(v),
                ),
            };

            const hasRequiredColumns =
                columns.brandName !== -1 &&
                columns.email !== -1;

            if (hasRequiredColumns) {
                return {
                    rowIndex,
                    columns: {
                        ...(columns.brandName !== -1 ? { brandName: columns.brandName } : {}),
                        ...(columns.firstName !== -1 ? { firstName: columns.firstName } : {}),
                        ...(columns.lastName !== -1 ? { lastName: columns.lastName } : {}),
                        ...(columns.phone !== -1 ? { phone: columns.phone } : {}),
                        ...(columns.email !== -1 ? { email: columns.email } : {}),
                        ...(columns.profileLink !== -1 ? { profileLink: columns.profileLink } : {}),
                        ...(columns.followers !== -1 ? { followers: columns.followers } : {}),
                        ...(columns.price !== -1 ? { price: columns.price } : {}),
                        ...(columns.publicPrice !== -1 ? { publicPrice: columns.publicPrice } : {}),
                        ...(columns.initialPrice !== -1 ? { initialPrice: columns.initialPrice } : {}),
                        ...(columns.engagementRate !== -1 ? { engagementRate: columns.engagementRate } : {}),
                        ...(columns.averageViews !== -1 ? { averageViews: columns.averageViews } : {}),
                    },
                };
            }
        }

        throw new BadRequestException('Influencer table headers not found');
    }

    private readInfluencerRows(
        matrix: (string | null)[][],
        headerMap: {
            rowIndex: number;
            columns: {
                brandName?: number;
                firstName?: number;
                lastName?: number;
                phone?: number;
                email?: number;
                profileLink?: number;
                followers?: number;
                price?: number;
                publicPrice?: number;
                initialPrice?: number;
                engagementRate?: number;
                averageViews?: number;
            };
        },
        socialMedia: SocialMediaEnum,
    ): Partial<Influencer>[] {
        const result: Partial<Influencer>[] = [];

        for (let rowIndex = headerMap.rowIndex + 1; rowIndex < matrix.length; rowIndex++) {
            const row = matrix[rowIndex];

            const email = this.getCellByColumn(row, headerMap.columns.email);
            const username = this.getCellByColumn(row, headerMap.columns.brandName);
            const firstName = this.getCellByColumn(row, headerMap.columns.firstName);
            const lastName = this.getCellByColumn(row, headerMap.columns.lastName);
            const phone = this.getCellByColumn(row, headerMap.columns.phone);
            const profileLink = this.getCellByColumn(row, headerMap.columns.profileLink);
            const followers = this.getCellByColumn(row, headerMap.columns.followers);
            const price = this.getCellByColumn(row, headerMap.columns.price);
            const publicPrice = this.getCellByColumn(row, headerMap.columns.publicPrice);
            const initialPrice = this.getCellByColumn(row, headerMap.columns.initialPrice);
            const engagementRate = this.getCellByColumn(row, headerMap.columns.engagementRate);
            const averageViews = this.getCellByColumn(row, headerMap.columns.averageViews);

            const hasAnyUsefulData = [
                email,
                username,
                firstName,
                phone,
                profileLink,
                followers,
                price,
                publicPrice,
                initialPrice,
                engagementRate,
                averageViews,
            ].some((value) => value !== null && String(value).trim() !== '');

            if (!hasAnyUsefulData) {
                continue;
            }

            if (!email) {
                continue;
            }

            const normalizedRow: Record<string, unknown> = {
                email,
                firstname: firstName,
                lastname: lastName,
                phone,

                username,
                profilelink: profileLink,
                followers,
                price,
                publicprice: publicPrice,
                initialprice: initialPrice,
                engagementrate: engagementRate,
                averageviews: averageViews,
            };

            result.push(
                this.mapRowToInfluencer(normalizedRow, rowIndex + 1, socialMedia),
            );
        }

        return result;
    }

    private mapRowToInfluencer(
        row: Record<string, unknown>,
        excelRowNumber: number,
        socialMedia: SocialMediaEnum,
    ): Partial<Influencer> {
        const email = this.toNullableString(row.email)?.toLowerCase() ?? '';
        const firstName = this.toNullableString(row.firstname) ?? '';
        const lastName = this.toNullableString(row.lastname) ?? undefined;
        const phone = this.toNullableString(row.phone) ?? '';
        const logoUrl = this.toNullableString(row.logourl) ?? undefined;

        if (!email) {
            throw new BadRequestException(`Row ${excelRowNumber}: email is required`);
        }

        const influencer: Partial<Influencer> = {
            _id: new Types.ObjectId(),
            schemaVersion: 2,
            role: Role.influencer,
            balance: this.toNumber(row.balance, 0),
            firstName,
            lastName,
            logoUrl,
            email,
            phone,
            password: this.toNullableString(row.password) ?? '',
            internalNote: this.toNullableString(row.internalnote) ?? '',
            currencyNote: this.toNullableString(row.currencynote) ?? '',
            refreshToken: null,
            verifiedStatus:
                this.toEnumValue<AccountVerifiedStatus>(
                    row.verifiedstatus,
                    Object.values(AccountVerifiedStatus),
                ) ?? AccountVerifiedStatus.waitForAdmin,
            notificationMethods: {
                whatsapp: this.toBoolean(row.notification_whatsapp, false),
                telegram: this.toBoolean(row.notification_telegram, false),
            },
            instagram: [],
            tiktok: [],
            spotify: [],
            soundcloud: [],
            facebook: [],
            youtube: [],
            press: [],
        };

        const account = this.mapSocialAccount(row, socialMedia);

        if (account) {
            influencer[socialMedia] = [account] as any;
        }

        return influencer;
    }

    private mapSocialAccount(
        row: Record<string, unknown>,
        social: SocialMediaEnum,
    ): SocialAccount | null {
        const getValue = (...keys: string[]): unknown => {
            for (const key of keys) {
                const value = row[key];

                if (value !== null && value !== undefined && String(value).trim() !== '') {
                    return value;
                }
            }

            return null;
        };

        const username = this.toNullableString(
            getValue(`${social}_username`, 'username', 'brandname'),
        );

        const profileLink = this.toNullableString(
            getValue(`${social}_profilelink`, 'profilelink', 'iglink', 'link'),
        ) ?? this.buildProfileLink(social, username);

        const hasAnySocialData = [
            getValue(`${social}_username`, 'username', 'brandname'),
            getValue(`${social}_profilelink`, 'profilelink', 'iglink', 'link'),
            getValue(`${social}_followers`, 'followers', 'ttlittgfollow'),
            getValue(`${social}_price`, 'price', 'ttprice', 'offerprice'),
            getValue(`${social}_publicprice`, 'publicprice'),
            getValue(`${social}_initialprice`, 'initialprice'),
        ].some((v) => v !== null && v !== undefined && String(v).trim() !== '');

        if (!hasAnySocialData) {
            return null;
        }

        if (!username) {
            throw new BadRequestException(`${social}: username is required if account is present`);
        }

        const currency =
            this.toEnumValue<CurrencyCode>(
                getValue(`${social}_currency`, 'currency'),
                Object.values(CurrencyCode),
            ) ?? CurrencyCode.EUR;

        const initialPrice = this.toNumber(
            getValue(`${social}_initialprice`, 'initialprice'),
            0,
        );

        const price = this.toNumber(
            getValue(`${social}_price`, 'price', 'ttprice', 'offerprice'),
            initialPrice,
        );

        const publicPrice = this.toNumber(
            getValue(`${social}_publicprice`, 'publicprice'),
            price * 2,
        );

        return {
            _id: new Types.ObjectId(),
            username,
            profileLink: profileLink ?? '',
            followers: this.toNumber(
                getValue(`${social}_followers`, 'followers', 'ttlittgfollow'),
                0,
            ),
            logoUrl: this.toNullableString(
                getValue(`${social}_logourl`, 'logourl'),
            ) ?? this.defaultSocialLogoUrl,
            profileCategory:
                this.toEnumValue<InfluencerProfileCategory>(
                    getValue(`${social}_profilecategory`, 'profilecategory'),
                    Object.values(InfluencerProfileCategory),
                ) ?? InfluencerProfileCategory.community,
            price,
            publicPrice,
            currency,
            initialPrice,
            countries: this.parseCountries(
                getValue(`${social}_countries`, 'countries'),
            ),
            musicGenres: this.parseMusicGenres(
                getValue(`${social}_musicgenres`, 'musicgenres'),
            ),
            creatorCategories: this.parseStringArray(
                getValue(`${social}_creatorcategories`, 'creatorcategories'),
            ),
            categories: this.parseStringArray(
                getValue(`${social}_categories`, 'categories'),
            ),
            engagementRate: this.toOptionalNumber(
                getValue(`${social}_engagementrate`, 'engagementrate'),
            ),
            averageViews: this.toOptionalNumber(
                getValue(`${social}_averageviews`, 'averageviews', 'averagevie'),
            ),
            isHidden: this.toBoolean(
                getValue(`${social}_ishidden`, 'ishidden'),
                false,
            ),
            isDeleted: this.toBoolean(
                getValue(`${social}_isdeleted`, 'isdeleted'),
                false,
            ),
            verifiedStatus:
                this.toEnumValue<AccountVerifiedStatus>(
                    getValue(`${social}_verifiedstatus`, 'verifiedstatus'),
                    Object.values(AccountVerifiedStatus),
                ) ?? AccountVerifiedStatus.waitForAdmin,
            labelStatus:
                this.toEnumValue<SocialAccountLabelStatus>(
                    getValue(`${social}_labelstatus`, 'labelstatus'),
                    Object.values(SocialAccountLabelStatus),
                ) ?? SocialAccountLabelStatus.waitForAdmin,
        } as SocialAccount;
    }

    private parseCountries(value: unknown): { country: string; percentage: number }[] {
        const raw = this.toNullableString(value);
        if (!raw) return [];

        return raw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => {
                const [country, percentage] = item.split(':').map((part) => part.trim());

                return {
                    country,
                    percentage: this.toNumber(percentage, 0),
                };
            })
            .filter((item) => item.country);
    }

    private parseMusicGenres(
        value: unknown,
    ): { genre: string; subGenres: string[] }[] | undefined {
        const raw = this.toNullableString(value);
        if (!raw) return undefined;

        const genres = raw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => {
                const [genre, subGenresRaw] = item.split(':').map((part) => part.trim());

                return {
                    genre,
                    subGenres: subGenresRaw
                        ? subGenresRaw
                            .split('|')
                            .map((sub) => sub.trim())
                            .filter(Boolean)
                        : [],
                };
            })
            .filter((item) => item.genre);

        return genres.length ? genres : undefined;
    }

    private parseStringArray(value: unknown): string[] | undefined {
        const raw = this.toNullableString(value);
        if (!raw) return undefined;

        const result = raw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        return result.length ? result : undefined;
    }

    private buildProfileLink(
        social: SocialMediaEnum,
        username?: string | null,
    ): string | null {
        if (!username) return null;

        const cleanUsername = username.replace(/^@/, '');

        switch (social) {
            case 'instagram':
                return `https://www.instagram.com/${cleanUsername}`;
            case 'tiktok':
                return `https://www.tiktok.com/@${cleanUsername}`;
            case 'facebook':
                return `https://www.facebook.com/${cleanUsername}`;
            case 'youtube':
                return `https://www.youtube.com/${cleanUsername}`;
            case 'spotify':
            case 'soundcloud':
            case 'press':
            default:
                return null;
        }
    }

    private extractCellValue(value: ExcelJS.CellValue): unknown {
        if (value === null || value === undefined) return null;

        if (typeof value === 'object') {
            if ('text' in value) return value.text;
            if ('result' in value) return value.result ?? null;
            if ('richText' in value) {
                return value.richText.map((part) => part.text).join('');
            }
            if (value instanceof Date) return value.toISOString();
        }

        return value;
    }

    private normalizeHeader(value: string): string {
        return value.trim().toLowerCase().replace(/\s+/g, '');
    }

    private toNullableString(value: unknown): string | null {
        if (value === null || value === undefined) return null;

        const result = String(value).trim();
        return result ? result : null;
    }

    private toNumber(value: unknown, fallback = 0): number {
        if (value === null || value === undefined || value === '') return fallback;

        const normalized = String(value).replace(',', '.').replace(/[^\d.-]/g, '');
        const parsed = Number(normalized);

        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private toOptionalNumber(value: unknown): number | undefined {
        if (value === null || value === undefined || value === '') return undefined;

        const normalized = String(value).replace(',', '.').replace(/[^\d.-]/g, '');
        const parsed = Number(normalized);

        return Number.isFinite(parsed) ? parsed : undefined;
    }

    private toBoolean(value: unknown, fallback = false): boolean {
        if (value === null || value === undefined || value === '') return fallback;
        if (typeof value === 'boolean') return value;

        const normalized = String(value).trim().toLowerCase();

        if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n'].includes(normalized)) return false;

        return fallback;
    }

    private toEnumValue<T extends string>(
        value: unknown,
        allowedValues: T[],
    ): T | undefined {
        const normalized = this.toNullableString(value);
        if (!normalized) return undefined;

        return allowedValues.find(
            (item) => item.toLowerCase() === normalized.toLowerCase(),
        );
    }
}