import {
    AccountObjectForCreateNewPromoRequestMessage,
    BuildClientCreatedCampaignTemplateDto,
    BuildInfluencerNewPromoRequestTemplateDto,
    BuildRequestEditTemplateDto
} from "../dto/campaign-email.dto";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {formatCampaignPaymentType} from "../../../common/utils/formatters";
import {
    CreateBespokeCampaignDto,
    EventBespokeCampaignDto, MusicBespokeCampaignDto,
    OtherBespokeCampaignDto
} from "../../campaigns/dto/bespoke-request.dto";
import {BespokeRequestCategory} from "../../../common/types/client/campaign.types";
import {
    escapeHtmlForEmail,
    formatMoneyForEmail,
    safeLinkForEmail,
} from "../utils/email.utils";


// ------------- UTILS -------------

const pickBaseFields = (payload: any) => ({
    campaignGoal: payload?.campaignGoal ? escapeHtmlForEmail(payload.campaignGoal) : "—",
    contentLink: payload?.contentLink ? safeLinkForEmail(payload.contentLink) : "—",
    budget: formatMoneyForEmail(payload?.budget),
    targetTerritories: payload?.targetTerritories ? escapeHtmlForEmail(payload.targetTerritories) : "worldwide",
    extraBriefs: payload?.extraBriefs ? escapeHtmlForEmail(payload.extraBriefs) : "—",
});

const renderCategoryFields = (dto: CreateBespokeCampaignDto) => {
    const { category, payload } = dto;

    switch (category) {
        case BespokeRequestCategory.music: {
            const p = payload as MusicBespokeCampaignDto;
            return `
        <p style="margin:0 0 6px 0;"><strong>Track link:</strong> ${p.trackLink ? safeLinkForEmail(p.trackLink) : "—"}</p>
        <p style="margin:0 0 6px 0;"><strong>Release date:</strong> ${p.releaseDate ? escapeHtmlForEmail(p.releaseDate) : "—"}</p>
        <p style="margin:0;"><strong>Smart link:</strong> ${p.smartLink ? safeLinkForEmail(p.smartLink) : "—"}</p>
      `;
        }

        case BespokeRequestCategory.event: {
            const p = payload as EventBespokeCampaignDto;
            return `
        <p style="margin:0;"><strong>Ticket link:</strong> ${p.ticketLink ? safeLinkForEmail(p.ticketLink) : "—"}</p>
      `;
        }

        case BespokeRequestCategory.other: {
            const p = payload as OtherBespokeCampaignDto;
            return `
        <p style="margin:0;"><strong>Brief:</strong> ${p.brief ? escapeHtmlForEmail(p.brief) : "—"}</p>
      `;
        }

        case BespokeRequestCategory.artist:
        default: {
            // artist не имеет доп. полей поверх Base
            return `
        <p style="margin:0; color:#64748b;">
          No additional fields for this category.
        </p>
      `;
        }
    }
};

function getPlatformDescription(platform: string): string {
    switch (platform.toLowerCase()) {
        case 'instagram':
            return 'Instagram (1 Post + 1 Story)';
        case 'tiktok':
            return 'TikTok (1 Post + 1 Story)';
        case 'facebook':
            return 'Facebook (1 Post + 1 Story)';
        case 'youtube':
            return 'YouTube (1 Shorts Post)';
        case 'spotify':
            return 'Spotify - 1 playlist feature with feedback (Top 1-10 positions for 30 days)';
        case 'soundcloud':
            return 'SoundCloud - 1 repost for 30 days';
        case 'press':
            return 'Press - 1 Article Feature';
        default:
            return `${platform}`;
    }
}

