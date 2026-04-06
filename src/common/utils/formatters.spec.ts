import { formatDate, formatDateTime, formatClientCampaignStatus } from './formatters';
import { CampaignStatusEnum } from '../types/client/campaign.types';

describe('formatDate', () => {
    it('formats date as DD.MM.YY with default dot separator', () => {
        expect(formatDate(new Date('2024-01-05'))).toBe('05.01.24');
    });

    it('pads day and month to two digits', () => {
        expect(formatDate(new Date('2024-03-07'))).toBe('07.03.24');
    });

    it('uses the last two digits of the year', () => {
        expect(formatDate(new Date('2000-12-31'))).toBe('31.12.00');
        expect(formatDate(new Date('1999-06-15'))).toBe('15.06.99');
    });

    it('accepts a custom separator', () => {
        expect(formatDate(new Date('2024-08-20'), '-')).toBe('20-08-24');
    });

    it('produces three equal-length date segments', () => {
        const parts = formatDate(new Date('2024-11-09')).split('.');
        expect(parts).toHaveLength(3);
        expect(parts.every(p => p.length === 2)).toBe(true);
    });
});

describe('formatDateTime', () => {
    it('formats as DD.MM.YYYY HH:MM', () => {
        const date = new Date('2024-06-15T09:05:00.000Z');
        const result = formatDateTime(date);
        // we only assert structure (timezone-agnostic) — format is always "DD.MM.YYYY HH:MM"
        expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
    });
});

describe('formatClientCampaignStatus', () => {
    const cases: Array<[string, CampaignStatusEnum]> = [
        ['wait', CampaignStatusEnum.pending],
        ['pending', CampaignStatusEnum.pending],
        ['under_review', CampaignStatusEnum.underReview],
        ['work', CampaignStatusEnum.distributing],
        ['distributing', CampaignStatusEnum.distributing],
        ['finally', CampaignStatusEnum.completed],
        ['completed', CampaignStatusEnum.completed],
    ];

    it.each(cases)('maps "%s" → %s', (input, expected) => {
        expect(formatClientCampaignStatus(input)).toBe(expected);
    });

    it('falls back to CampaignStatusEnum.pending for unknown status', () => {
        expect(formatClientCampaignStatus('unknown_legacy_status')).toBe(CampaignStatusEnum.pending);
        expect(formatClientCampaignStatus('')).toBe(CampaignStatusEnum.pending);
    });
});
