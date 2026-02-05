import {BuildClientCreatedCampaignTemplateDto, BuildRequestEditTemplateDto} from "../dto/campaign-email.dto";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {formatCampaignPaymentType} from "../../../common/utils/formatters";

export const escapeHtml = (v: string) =>
    v
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

export const buildRequestEditTemplate = (data: BuildRequestEditTemplateDto) => {
    const campaignName = escapeHtml(data.campaignName ?? "Unknown campaign");
    const clientName = escapeHtml(data.clientName ?? "Unknown client");
    const clientEmail = escapeHtml(data.clientEmail ?? "Unknown email");

    return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color:#111; line-height:1.4;">
      <p>Hi,</p>

      <p>
        The client <strong>${clientName}</strong> (${clientEmail})
        has requested permission to <strong>edit</strong> the campaign:
      </p>

      <p style="margin: 12px 0;">
        <strong>Campaign:</strong> ${campaignName}<br/>
        <strong>Campaign ID:</strong> ${escapeHtml(data.campaignId)}<br/>
        <strong>Client ID:</strong> ${escapeHtml(data.clientId)}
      </p>

      <p>Choose an action:</p>

      <div style="margin: 16px 0;">
        <a href="${data.acceptLink}"
           style="display:inline-block; padding:10px 14px; background:#16a34a; color:#fff; text-decoration:none; border-radius:6px; margin-right:10px;">
          Accept
        </a>

        <a href="${data.declineLink}"
           style="display:inline-block; padding:10px 14px; background:#dc2626; color:#fff; text-decoration:none; border-radius:6px;">
          Decline
        </a>
      </div>
    </div>
  `;
};

export const buildClientCreatedCampaignTemplate = (data: BuildClientCreatedCampaignTemplateDto) => {
    const campaignName = escapeHtml(data.campaignName ?? "Unknown campaign");
    const clientName = escapeHtml(data.clientName ?? data.clientId ?? "Unknown client");
    const clientEmail = escapeHtml(data.clientEmail ?? "Unknown email");
    const campaignSocialMedia = escapeHtml(data.campaignSocialMedia);
    const paymentType = formatCampaignPaymentType(data.paymentType) ?? "Unsupported payment type";

    return `
<div style="
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    background-color: #f6f7fb;
    padding: 40px 20px;
">
    <div style="
        max-width: 560px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 14px;
        padding: 32px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.06);
    ">
        <h2 style="margin:0 0 16px 0;">
            Campaign approval request
        </h2>

        <p style="margin:0 0 16px 0; color:#444;">
            Hi 👋
        </p>

        <p style="margin:0 0 24px 0; color:#444; line-height:1.5;">
            <strong>${clientName}</strong> (${clientEmail}) has requested
            ${campaignSocialMedia === SocialMediaEnum.press
        ? 'article(-s) for inclusion'
        : 'posts'} for the influencer campaign on
            <strong>${campaignSocialMedia}</strong>.
        </p>

        <div style="
            background:#f3f5f9;
            border-radius:10px;
            padding:16px;
            margin-bottom:24px;
        ">
            <p style="margin:0 0 6px 0;"><strong>Campaign Name:</strong> ${campaignName}</p>
            <p style="margin:0;"><strong>Payment Method:</strong> ${paymentType}</p>
        </div>

        <div style="text-align:center;">
            <a href="${data.acceptLink}"
               style="
                   display:inline-block;
                   padding:12px 22px;
                   margin-right:10px;
                   background:#22c55e;
                   color:#ffffff;
                   text-decoration:none;
                   border-radius:8px;
                   font-weight:600;
               ">
               ✅ Approve
            </a>

            <a href="${data.declineLink}"
               style="
                   display:inline-block;
                   padding:12px 22px;
                   background:#ef4444;
                   color:#ffffff;
                   text-decoration:none;
                   border-radius:8px;
                   font-weight:600;
               ">
               ❌ Decline
            </a>
        </div>

        <p style="
            margin-top:28px;
            font-size:12px;
            color:#888;
            text-align:center;
        ">
            This is an automated message from the SoundInfluencers system.
        </p>
    </div>
</div>
`;
}