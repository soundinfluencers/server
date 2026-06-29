import {
  BuildAccountNegotiationTemplateDto,
  BuildChangePriceRequestTemplateDto,
  BuildInfluencerSignupRequestTemplateDto,
} from '../dto/templates/profile-email.dto';
import {
  escapeHtmlForEmail,
  formatMoneyForEmail,
  prettyNetworkName,
  renderButton,
} from '../utils/email.utils';
import { CreateSocialAccountDto } from '../../../modules/auth/dto/create-influencer.dto';
import { buildUserEmailTemplate } from '../templates/user-email.template';

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
  </div>
  `;
}

export function buildInfluencerSignupRequestTemplate(dto: BuildInfluencerSignupRequestTemplateDto) {
  const brand = dto.brandName ?? 'SoundInfluencers';
  const fullName = `${dto.firstName ?? ''} ${dto.lastName ?? ''}`.trim();

  const socialAccounts = dto.socialAccounts ?? {};

  const networks = Object.entries(socialAccounts).filter(
    ([, arr]) => Array.isArray(arr) && arr.length > 0,
  ) as Array<[string, CreateSocialAccountDto[]]>;

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
              ${
                dto.phone
                  ? `
              <tr>
                <td style="padding:4px 12px 4px 0;color:#667085;">Phone:</td>
                <td style="padding:4px 0;">${escapeHtmlForEmail(dto.phone)}</td>
              </tr>`
                  : ''
              }
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

export function buildClientSignupRequestTemplate(dto: BuildAccountNegotiationTemplateDto) {
  const actions = `
    <div style="margin-top:22px;border:1px solid #EAECF0;border-radius:16px;padding:16px;background:#FFFFFF;">
      <div style="font-weight:700;color:#101828;margin-bottom:12px;text-align:center;">
        Do you want to verify this client?
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        ${renderButton('Accept', dto.acceptLink, 'primary')}
        ${renderButton('Decline', dto.declineLink, 'secondary')}
      </div>
    </div>
  `;

  return `
  <div style="margin:0;padding:0;background:#0B0F19;">
    <div style="max-width:920px;margin:0 auto;padding:28px 16px;">
      <div style="background:linear-gradient(135deg,#E7F0FF 0%, #FFFFFF 45%, #EEF2FF 100%);border-radius:18px;padding:18px;border:1px solid #EAECF0;">
        <div style="margin-top:18px;">
          <div style="font-size:28px;line-height:1.2;font-weight:800;color:#101828;">
            Request from a new partner ${escapeHtmlForEmail(dto.email || 'Client')}
          </div>

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

// After verifying influencer account
export function buildInfluencerApprovedEmailTemplate(data: { firstName: string }) {
  return buildUserEmailTemplate({
    subject: 'Your account has been approved',
    preheader: 'Your SoundInfluencers account has been approved',
    headerImg: true,
    title: 'CONGRATULATIONS',
    subtitle: 'your account has been successfully approved',
    blocks: [
      {
        type: 'greeting',
        text: `Hi ${data.firstName},`,
      },
      {
        type: 'paragraph',
        text: 'Your account was successfully approved. You can now start collaborating with brands and monetizing your social media.',
      },
      {
        type: 'list',
        title: 'YOUR NEXT STEPS',
        items: [
          'Explore available campaigns',
          'Apply or accept opportunities that fit your style',
          'Complete your profile to receive better campaign matches',
          'Monitor your earnings and activity in your dashboard',
        ],
      },
      {
        type: 'button',
        cta: {
          label: 'Log in',
          href: process.env.EMAIL_DASHBOARD_URL,
        },
      },
      {
        type: 'infoCard',
        card: {
          title: 'Learn How It Works',
          description:
            'Our Help Center walks you through campaigns, payments, and platform features — with practical tips to help you maximize every collaboration.',
          button: {
            label: 'Help Center',
            href: process.env.EMAIL_HELP_CENTER_URL,
          },
        },
      },
    ],
    footerNote: 'We’re excited to have you on board!',
  });
}

