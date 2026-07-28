import puppeteer from 'puppeteer';
import { Campaign } from '../../../../database/schemas/campaign/campaign.schema';
import { SocialMediaEnum } from '../../../types/social-media.types';

export class CampaignPdfExporter {
    static async buildPdfBuffer(campaign: Campaign): Promise<Buffer> {
        const html = this.buildHtml(campaign);

        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=medium'],
        });

        try {
            const page = await browser.newPage();
            page.setDefaultNavigationTimeout(60_000);
            page.setDefaultTimeout(60_000);

            await page.setContent(html, { waitUntil: 'networkidle0' });

            const pdfUint8 = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '14mm', right: '10mm', bottom: '14mm', left: '10mm' },
                preferCSSPageSize: true,
            });

            return Buffer.from(pdfUint8);
        } finally {
            await browser.close();
        }
    }

    private static buildHtml(campaign: Campaign): string {
        const eur = (v?: number) => (v === null || v === undefined ? '' : `${v} €`);
        const escape = (s: unknown) =>
            String(s ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');

        const noEngagement = new Set<SocialMediaEnum>([
            SocialMediaEnum.spotify,
            SocialMediaEnum.soundcloud,
            SocialMediaEnum.press,
        ]);

        const hasEngagement = (sm: SocialMediaEnum) => !noEngagement.has(sm);
        const hasRating = (sm: SocialMediaEnum) =>
            sm === SocialMediaEnum.spotify || sm === SocialMediaEnum.soundcloud;

        const rows = (campaign.addedAccounts ?? [])
            .map((acc, idx) => {
                const showEng = hasEngagement(acc.socialMedia);
                const showRate = hasRating(acc.socialMedia);

                const price = campaign.isPriceHidden ? '' : eur(acc.publicPrice);

                return `
          <tr>
            <td class="num">${idx + 1}</td>
            <td class="text">${escape(acc.username)}</td>
            <td class="text">${escape(acc.socialMedia)}</td>
            <td class="num">${escape(acc.followers)}</td>
            <td class="num">${escape(price)}</td>
            <td class="text">${escape(acc.confirmation)}</td>
            <td class="text">${escape(acc.closePromo)}</td>
            <td class="text">${escape(acc.dateRequest ?? '')}</td>
            <td class="text">${escape(acc.datePost ?? '')}</td>

            <td class="link">
              ${acc.postLink ? `<a href="${escape(acc.postLink)}" target="_blank">open</a>` : ''}
            </td>

            <td class="link">
              ${acc.screenshot ? `<a href="${escape(acc.screenshot)}" target="_blank">open</a>` : ''}
            </td>

            <td class="num">${showEng ? escape(acc.impressions ?? 0) : ''}</td>
            <td class="num">${showEng ? escape(acc.like ?? 0) : ''}</td>
            <td class="num">${showEng ? escape(acc.comments ?? 0) : ''}</td>
            <td class="num">${showEng ? escape(acc.shares ?? 0) : ''}</td>
            <td class="num">${showEng ? escape(acc.saves ?? 0) : ''}</td>
            <td class="num">${showRate ? escape(acc.rating ?? 0) : ''}</td>
          </tr>
        `;
            })
            .join('');

        const now = new Date().toISOString().slice(0, 10);

        return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escape(campaign.campaignName)} - report</title>
  <style>
    @page { size: A4; margin: 14mm 10mm; }
    body { font-family: Arial, sans-serif; color:#111; font-size: 12px; }
    .title { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
    .sub { color:#444; margin: 0 0 14px; }
    .card { border: 1px solid #c8c4f4; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .kv { display:flex; gap:8px; }
    .k { min-width: 120px; color:#555; }
    .v { font-weight: 600; word-break: break-word; }

    table { width: 100%; border-collapse: collapse; }
    thead th {
      position: sticky; top: 0; /* на печати не всегда, но в preview полезно */
      background: #f4f2ff;
      border: 1px solid #c8c4f4;
      padding: 8px 6px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .02em;
    }
    tbody td {
      border: 1px solid #e6e3ff;
      padding: 6px 6px;
      vertical-align: top;
    }
    .num { text-align: right; white-space: nowrap; }
    .text { text-align: left; }
    .link { text-align: center; white-space: nowrap; }
    a { color: #3b5bdb; text-decoration: none; }
    .footer { margin-top: 10px; color:#666; font-size: 10px; }
    /* перенос длинных ссылок */
    td { word-break: break-word; }
  </style>
</head>
<body>
  <div class="title">Campaign Report</div>
  <div class="sub">${escape(now)}</div>

  <div class="card">
    <div class="grid">
      <div class="kv"><div class="k">Campaign</div><div class="v">${escape(campaign.campaignName)}</div></div>
      <div class="kv"><div class="k">Social</div><div class="v">${escape(campaign.socialMedia)}</div></div>
      <div class="kv"><div class="k">Total price</div><div class="v">${escape(eur(campaign.campaignPrice))}</div></div>
      <div class="kv"><div class="k">Status</div><div class="v">${escape(campaign.statusCampaign)}</div></div>
      <div class="kv"><div class="k">Payment</div><div class="v">${escape(campaign.paymentStatus)}</div></div>
      <div class="kv"><div class="k">Method</div><div class="v">${escape(campaign.paymentType)}</div></div>
      <div class="kv" style="grid-column: 1 / -1;">
        <div class="k">Share link</div>
        <div class="v">${campaign.shareLink ? `<a href="${escape(campaign.shareLink)}" target="_blank">${escape(campaign.shareLink)}</a>` : ''}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Username</th>
        <th>Account social</th>
        <th>Followers</th>
        <th>Price</th>
        <th>Confirmation</th>
        <th>Close</th>
        <th>Date req</th>
        <th>Date post</th>
        <th>Post</th>
        <th>Screenshot</th>
        <th>Impr</th>
        <th>Like</th>
        <th>Comm</th>
        <th>Share</th>
        <th>Saves</th>
        <th>Rating</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    Generated by SoundInfluencers • Campaign ID: ${escape(campaign._id)}
  </div>
</body>
</html>`;
    }
}