function formatAccountHTML(acc: AccountObjectForCreateNewPromoRequestMessage): string {
    const lines: string[] = [];

    lines.push(`<strong>Platform:</strong> ${getPlatformDescription(acc.socialMedia)}`);

    switch (acc.socialMedia.toLowerCase()) {
        case 'youtube':
            lines.push(`<strong>Channel:</strong> ${acc.pageName}`);
            if (acc.dateRequest && acc.dateRequest !== "ASAP") lines.push(`<strong>Description:</strong> ${acc.dateRequest}`);
            lines.push(`<strong>Content:</strong> ${acc.mainLink}`);
            if (acc.description) lines.push(`<strong>Description:</strong> ${acc.description}`);
            if (acc.taggedUser) lines.push(`<strong>Story Tag:</strong> ${acc.taggedUser}`);
            if (acc.taggedLink) lines.push(`<strong>Story Link:</strong> ${acc.taggedLink}`);
            if (acc.additionalBrief)
                lines.push(`<strong>Special Requests:</strong> ${acc.additionalBrief}`);
            break;
        case 'spotify':
            lines.push(`<strong>Playlist:</strong> ${acc.pageName}`);
            if (acc.dateRequest && acc.dateRequest !== "ASAP") lines.push(`<strong>Description:</strong> ${acc.dateRequest}`);
            lines.push(`<strong>Track:</strong> ${acc.mainLink}`);
            break;
        case 'soundcloud':
            lines.push(`<strong>Channel:</strong> ${acc.pageName}`);
            if (acc.dateRequest && acc.dateRequest !== "ASAP") lines.push(`<strong>Description:</strong> ${acc.dateRequest}`);
            lines.push(`<strong>Track:</strong> ${acc.mainLink}`);
            break;
        case 'press':
            lines.push(`<strong>Website:</strong> ${acc.pageName}`);
            if (acc.dateRequest && acc.dateRequest !== "ASAP") lines.push(`<strong>Description:</strong> ${acc.dateRequest}`);
            lines.push(`<strong>Press Release:</strong> ${acc.mainLink}`);
            break;
        default:
            lines.push(`<strong>Page:</strong> ${acc.pageName}`);
            if (acc.dateRequest && acc.dateRequest !== "ASAP") lines.push(`<strong>Description:</strong> ${acc.dateRequest}`);
            lines.push(`<strong>Content:</strong> ${acc.mainLink}`);
            if (acc.description) lines.push(`<strong>Description:</strong> ${acc.description}`);
            if (acc.taggedUser) lines.push(`<strong>Story Tag:</strong> ${acc.taggedUser}`);
            if (acc.taggedLink) lines.push(`<strong>Story Link:</strong> ${acc.taggedLink}`);
            if (acc.additionalBrief)
                lines.push(`<strong>Special Requests:</strong> ${acc.additionalBrief}`);
            break;
    }

    lines.push(`<strong>Reward:</strong> ${acc.reward?.replace(/\D/g, '') + '€' || ''}`);
    return lines.join('<br>');
}


// ------------- BUILDERS -------------


