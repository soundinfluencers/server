import {CreateSocialAccountDto} from "../../../modules/auth/dto/create-influencer.dto";

export const escapeHtmlForEmail = (v: string) =>
    v
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

export const formatMoneyForEmail = (value: unknown) => {
    if (!value) return '-';
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return `${n.toLocaleString("en-US")} EUR`;
    return "—";
};

export const safeLinkForEmail = (url?: string) => {
    if (!url) return "—";
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
}

export const renderMusicGenres = (account: CreateSocialAccountDto) => {
    const genres = account.musicGenres ?? [];
    if (!genres.length) return '';

    const pills: string[] = [];
    for (const g of genres) {
        if (g?.genre) pills.push(escapeHtmlForEmail(g.genre));
        for (const sg of g?.subGenres ?? []) pills.push(escapeHtmlForEmail(sg));
    }

    if (!pills.length) return '';

    return `
    <div style="margin-top:10px;">
      <div style="font-size:12px;color:#667085;margin-bottom:6px;">Music genres:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${pills
        .slice(0, 20)
        .map(
            (p) => `
              <span style="font-size:12px;border:1px solid #E4E7EC;border-radius:8px;padding:4px 8px;background:#fff;">
                ${p}
              </span>`
        )
        .join('')}
      </div>
    </div>
  `;
}

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
}