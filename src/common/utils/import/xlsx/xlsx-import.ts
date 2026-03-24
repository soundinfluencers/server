import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Types } from 'mongoose';
import {Influencer, SocialAccount} from "../../../../database/schemas/users/influencer.schema";
import {AccountVerifiedStatus, Role} from "../../../types/user.types";
import {CurrencyCode} from "../../../types/finance.types";
import {InfluencerProfileCategory, SocialAccountLabelStatus} from "../../../types/influencer/influencer.types";
import {SocialMediaEnum} from "../../../types/social-media.types";

@Injectable()
export class XlsxImporter {
    private readonly supportedSocials: SocialMediaEnum[] = Object.values(SocialMediaEnum);

    async importInfluencers(file: Express.Multer.File, socialMedia: SocialMediaEnum): Promise<Partial<Influencer>[]> {
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

        const rows = this.readWorksheetAsObjects(worksheet);

        return rows.map((row, index) => this.mapRowToInfluencer(row, index + 2, socialMedia));
    }

    private readWorksheetAsObjects(
        worksheet: ExcelJS.Worksheet,
    ): Record<string, unknown>[] {
        const headerRow = worksheet.getRow(1);

        const headers = (headerRow.values as any)
            .slice(1)
            .map((value) => this.normalizeHeader(String(value ?? '')));

        const result: Record<string, unknown>[] = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const rowObj: Record<string, unknown> = {};

            headers.forEach((header, index) => {
                if (!header) return;

                const cellValue = row.getCell(index + 1).value;
                rowObj[header] = this.extractCellValue(cellValue);
            });

            const isEmpty = Object.values(rowObj).every(
                (value) => value === null || value === undefined || String(value).trim() === '',
            );

            if (!isEmpty) {
                result.push(rowObj);
            }
        });

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
            getValue(`${social}_username`, 'username'),
        );

        const profileLink = this.toNullableString(
            getValue(`${social}_profilelink`, 'profilelink'),
        ) ?? this.buildProfileLink(social, username);

        const hasAnySocialData = [
            getValue(`${social}_username`, 'username'),
            getValue(`${social}_profilelink`, 'profilelink'),
            getValue(`${social}_followers`, 'followers'),
            getValue(`${social}_price`, 'price'),
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
            getValue(`${social}_price`, 'price'),
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
                getValue(`${social}_followers`, 'followers'),
                0,
            ),
            logoUrl: this.toNullableString(
                getValue(`${social}_logourl`, 'logourl'),
            ) ?? '',
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
                getValue(`${social}_averageviews`, 'averageviews'),
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