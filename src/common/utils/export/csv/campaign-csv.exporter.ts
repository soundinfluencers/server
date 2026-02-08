import { format } from '@fast-csv/format';
import { PassThrough } from 'stream';
import { Campaign } from '../../../../database/schemas/campaign/campaign.schema';
import { SocialMediaEnum } from '../../../types/social-media.types';

export class CampaignCsvExporter {
    static buildStream(campaign: Campaign): PassThrough {
        const stream = new PassThrough();

        const csvStream = format<string[], string[]>({
            headers: false,
            delimiter: ';',
            quoteColumns: true,
            writeBOM: true,
        });

        csvStream.pipe(stream);

        const eur = (v: unknown) => (v === null || v === undefined || v === '' ? '' : `${v}€`);
        const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
        const numOrZero = (v: unknown) =>
            v === null || v === undefined || v === '' ? '0' : String(v);

        const noEngagementSocials = new Set<SocialMediaEnum>([
            SocialMediaEnum.spotify,
            SocialMediaEnum.soundcloud,
            SocialMediaEnum.press,
        ]);

        const hasEngagement = (social: SocialMediaEnum) => !noEngagementSocials.has(social);
        const hasRating = (social: SocialMediaEnum) =>
            social === SocialMediaEnum.spotify || social === SocialMediaEnum.soundcloud;

        csvStream.write(['CAMPAIGN']);
        csvStream.write(['NAME', str(campaign.campaignName)]);
        csvStream.write(['SOCIAL_MEDIA', str(campaign.socialMedia)]);
        csvStream.write(['TOTAL_PRICE', eur(campaign.campaignPrice)]);
        csvStream.write(['STATUS', str(campaign.statusCampaign)]);
        csvStream.write(['PAYMENT_STATUS', str(campaign.paymentStatus)]);
        csvStream.write(['PAYMENT_TYPE', str(campaign.paymentType)]);
        csvStream.write(['SHARE_LINK', str(campaign.shareLink)]);
        csvStream.write([]);

        const headers = [
            'USERNAME',
            'ACCOUNT_SOCIAL',
            'FOLLOWERS',
            'PRICE',
            'CONFIRMATION',
            'CLOSE_PROMO',
            'DATE_REQUEST',
            'DATE_POST',
            'POST_LINK',
            'SCREENSHOT',
            'IMPRESSIONS',
            'LIKE',
            'COMMENTS',
            'SHARES',
            'SAVES',
            'RATING',
        ];

        csvStream.write(headers);

        for (const acc of campaign.addedAccounts ?? []) {
            const showEngagement = hasEngagement(acc.socialMedia);
            const showRating = hasRating(acc.socialMedia);

            const row: string[] = [
                str(acc.username),
                str(acc.socialMedia),
                str(acc.followers),

                campaign.isPriceHidden ? '' : eur(acc.publicPrice),

                str(acc.confirmation),
                str(acc.closePromo),
                str(acc.dateRequest ?? ''),
                str(acc.datePost ?? ''),
                str(acc.postLink ?? ''),
                str(acc.screenshot ?? ''),

                showEngagement ? numOrZero(acc.impressions) : '',
                showEngagement ? numOrZero(acc.like) : '',
                showEngagement ? numOrZero(acc.comments) : '',
                showEngagement ? numOrZero(acc.shares) : '',
                showEngagement ? numOrZero(acc.saves) : '',

                showRating ? numOrZero(acc.rating) : '',
            ];

            csvStream.write(row);
        }

        csvStream.end();
        return stream;
    }
}
