import {BuildChangePriceRequestTemplateDto} from "../dto/profile-email.dto";
import {escapeHtmlForEmail, formatMoneyForEmail} from "../utils/email.utils";

export const buildPriceChangeRequestTemplate = (data: BuildChangePriceRequestTemplateDto) => {
    const newPrice = formatMoneyForEmail(data.newPrice);
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