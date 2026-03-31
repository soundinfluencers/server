import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { uniq } from 'lodash';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import {SelectInfluencerDto} from "../dto/create-campaign.dto";
import {CampaignAccount} from "../../../database/schemas/campaign/campaign.schema";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {AccountVerifiedStatus} from "../../../common/types/user.types";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../../../common/types/influencer/promo.types";

type ObjId = Types.ObjectId;
type AccountKey = `${SocialMediaEnum}:${string}`;
type UsernameKey = `${SocialMediaEnum}:${string}`;

type MinimalSocialAccount = {
    _id: ObjId;
    username?: string;
    followers?: number;
    price?: number;
    publicPrice?: number;
    verifiedStatus?: AccountVerifiedStatus;
    isDeleted?: boolean;
    isHidden?: boolean;
};

type MinimalInfluencer = {
    _id: ObjId;
} & Partial<Record<SocialMediaEnum, MinimalSocialAccount[]>>;

function toObjIdSafe(value?: string | Types.ObjectId | null): ObjId | null {
    if (!value) return null;

    if (value instanceof Types.ObjectId) {
        return value;
    }

    return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

@Injectable()
export class CampaignAccountsBuilderService {
    constructor(
        private readonly influencerRepo: InfluencerRepository,
    ) {}

    async buildCampaignAccountsBatch(
        addedAccountsData: SelectInfluencerDto[],
    ): Promise<CampaignAccount[]> {
        if (!addedAccountsData?.length) return [];

        const usedSocialMedia = uniq(
            addedAccountsData.map(a => a.socialMedia).filter(Boolean),
        );

        const influencerIdStrs = uniq(
            addedAccountsData.map(a => a.influencerId).filter(Boolean),
        );

        const influencerIds = influencerIdStrs
            .map(toObjIdSafe)
            .filter((x): x is ObjId => Boolean(x));

        const socialAccountIdStrs = uniq(
            addedAccountsData.map(a => a.socialAccountId).filter(Boolean),
        );

        const socialAccountIds = socialAccountIdStrs
            .map(toObjIdSafe)
            .filter((x): x is ObjId => Boolean(x));

        const usernamesByMedia = new Map<SocialMediaEnum, string[]>();

        for (const a of addedAccountsData) {
            if (!a.username) continue;

            const arr = usernamesByMedia.get(a.socialMedia) ?? [];
            arr.push(a.username);
            usernamesByMedia.set(a.socialMedia, arr);
        }

        for (const [sm, arr] of usernamesByMedia) {
            usernamesByMedia.set(sm, uniq(arr));
        }

        const projection: Record<string, 1> = { _id: 1 };
        for (const sm of usedSocialMedia) {
            projection[sm] = 1;
        }

        const influencers: MinimalInfluencer[] = influencerIds.length
            ? await this.influencerRepo.findMany(
                { _id: { $in: influencerIds } },
                { lean: true, select: Object.keys(projection) } as any,
            )
            : [];

        const hasMissingInfluencerId = addedAccountsData.some(a => !a.influencerId);

        if (hasMissingInfluencerId) {
            const or: any[] = [];

            if (socialAccountIds.length) {
                for (const sm of usedSocialMedia) {
                    or.push({ [`${sm}._id`]: { $in: socialAccountIds } });
                }
            }

            for (const [sm, names] of usernamesByMedia) {
                if (names.length) {
                    or.push({ [`${sm}.username`]: { $in: names } });
                }
            }

            if (or.length) {
                const extra: MinimalInfluencer[] = await this.influencerRepo.findMany(
                    { $or: or },
                    { lean: true, select: Object.keys(projection) } as any,
                );

                const seen = new Set(influencers.map(i => i._id.toString()));
                for (const inf of extra) {
                    const id = inf._id.toString();
                    if (!seen.has(id)) {
                        influencers.push(inf);
                        seen.add(id);
                    }
                }
            }
        }

        if (!influencers.length) return [];

        const byAccountId = new Map<
            AccountKey,
            { influencerId: ObjId; acc: MinimalSocialAccount }
        >();

        const byUsername = new Map<
            UsernameKey,
            { influencerId: ObjId; acc: MinimalSocialAccount }
        >();

        for (const inf of influencers) {
            for (const sm of usedSocialMedia) {
                const arr = inf[sm];
                if (!Array.isArray(arr) || !arr.length) continue;

                for (const acc of arr) {
                    if (!acc?._id) continue;

                    const accountKey = `${sm}:${acc._id.toString()}` as AccountKey;
                    byAccountId.set(accountKey, {
                        influencerId: inf._id,
                        acc,
                    });

                    if (acc.username) {
                        const usernameKey = `${sm}:${acc.username}` as UsernameKey;
                        byUsername.set(usernameKey, {
                            influencerId: inf._id,
                            acc,
                        });
                    }
                }
            }
        }

        const result: CampaignAccount[] = [];
        const invalid: Array<{ index: number; reason: string }> = [];

        for (let idx = 0; idx < addedAccountsData.length; idx++) {
            const dto = addedAccountsData[idx];

            const dtoInfluencerId = toObjIdSafe(dto.influencerId);
            const dtoAccountId = toObjIdSafe(dto.socialAccountId);
            const dtoUsername = dto.username;

            let matched: { influencerId: ObjId; acc: MinimalSocialAccount } | null = null;

            if (dtoAccountId) {
                matched =
                    byAccountId.get(`${dto.socialMedia}:${dtoAccountId.toString()}`) ?? null;
            } else if (dtoUsername) {
                matched = byUsername.get(`${dto.socialMedia}:${dtoUsername}`) ?? null;
            }

            if (!matched) {
                invalid.push({
                    index: idx,
                    reason: 'Account not found for provided identifiers',
                });
                continue;
            }

            if (
                dtoInfluencerId &&
                matched.influencerId.toString() !== dtoInfluencerId.toString()
            ) {
                invalid.push({
                    index: idx,
                    reason: 'InfluencerId does not match the resolved account',
                });
                continue;
            }

            const acc = matched.acc;

            if (acc.verifiedStatus !== AccountVerifiedStatus.accept) {
                invalid.push({ index: idx, reason: 'Account is not verified' });
                continue;
            }

            if (acc.isDeleted) {
                invalid.push({ index: idx, reason: 'Account is deleted' });
                continue;
            }

            if (acc.isHidden) {
                invalid.push({ index: idx, reason: 'Account is hidden' });
                continue;
            }

            if (
                typeof acc.price !== 'number' ||
                acc.price < 0 ||
                typeof acc.publicPrice !== 'number' ||
                acc.publicPrice < 0
            ) {
                invalid.push({ index: idx, reason: 'Invalid price/publicPrice' });
                continue;
            }

            if (!dto.selectedCampaignContentItem?.campaignContentItemId) {
                invalid.push({
                    index: idx,
                    reason:
                        'selectedCampaignContentItem.campaignContentItemId is required',
                });
                continue;
            }

            result.push({
                ...dto,
                _id: new Types.ObjectId(),
                username: acc.username ?? dto.username,
                influencerId: matched.influencerId,
                accountId: acc._id,
                followers: acc.followers ?? 0,
                price: acc.price,
                publicPrice: acc.publicPrice,
                selectedContent: {
                    campaignContentItemId: new Types.ObjectId(
                        dto.selectedCampaignContentItem.campaignContentItemId,
                    ),
                    descriptionId: dto.selectedCampaignContentItem.descriptionId
                        ? new Types.ObjectId(
                            dto.selectedCampaignContentItem.descriptionId,
                        )
                        : undefined,
                },
                confirmation: InfluencerConfirmationStatusEnum.wait,
                closePromo: InfluencerPromoClosedStatusEnum.wait,
                dateRequest: dto.dateRequest ?? null,
            } satisfies CampaignAccount);
        }

        // if (invalid.length) {
        //     throw new BadRequestException({
        //         message: 'Some addedAccounts items are invalid',
        //         invalid,
        //     });
        // }

        return result;
    }
}