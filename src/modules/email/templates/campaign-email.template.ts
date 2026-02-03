import { BuildCampaignEmailDto } from "../dto/campaign-email.dto";

const escapeHtml = (v: string) =>
    v
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

export const buildRequestEditEmail = (data: BuildCampaignEmailDto) => {
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
