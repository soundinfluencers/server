import { CreateSocialAccountDto } from '../../../modules/auth/dto/create-influencer.dto';
import { CurrencyCode } from '../../../common/types/finance.types';

export const escapeHtmlForEmail = (v: string) =>
  v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const formatMoneyForEmail = (value: unknown, currency: CurrencyCode = CurrencyCode.EUR) => {
  if (!value) return '-';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(n)) return `${n.toLocaleString('en-US')} ${currency}`;
  return '—';
};

export const safeLinkForEmail = (url?: string) => {
  if (!url) return '—';
  const u = escapeHtmlForEmail(url);
  return `<a href="${u}" style="color:#2563eb; text-decoration:none;">${u}</a>`;
};

export const prettyNetworkName = (network: string) => {
  const map: Record<string, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    spotify: 'Spotify',
    soundcloud: 'SoundCloud',
    facebook: 'Facebook',
    youtube: 'YouTube',
    press: 'Press',
  };
  return map[network] ?? network;
};

export const renderButton = (label: string, href: string, variant: 'primary' | 'secondary') => {
  const primary = variant === 'primary';
  return `
    <a href="${escapeHtmlForEmail(href)}"
       style="
         display:inline-block;
         padding:10px 18px;
         border-radius:999px;
         text-decoration:none;
         font-weight:600;
         font-size:13px;
         ${primary ? 'background:#111827;color:#FFFFFF;border:1px solid #111827;' : 'background:#FFFFFF;color:#111827;border:1px solid #D0D5DD;'}
       ">
      ${escapeHtmlForEmail(label)}
    </a>
  `;
};