// After declining influencer account
export function buildInfluencerDeclinedEmailTemplate(data: { firstName: string }) {
  return buildUserEmailTemplate({
    subject: 'Your account has been declined',
    preheader: 'Your SoundInfluencers account has been declined',
    headerImg: false,
    title: 'Update on your account submission',
    blocks: [
      {
        type: 'greeting',
        text: `Hi ${data.firstName},`,
      },
      {
        type: 'paragraph',
        text: 'Thank you for submitting your account to SoundInfluencers.',
      },
      {
        type: 'paragraph',
        text: 'After reviewing your submission, we’re unfortunately unable to approve it at this time.',
      },
      {
        type: 'paragraph',
        text: 'This doesn’t necessarily mean we can’t collaborate in the future. Sometimes adjustments in pricing, content format, or account positioning can make a difference.',
        style: {
          padding: '16px 0 0 0',
        },
      },
      {
        type: 'paragraph',
        text: 'If you’d like to discuss this further or clarify any details, feel free to reach out to us — we’re always open to reviewing and exploring potential opportunities together.',
      },
      {
        type: 'button',
        cta: {
          label: 'Contact Support',
          href: process.env.EMAIL_SUPPORT_URL!,
        },
        wrapperStyle: {
          margin: '48px auto 0 auto',
        },
      },
    ],
    footerNote:
      'We appreciate your interest in working with SoundInfluencers and hope to connect again soon.',
  });
}

// After verifying client account
export function buildClientApprovedEmailTemplate(data: { firstName: string }) {
  return buildUserEmailTemplate({
    subject: 'Your account has been approved',
    preheader: 'Your SoundInfluencers account has been approved',
    headerImg: true,
    title: 'WELCOME TO SOUNDINFLUENCERS',
    subtitle: 'your account has been successfully created',
    blocks: [
      {
        type: 'greeting',
        text: `Hi ${data.firstName},`,
      },
      {
        type: 'paragraph',
        text: "Welcome to SoundInfluencers — you're now ready to start promoting your music, events, and projects through targeted influencer campaigns.",
      },
      {
        type: 'paragraph',
        text: 'Our platform allows you to connect with curated creator networks across key music communities and generate authentic exposure for your releases.',
      },
      {
        type: 'list',
        title: 'Your Next Steps',
        items: [
          'Create your first campaign and submit your track, event, or content for promotion',
          'Choose the networks and audiences that best match your project',
          'Monitor campaign performance and track results in real time',
          'Scale your promotion with additional campaigns and creator collaborations',
        ],
      },
      {
        type: 'button',
        cta: {
          label: 'Create your first campaign',
          href: process.env.EMAIL_DASHBOARD_URL!,
        },
      },
      {
        type: 'infoCard',
        card: {
          title: 'Learn How It Works',
          description:
            'Our Help Center walks you through campaigns, payments, and platform features — with practical tips to help you maximize every collaboration.',
          button: {
            label: 'Help Center',
            href: process.env.EMAIL_HELP_CENTER_URL!,
          },
        },
      },
    ],
    footerNote: 'We’re excited to have you on board!',
  });
}

// After declining client account
export function buildClientDeclinedEmailTemplate(data: { firstName: string }) {
  return buildUserEmailTemplate({
    subject: 'Your account has been declined',
    preheader: 'Your SoundInfluencers account has been declined',
    headerImg: false,
    title: 'Update on your account submission',
    blocks: [
      {
        type: 'greeting',
        text: `Hi ${data.firstName},`,
      },
      {
        type: 'paragraph',
        text: 'Thank you for submitting your account to SoundInfluencers.',
      },
      {
        type: 'paragraph',
        text: 'After reviewing your submission, we’re unfortunately unable to approve it at this time.',
      },
      {
        type: 'paragraph',
        text: 'This doesn’t necessarily mean we can’t collaborate in the future.',
      },
      {
        type: 'paragraph',
        text: 'If you’d like to discuss this further or clarify any details, feel free to reach out to us — we’re always open to reviewing and exploring potential opportunities together.',
      },
      {
        type: 'paragraph',
        text: 'You can reply directly to this email or contact us here:',
      },
      {
        type: 'button',
        cta: {
          label: 'Support',
          href: process.env.EMAIL_SUPPORT_URL!,
        },
      },
    ],
    footerNote:
      'We appreciate your interest in working with SoundInfluencers and hope to connect again soon.',
  });
}

// After approving new social account
export function buildSocialAccountApprovedEmailTemplate(data: { firstName: string }) {
  return buildUserEmailTemplate({
    subject: 'Your new account has been approved',
    preheader: 'Your new account has been approved',
    headerImg: true,
    title: 'CONGRATULATIONS',
    subtitle: 'your account has been successfully approved',
    blocks: [
      {
        type: 'greeting',
        text: `Hi ${data.firstName},`,
      },
      {
        type: 'paragraph',
        text: 'Your account has been successfully approved. You’re now ready to start collaborating with brands and monetizing your audience.',
      },
      {
        type: 'list',
        title: 'YOUR NEXT STEPS',
        items: [
          'Explore available campaigns',
          'Apply or accept opportunities that fit your style',
          'Complete your profile to receive better campaign matches',
          'Monitor your earnings and activity in your dashboard',
        ],
      },
      {
        type: 'button',
        cta: {
          label: 'Log in',
          href: process.env.EMAIL_DASHBOARD_URL,
        },
      },
      {
        type: 'infoCard',
        card: {
          title: 'Learn How It Works',
          description:
            'Our Help Center walks you through campaigns, payments, and platform features — with practical tips to help you maximize every collaboration.',
          button: {
            label: 'Help Center',
            href: process.env.EMAIL_HELP_CENTER_URL,
          },
        },
      },
    ],
    footerNote: 'We’re excited to have you on board!',
  });
}

