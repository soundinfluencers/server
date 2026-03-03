import {BuildChangePriceRequestTemplateDto, BuildInfluencerSignupRequestTemplateDto} from "../dto/profile-email.dto";
import {
    escapeHtmlForEmail,
    formatMoneyForEmail,
    prettyNetworkName,
    renderButton,
    renderMusicGenres
} from "../utils/email.utils";
import {CreateSocialAccountDto} from "../../../modules/auth/dto/create-influencer.dto";

export const buildPriceChangeRequestTemplate = (data: BuildChangePriceRequestTemplateDto) => {
    const newPrice = formatMoneyForEmail(data.newPrice, data.currency);
    const oldPrice = formatMoneyForEmail(data.oldPrice);

    const name = escapeHtmlForEmail(data.influencerName);
    const email = escapeHtmlForEmail(data.influencerEmail);
    const username = escapeHtmlForEmail(data.accountUsername);
    const social = escapeHtmlForEmail(String(data.accountSocialMedia));

    const acceptLink = escapeHtmlForEmail(data.acceptLink);
    const declineLink = escapeHtmlForEmail(data.declineLink);

    const previewText = `Price change request: ${social} @${username} (${oldPrice} → ${newPrice})`;

    return `
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
    ${previewText}
  </div>

  <div style="margin:0; padding:0; background:#f6f7fb;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f7fb; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:600px;">
            
            <!-- Header -->
            <tr>
              <td style="padding:0 0 12px 0;">
                <div style="font-family:Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size:14px; color:#64748b;">
                  <div style="font-weight:700; font-size:16px; color:#0f172a;">Admin Action Required</div>
                  <div style="margin-top:4px;">Influencer price change request</div>
                </div>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; padding:20px;">
                <div style="font-family:Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0f172a;">
                  
                  <!-- Title row -->
                  <div style="display:block; margin-bottom:14px;">
                    <div style="font-size:18px; font-weight:800; margin:0 0 6px 0; line-height:1.2;">
                      Price change requested
                    </div>

                    <span style="display:inline-block; font-size:12px; font-weight:700; padding:6px 10px; border-radius:999px; background:#eef2ff; color:#3730a3;">
                      ${social}
                    </span>
                  </div>

                  <!-- Main text -->
                  <div style="font-size:14px; line-height:1.6; color:#334155;">
                    <p style="margin:0 0 10px 0;">
                      The influencer <strong style="color:#0f172a;">${name}</strong>
                      (<span style="color:#0f172a;">${email}</span>)
                      requested a price update for account
                      <strong style="color:#0f172a;">@${username}</strong>.
                    </p>
                  </div>

                  <!-- Price table -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                    style="margin:14px 0 16px 0; border-collapse:separate; border-spacing:0; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
                    <tr>
                      <td width="50%" style="padding:12px 14px; background:#f8fafc; font-family:Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
                        <div style="font-size:12px; color:#64748b; margin-bottom:4px;">Old price</div>
                        <div style="font-size:16px; font-weight:800; color:#0f172a;">${oldPrice}</div>
                      </td>
                      <td width="50%" style="padding:12px 14px; background:#ffffff; font-family:Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
                        <div style="font-size:12px; color:#64748b; margin-bottom:4px;">New price</div>
                        <div style="font-size:16px; font-weight:800; color:#0f172a;">${newPrice}</div>
                      </td>
                    </tr>
                  </table>

                  <!-- Actions -->
                  <div style="font-family:Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
                    <div style="font-size:13px; color:#64748b; margin:0 0 10px 0;">
                      Choose an action:
                    </div>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                      <tr>
                        <td style="padding:0 10px 0 0;">
                          <a href="${acceptLink}"
                            style="display:inline-block; padding:12px 16px; background:#16a34a; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:800; font-size:14px;">
                            Accept
                          </a>
                        </td>
                        <td style="padding:0;">
                          <a href="${declineLink}"
                            style="display:inline-block; padding:12px 16px; background:#dc2626; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:800; font-size:14px;">
                            Decline
                          </a>
                        </td>
                      </tr>
                    </table>

                    <div style="margin-top:14px; font-size:12px; color:#94a3b8; line-height:1.5;">
                      If buttons don’t work, copy and paste these links:
                      <div style="margin-top:6px;">
                        <div>
                          <span style="color:#64748b;">Accept:</span>
                          <span style="color:#0f172a; word-break:break-all;">${acceptLink}</span>
                        </div>
                        <div style="margin-top:4px;">
                          <span style="color:#64748b;">Decline:</span>
                          <span style="color:#0f172a; word-break:break-all;">${declineLink}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:14px 4px 0 4px;">
                <div style="font-family:Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size:12px; color:#94a3b8; line-height:1.5; text-align:center;">
                  This is an automated message. Please do not reply.
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
  `.trim();
};

