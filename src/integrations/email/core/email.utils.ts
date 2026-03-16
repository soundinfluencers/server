import * as path from 'path';
import * as fs from 'fs';
import {SocialMediaEnum} from "../../../common/types/social-media.types";

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function joinHtml(parts: Array<string | undefined | null | false>): string {
    return parts.filter(Boolean).join('');
}

export function nl2br(value: string): string {
    return escapeHtml(value).replace(/\n/g, '<br />');
}

export function getEmailAttachments(options?: {
    withHeroCheck?: boolean;
    withInfoQuestion?: boolean;
    withList?: boolean;
    withFooterBlock?: boolean;
    withSocialIcons?: SocialMediaEnum[];
}) {
    const base = path.join(process.cwd(), 'assets', 'email');

    let attachments = [
        {
            filename: 'logo_header.png',
            path: path.join(base, 'logo_header.png'),
            cid: 'header_logo',
        },
    ];

    // check image in header block
    if (options?.withHeroCheck) {
        attachments.push({
            filename: 'accept.png',
            path: path.join(base, 'accept.png'),
            cid: 'hero_check',
        });
    }

    // question image for info card block
    if (options?.withInfoQuestion) {
        attachments.push({
            filename: 'question.png',
            path: path.join(base, 'question.png'),
            cid: 'question',
        });
    }

    // for list items checks
    if (options?.withList) {
        attachments.push({
            filename: 'check.png',
            path: path.join(base, 'check.png'),
            cid: 'list_check',
        });
    }

    // footer images
    if (options?.withFooterBlock) {
        attachments.push({
            filename: 'logo_footer.png',
            path: path.join(base, 'logo_footer.png'),
            cid: 'footer_logo',
        });
        attachments.push({
            filename: 'linkedin.png',
            path: path.join(base, 'linkedin.png'),
            cid: 'linkedin-icon',
        });
        attachments.push({
            filename: 'instagram_footer.png',
            path: path.join(base, 'instagram_footer.png'),
            cid: 'instagram_footer-icon',
        });
        attachments.push({
            filename: 'phone.png',
            path: path.join(base, 'phone.png'),
            cid: 'phone-icon',
        });
        attachments.push({
            filename: 'telegram.png',
            path: path.join(base, 'telegram.png'),
            cid: 'telegram-icon',
        });
        attachments.push({
            filename: 'whatsapp.png',
            path: path.join(base, 'whatsapp.png'),
            cid: 'whatsapp-icon',
        });
    }

    // social media icons for promo cards
    if (options?.withSocialIcons && options?.withSocialIcons.length > 0) {
        for (const socialMedia of options.withSocialIcons) {
            attachments.push(getSocialMediaIconForEmail(socialMedia));
        }
    }

    return attachments;
}

export function getSocialMediaIconForEmail(socialMedia: SocialMediaEnum) {
    const base = path.join(process.cwd(), 'assets', 'email');

    return {
        filename: `${socialMedia}.png`,
        path: path.join(base, `${socialMedia}.png`),
        cid: `promo_card_${socialMedia}`,
    };
}

let emailFontFaceCss: string | null = null;

export function getEmailFontFaceCss() {
    if (emailFontFaceCss) return emailFontFaceCss;

    const load = (file: string) => {
        const p = path.join(process.cwd(), 'assets', 'fonts', file);
        return fs.readFileSync(p).toString('base64');
    };

    emailFontFaceCss = `
@font-face {
  font-family: 'Satoshi';
  src: url(data:font/woff2;base64,${load('Satoshi-Regular.woff2')}) format('woff2');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Satoshi';
  src: url(data:font/woff2;base64,${load('Satoshi-Medium.woff2')}) format('woff2');
  font-weight: 500;
  font-style: normal;
}
@font-face {
  font-family: 'Satoshi';
  src: url(data:font/woff2;base64,${load('Satoshi-Bold.woff2')}) format('woff2');
  font-weight: 700;
  font-style: normal;
}
`.trim();

    return emailFontFaceCss;
}