// After declining new social account
export function buildSocialAccountDeclinedEmailTemplate(data: { firstName: string }) {
  return buildUserEmailTemplate({
    subject: 'Your new account has been declined',
    preheader: 'Your new account has been declined',
    headerImg: false,
    title: 'Update on your account submission',
    blocks: [
      {
        type: 'greeting',
        text: `Hi ${data.firstName},`,
      },
      {
        type: 'paragraph',
        text: 'Thank you for submitting your account to SoundInfluencers.',
      },
      {
        type: 'paragraph',
        text: 'After reviewing your submission, we’re unfortunately unable to approve it at this time.',
      },
      {
        type: 'paragraph',
        text: 'This doesn’t necessarily mean we can’t collaborate in the future. Sometimes adjustments in pricing, content format, or account positioning can make a difference.',
        style: {
          padding: '16px 0 0 0',
        },
      },
      {
        type: 'paragraph',
        text: 'If you’d like to discuss this further or clarify any details, feel free to reach out to us — we’re always open to reviewing and exploring potential opportunities together.',
      },
      {
        type: 'button',
        cta: {
          label: 'Contact Support',
          href: process.env.EMAIL_SUPPORT_URL!,
        },
        wrapperStyle: {
          margin: '48px auto 0 auto',
        },
      },
    ],
    footerNote:
      'We appreciate your interest in working with SoundInfluencers and hope to connect again soon.',
  });
}

// After declining social account's price change request
export function buildPriceChangeDeclinedEmailTemplate(data: { firstName: string }) {
  return buildUserEmailTemplate({
    subject: 'Price change request',
    preheader: 'UPDATE ON YOUR ACCOUNT PRICE REQUEST',
    headerImg: false,
    title: 'UPDATE ON YOUR ACCOUNT PRICE REQUEST',
    blocks: [
      {
        type: 'greeting',
        text: `Hi ${data.firstName},`,
      },
      {
        type: 'paragraph',
        text: 'Thank you for submitting your account price update request.',
      },
      {
        type: 'paragraph',
        text: 'After careful review, we’re unfortunately unable to approve the requested price adjustment at this time.',
      },
      {
        type: 'paragraph',
        text: 'Your current rate will remain active on your account.',
        style: {
          padding: '16px 0 0 0',
        },
      },
      {
        type: 'paragraph',
        text: 'This decision is based on internal benchmarks, audience performance metrics, and current campaign positioning within the platform.',
      },
      {
        type: 'paragraph',
        text: 'Please note that this doesn’t prevent future adjustments. We’re always open to reviewing pricing again as your engagement, reach, or positioning evolves.',
      },
      {
        type: 'paragraph',
        text: 'If you’d like to discuss this further, feel free to reply directly to this email or contact our support team.',
      },
      {
        type: 'button',
        cta: {
          label: 'Contact Support',
          href: process.env.EMAIL_SUPPORT_URL!,
        },
      },
    ],
    footerNote:
      'We appreciate your interest in working with SoundInfluencers and hope to connect again soon.',
  });
}

// After approving price change
export function buildPriceChangeApprovedEmailTemplate(data: { firstName: string }) {
  return buildUserEmailTemplate({
    subject: 'Price change request',
    preheader: 'Your new price has been approved',
    headerImg: false,
    title: 'Your new price has been approved',
    blocks: [
      {
        type: 'greeting',
        text: `Hi ${data.firstName},`,
      },
      {
        type: 'paragraph',
        text: 'Good news — your updated price has been approved.',
      },
      {
        type: 'paragraph',
        text: 'Your new rate is now active on your account.',
      },
      {
        type: 'paragraph',
        text: 'If you have any further updates, feel free to make changes in your dashboard.',
      },
      {
        type: 'button',
        cta: {
          label: 'Log in',
          href: process.env.EMAIL_LOGIN_URL!,
        },
      },
    ],
  });
}