function renderAccountCard(networkKey: string, account: CreateSocialAccountDto) {
    return `
  <div style="border:1px solid #D0D5DD;border-radius:14px;padding:14px;background:#F9FAFB;margin-top:10px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <div style="width:28px;height:28px;border-radius:8px;background:#FFFFFF;border:1px solid #EAECF0;display:flex;align-items:center;justify-content:center;font-weight:600;">
        ${escapeHtmlForEmail(prettyNetworkName(networkKey).slice(0, 1))}
      </div>
      <div style="font-weight:600;color:#101828;">${escapeHtmlForEmail(prettyNetworkName(networkKey))}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#344054;">
      <tr>
        <td style="padding:4px 0;color:#667085;width:140px;">Username:</td>
        <td style="padding:4px 0;font-weight:600;">${escapeHtmlForEmail(account.username)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#667085;">Link:</td>
        <td style="padding:4px 0;">
          <a href="${escapeHtmlForEmail(account.profileLink)}" style="color:#2563EB;text-decoration:none;">${escapeHtmlForEmail(account.profileLink)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#667085;">Followers:</td>
        <td style="padding:4px 0;">${escapeHtmlForEmail(account.followers.toString() ?? '0')}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#667085;">Logo:</td>
        <td style="padding:4px 0;">
          <a href="${escapeHtmlForEmail(account.logoUrl)}" style="color:#2563EB;text-decoration:none;">${escapeHtmlForEmail(account.logoUrl)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#667085;">Price:</td>
        <td style="padding:4px 0;font-weight:600;">
          ${escapeHtmlForEmail(account.price.toString())} ${escapeHtmlForEmail(account.currency)}
        </td>
      </tr>
    </table>

    ${renderMusicGenres(account)}

    <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
      ${((account.creatorCategories ?? []).slice(0, 8)).map(c => `
        <span style="font-size:12px;border:1px solid #E4E7EC;border-radius:8px;padding:4px 8px;background:#fff;">
          ${escapeHtmlForEmail(c)}
        </span>`).join('')}
      ${((account.categories ?? []).slice(0, 8)).map(c => `
        <span style="font-size:12px;border:1px solid #E4E7EC;border-radius:8px;padding:4px 8px;background:#fff;">
          ${escapeHtmlForEmail(c)}
        </span>`).join('')}
    </div>
  </div>
  `;
}

export function buildInfluencerSignupRequestTemplate(dto: BuildInfluencerSignupRequestTemplateDto) {
    const brand = dto.brandName ?? 'SoundInfluencers';
    const fullName = `${dto.firstName ?? ''} ${dto.lastName ?? ''}`.trim();

    const socialAccounts = dto.socialAccounts ?? {};

    const networks = Object.entries(socialAccounts)
        .filter(([, arr]) => Array.isArray(arr) && arr.length > 0) as Array<[string, CreateSocialAccountDto[]]>;

    const totalAccounts = networks.reduce((sum, [, arr]) => sum + arr.length, 0);

    const accountsHtml =
        networks.length === 0
            ? `<div style="margin-top:14px;color:#667085;">No social accounts provided.</div>`
            : networks
                .map(([networkKey, accounts]) => {
                    return `
              <div style="margin-top:18px;">
                <div style="font-size:12px;color:#667085;margin-bottom:8px;">
                  SOCIAL NETWORK: <b style="color:#101828;">${escapeHtmlForEmail(prettyNetworkName(networkKey))}</b>
                  <span style="margin-left:8px;">(accounts: ${accounts.length})</span>
                </div>
                ${accounts.map((acc) => renderAccountCard(networkKey, acc)).join('')}
              </div>
            `;
                })
                .join('');

    const actions = `
    <div style="margin-top:22px;border:1px solid #EAECF0;border-radius:16px;padding:16px;background:#FFFFFF;">
      <div style="font-weight:700;color:#101828;margin-bottom:12px;text-align:center;">
        Do you want to verify this influencer and all accounts?
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        ${renderButton('Accept', dto.acceptLink, 'primary')}
        ${renderButton('Decline', dto.declineLink, 'secondary')}
        ${dto.negotiateLink ? renderButton('Negotiate', dto.negotiateLink, 'secondary') : ''}
      </div>
    </div>
  `;

    return `
  <div style="margin:0;padding:0;background:#0B0F19;">
    <div style="max-width:920px;margin:0 auto;padding:28px 16px;">
      <div style="background:linear-gradient(135deg,#E7F0FF 0%, #FFFFFF 45%, #EEF2FF 100%);border-radius:18px;padding:18px;border:1px solid #EAECF0;">
        <div style="display:inline-block;padding:6px 12px;border-radius:10px;background:#FFFFFF;border:1px solid #EAECF0;font-weight:700;color:#111827;">
          ${escapeHtmlForEmail(brand)}
        </div>

        <div style="margin-top:18px;">
          <div style="font-size:28px;line-height:1.2;font-weight:800;color:#101828;">
            Request from a new partner ${escapeHtmlForEmail(fullName || dto.firstName || 'Influencer')}
          </div>

          <div style="margin-top:12px;">
            <table style="border-collapse:collapse;font-size:13px;color:#344054;">
              <tr>
                <td style="padding:4px 12px 4px 0;color:#667085;">First name:</td>
                <td style="padding:4px 0;font-weight:600;">${escapeHtmlForEmail(dto.firstName)}</td>
              </tr>
              <tr>
                <td style="padding:4px 12px 4px 0;color:#667085;">Email:</td>
                <td style="padding:4px 0;">${escapeHtmlForEmail(dto.email)}</td>
              </tr>
              ${dto.phone ? `
              <tr>
                <td style="padding:4px 12px 4px 0;color:#667085;">Phone:</td>
                <td style="padding:4px 0;">${escapeHtmlForEmail(dto.phone)}</td>
              </tr>` : ''}
            </table>
          </div>

          <div style="margin-top:14px;font-size:12px;color:#667085;">
            SOCIAL ACCOUNTS: <b style="color:#101828;">${totalAccounts}</b>
          </div>

          ${accountsHtml}
          ${actions}
        </div>
      </div>
    </div>
  </div>
  `;
}

export function buildInfluencerSignupAutoReplyTemplate(email: string, firstName?: string) {
    const cleanedFirstName = escapeHtmlForEmail(firstName ?? email);

    return `<p>Dear ${cleanedFirstName},</p>
            <p>Thank you for submitting your subscription request.</p>
            <p>We will send you an email with a status update shortly.</p>
            <p>Best regards,</p>
            <p>The SoundInfluencers Team</p>`;
}