export const buildRequestEditTemplate = (data: BuildRequestEditTemplateDto) => {
    const campaignName = escapeHtmlForEmail(data.campaignName ?? "Unknown campaign");
    const clientName = escapeHtmlForEmail(data.clientName ?? "Unknown client");
    const clientEmail = escapeHtmlForEmail(data.clientEmail ?? "Unknown email");

    return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color:#111; line-height:1.4;">
      <p>Hi,</p>

      <p>
        The client <strong>${clientName}</strong> (${clientEmail})
        has requested permission to <strong>edit</strong> the campaign:
      </p>

      <p style="margin: 12px 0;">
        <strong>Campaign:</strong> ${campaignName}<br/>
        <strong>Campaign ID:</strong> ${escapeHtmlForEmail(data.campaignId)}<br/>
        <strong>Client ID:</strong> ${escapeHtmlForEmail(data.clientId)}
      </p>
      
      ${data.message ? 
    `      <p>
        <strong>Message:</strong> ${data.message}
      </p>`
    : ''}

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
    const campaignName = escapeHtmlForEmail(data.campaignName ?? "Unknown campaign");
    const clientName = escapeHtmlForEmail(data.clientName ?? data.clientId ?? "Unknown client");
    const clientEmail = escapeHtmlForEmail(data.clientEmail ?? "Unknown email");
    const campaignSocialMedia = escapeHtmlForEmail(data.campaignSocialMedia);
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

export const buildNewBespokeCampaignRequestTemplate = (
    data: CreateBespokeCampaignDto & {
        clientName?: string;
        clientEmail?: string;
    }
) => {
    const clientName = escapeHtmlForEmail(data.clientName ?? "Unknown client");
    const clientEmail = escapeHtmlForEmail(data.clientEmail ?? "Unknown email");
    const category = escapeHtmlForEmail(String(data.category ?? "unknown"));

    const base = pickBaseFields(data.payload);

    return `
<div style="
  font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  background:#f6f7fb;
  padding:40px 20px;
">
  <div style="
    max-width:640px;
    margin:0 auto;
    background:#ffffff;
    border-radius:14px;
    padding:32px;
    box-shadow:0 8px 24px rgba(0,0,0,0.06);
  ">
    <h2 style="margin:0 0 14px 0;">New bespoke campaign request</h2>

    <p style="margin:0 0 20px 0; color:#444; line-height:1.5;">
      A client has submitted a new <strong>individual (bespoke)</strong> campaign request.
      Please review the details below and follow up if anything is missing.
    </p>

    <div style="
      background:#f3f5f9;
      border-radius:10px;
      padding:16px;
      margin-bottom:18px;
    ">
      <p style="margin:0 0 6px 0;"><strong>Client:</strong> ${clientName}</p>
      <p style="margin:0;"><strong>Email:</strong> ${clientEmail}</p>
    </div>

    <div style="
      border:1px solid #e5e7eb;
      border-radius:10px;
      padding:16px;
      margin-bottom:18px;
    ">
      <p style="margin:0 0 10px 0;">
        <strong>Category:</strong>
        <span style="background:#eef2ff; padding:2px 8px; border-radius:999px; font-size:12px;">
          ${category}
        </span>
      </p>

      <p style="margin:0 0 6px 0;"><strong>Campaign goal:</strong> ${base.campaignGoal}</p>
      <p style="margin:0 0 6px 0;"><strong>Content link:</strong> ${base.contentLink}</p>
      <p style="margin:0 0 6px 0;"><strong>Budget:</strong> ${base.budget}</p>
      <p style="margin:0 0 6px 0;"><strong>Target territories:</strong> ${base.targetTerritories}</p>
      <p style="margin:0;"><strong>Extra briefs:</strong> ${base.extraBriefs}</p>
    </div>

    <div style="
      background:#fff7ed;
      border:1px solid #fed7aa;
      border-radius:10px;
      padding:16px;
      margin-bottom:18px;
    ">
      <p style="margin:0 0 10px 0;"><strong>Category-specific details</strong></p>
      ${renderCategoryFields(data)}
    </div>

    <p style="margin:0; color:#64748b; font-size:12px; line-height:1.4; text-align:center;">
      This is an automated message from the SoundInfluencers system.
    </p>
  </div>
</div>
`;
};

export const buildInfluencerNewPromoRequestTemplate = (data: BuildInfluencerNewPromoRequestTemplateDto) => {
    const { firstName, accountsAndDetails } = data;

    const platformMessages = accountsAndDetails.map(formatAccountHTML);

    return `Hi ${firstName},<br><br>

You have a new promo request 🔥<br><br>

<strong>CAMPAIGN DETAILS:</strong><br><br>

${platformMessages.join('<br><br>')}

<br><br>You can manage this promo(s) in your account here: <a href="https://go.soundinfluencers.com">Dashboard Link</a><br><br>

Let us know if you'd like to take part in this campaign(s)
`;
};