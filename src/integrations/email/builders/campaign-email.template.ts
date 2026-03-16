import {
    AccountObjectForCreateNewPromoRequestMessage,
    BuildClientCreatedCampaignTemplateDto,
    BuildInfluencerNewPromoRequestTemplateDto,
    BuildRequestEditTemplateDto
} from "../dto/templates/campaign-email.dto";
import {SocialMediaEnum, socialMediaLabels} from "../../../common/types/social-media.types";
import {formatCampaignPaymentType} from "../../../common/utils/formatters";
import {
    CreateBespokeCampaignDto,
    EventBespokeCampaignDto, MusicBespokeCampaignDto,
    OtherBespokeCampaignDto
} from "../../../modules/campaigns/dto/bespoke-request.dto";
import {BespokeRequestCategory} from "../../../common/types/client/campaign.types";
import {
    escapeHtmlForEmail,
    formatMoneyForEmail,
    safeLinkForEmail,
} from "../utils/email.utils";
import {buildUserEmailTemplate} from "../templates/user-email.template";
import {renderPromoCtaBanner, renderPromoRequestCard} from "../components/promo-card";
import {emailTheme} from "../core/email-theme";


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

// After approving client's new campaign
export function buildCampaignApprovedEmailTemplate(data: {
    firstName: string;
}) {
    return buildUserEmailTemplate({
        subject: 'Campaign Approved',
        preheader: 'Campaign Approved',
        headerImg: true,
        title: 'CONGRATULATIONS',
        subtitle: 'Your campaign has been approved',
        blocks: [
            {
                type: 'greeting',
                text: `Hi ${data.firstName},`,
            },
            {
                type: 'paragraph',
                text: 'Thank you for creating your campaign on SoundInfluencers.',
            },
            {
                type: 'paragraph',
                text: 'We’re happy to inform you that our team has approved your campaign setup.',
            },
            {
                type: 'paragraph',
                text: 'Your campaign request has now been sent to the selected influencer pages for distribution.',
            },
            {
                type: 'paragraph',
                text: 'The creators you selected will review the request and begin preparing the content according to the campaign brief.',
            },
            {
                type: 'paragraph',
                text: 'You can follow the campaign progress directly in your account.',
            },
            {
                type: 'button',
                cta: {
                    label: 'View Campaign',
                    href: process.env.EMAIL_DASHBOARD_URL!,
                },
                wrapperStyle: {
                    margin: '32px auto 28px auto'
                }
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
        footerNote: 'We’re excited to see your campaign go live.',
    });
}

// After declining client's new campaign
export function buildCampaignDeclinedEmailTemplate(data: {
    firstName: string;
}) {
    return buildUserEmailTemplate({
        subject: 'Campaign Declined',
        preheader: 'Campaign Declined',
        headerImg: false,
        title: 'Campaign Review Update',
        blocks: [
            {
                type: 'greeting',
                text: `Hi ${data.firstName},`,
            },
            {
                type: 'paragraph',
                text: 'Thank you for submitting your campaign on SoundInfluencers.',
            },
            {
                type: 'paragraph',
                text: 'After reviewing the campaign setup, our team was unable to approve the campaign in its current form.',
            },
            {
                type: 'list',
                title: 'This may be due to factors such as:',
                titleStyle: {
                    fontSize: 20,
                    lineHeight: '24px',
                    fontWeight: 400,
                    textTransform: 'none',
                    margin: '8px 0 20px 0',
                },
                itemStyle: {
                    fontSize: 20,
                    lineHeight: '24px',
                },
                items: [
                    'campaign format or content requirements',
                    'selected pages not matching the campaign brief',
                    'technical or content adjustments needed',
                ],
            },
            {
                type: 'button',
                cta: {
                    label: 'Contact Support',
                    href: process.env.EMAIL_SUPPORT_URL!,
                },
                wrapperStyle: {
                    margin: '20px auto 60px auto',
                }
            },
        ],
    });
}

// Influencer receiving new promo
export function buildInfluencerNewPromoRequestTemplate(data: BuildInfluencerNewPromoRequestTemplateDto) {
    return buildUserEmailTemplate({
        subject: 'You received a new promo request',
        preheader: 'You received a new promo request',
        headerImg: false,
        title: 'YOU’VE RECEIVED NEW CAMPAIGN OFFERS',
        blocks: [
            {
                type: 'greeting',
                text: `Hi ${data.firstName},`,
            },
            {
                type: 'paragraph',
                text: 'You’ve received new promo request on your SoundInfluencers account.',
            },
            {
                type: 'list',
                title: `NEW PROMO DETAILS: ${data.accountsAndDetails.length}`,
                disableBullets: true,
                titleStyle: {
                    fontSize: 18,
                    lineHeight: '18px',
                    fontWeight: 400,
                    margin: '46px 0 12px 0',
                },
                itemStyle: {
                    padding: '0 0 14px 0',
                },
                items: data.accountsAndDetails.map((promo: AccountObjectForCreateNewPromoRequestMessage) => ({
                    type: 'html' as const,
                    html: renderPromoRequestCard({
                        socialMedia: socialMediaLabels[promo.socialMedia],
                        rawSocialMedia: promo.socialMedia as SocialMediaEnum,
                        pageName: promo.pageName,
                        mainLink: promo.mainLink,
                        description: promo.description,
                        taggedUser: promo.taggedUser,
                        additionalBrief: promo.additionalBrief,
                        reward: promo.reward,
                    }),
                    text: [
                        `${promo.socialMedia} (1 post + 1 Story)`,
                        `Page: ${promo.pageName}`,
                        `Content: ${promo.mainLink}`,
                        `Description: ${promo.description}`,
                        `Story tag: ${promo.taggedUser}`,
                        promo.additionalBrief ? `Additional brief: ${promo.additionalBrief}` : '',
                        `Reward: ${promo.reward}`,
                    ]
                        .filter(Boolean)
                        .join('\n'),
                })),
            },
            {
                type: 'html',
                html: renderPromoCtaBanner({
                    text: 'New promo requests from brands are waiting in your dashboard.',
                    buttonLabel: 'Review Campaigns',
                    buttonHref: process.env.EMAIL_DASHBOARD_URL!,
                }),
                text: `New promo requests from brands are waiting in your dashboard.
Review Campaigns: ${process.env.EMAIL_DASHBOARD_URL!}`,
            }
        ],
        footerNote:
            'We look forward to seeing you collaborate with brands and grow your partnerships on SoundInfluencers.',
    });
}

// After accepting agency campaign
export function buildAgencyApprovedEmailTemplate(data: {
    firstName: string;
}) {
    return buildUserEmailTemplate({
        subject: 'Agency Campaign Approved',
        preheader: 'Agency Campaign Approved',
        headerImg: true,
        title: 'CONGRATULATIONS',
        subtitle: 'Your campaign request has been approved',
        blocks: [
            {
                type: 'greeting',
                text: `Hi ${data.firstName},`,
            },
            {
                type: 'paragraph',
                text: 'Thank you for submitting your agency campaign request on SoundInfluencers.',
            },
            {
                type: 'paragraph',
                text: 'We’re happy to inform you that our team has accepted your request and the campaign is now being prepared for distribution to our influencer network.',
            },
            {
                type: 'list',
                title: 'Our team is currently working on:',
                titleStyle: {
                    fontSize: 20,
                    lineHeight: '24px',
                    fontWeight: 400,
                    textTransform: 'none',
                    margin: '8px 0 20px 0',
                },
                itemStyle: {
                    fontSize: 20,
                    lineHeight: '24px',
                },
                items: [
                    'selecting the most relevant creator pages',
                    'preparing the campaign structure',
                    'building a tailored distribution strategy based on your objectives and target territories',
                ],
            },
            {
                type: 'paragraph',
                text: 'You can expect to receive a curated campaign plan for your approval within the next 24–48 hours.',
            },
            {
                type: 'paragraph',
                text: 'Once confirmed, we will begin sending the campaign to the selected influencers.',
            },
            {
                type: 'paragraph',
                text: 'If you need to update anything in your campaign brief, you can do so directly from your dashboard.',
            },
            {
                type: 'button',
                cta: {
                    label: 'Log in',
                    href: process.env.EMAIL_LOGIN_URL!,
                },
                wrapperStyle: {
                    margin: '32px auto 28px auto'
                }
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
        footerNote: 'We’re excited to help amplify your project.',
    });
}

// After declining agency campaign
export function buildAgencyDeclinedEmailTemplate(data: {
    firstName: string;
}) {
    return buildUserEmailTemplate({
        subject: 'Agency Campaign Declined',
        preheader: 'Agency Campaign Declined',
        headerImg: false,
        title: 'Campaign Request Update',
        blocks: [
            {
                type: 'greeting',
                text: `Hi ${data.firstName},`,
            },
            {
                type: 'paragraph',
                text: 'Thank you for submitting your agency campaign request on SoundInfluencers.',
            },
            {
                type: 'paragraph',
                text: 'After reviewing your request, our team has decided not to proceed with this campaign at the moment.',
            },
            {
                type: 'list',
                title: 'This may happen for several reasons, such as:',
                titleStyle: {
                    fontSize: 20,
                    lineHeight: '24px',
                    fontWeight: 400,
                    textTransform: 'none',
                    margin: '8px 0 20px 0',
                },
                itemStyle: {
                    fontSize: 20,
                    lineHeight: '24px',
                },
                items: [
                    'campaign requirements not matching the current influencer network',
                    'campaign timing or target territories',
                    'adjustments needed in the campaign brief',
                ],
            },
            {
                type: 'paragraph',
                text: 'You can still launch campaigns directly through the platform and collaborate with influencers independently.',
            },
            {
                type: 'button',
                cta: {
                    label: 'Create a New Campaign',
                    href: process.env.EMAIL_CREATE_CAMPAIGN_URL!,
                },
                wrapperStyle: {
                    margin: '20px auto 60px auto',
                }
            },
        ],
        footerNote: 'WE APPRECIATE YOUR INTEREST IN WORKING WITH SOUNDINFLUENCERS',
    });
}

// After approving edit campaign request
export function buildApprovedEditRequestEmailTemplate(data: {
    firstName: string;
}) {
    return buildUserEmailTemplate({
        subject: 'Campaign edit request',
        preheader: 'Campaign edit request',
        headerImg: false,
        title: 'YOUR CAMPAIGN EDIT REQUEST HAS BEEN APPROVED',
        blocks: [
            {
                type: 'greeting',
                text: `Hi ${data.firstName},`,
            },
            {
                type: 'paragraph',
                text: 'Your request to edit the campaign has been approved.',
            },
            {
                type: 'paragraph',
                text: 'You can now log into your dashboard and make the necessary changes.',
            },
            {
                type: 'list',
                title: 'PLEASE NOTE:',
                titleStyle: {
                    fontSize: 20,
                    lineHeight: '24px',
                    fontWeight: 400,
                    textTransform: 'none',
                    margin: '24px 0 16px 0',
                },
                itemStyle: {
                    fontSize: 20,
                    lineHeight: '24px',
                },
                items: [
                    'Once the campaign is sent to distribution, editing will no longer be available.',
                    'After completing your updates, make sure to click Save to submit the revised information for final review.',
                ],
            },
            {
                type: 'button',
                cta: {
                    label: 'Open Campaign Editing',
                    href: process.env.EMAIL_DASHBOARD_URL!,
                },
                wrapperStyle: {
                    margin: '32px auto 20px auto'
                }
            },
        ],
        footerNote: 'We’re excited to have you on board!',
    });
}

// After declining edit campaign request
export function buildDeclinedEditRequestEmailTemplate(data: {
    firstName: string;
}) {
    return buildUserEmailTemplate({
        subject: 'Campaign edit request',
        preheader: 'Campaign edit request',
        headerImg: false,
        title: 'YOUR CAMPAIGN EDIT REQUEST HAS BEEN DECLINED',
        blocks: [
            {
                type: 'greeting',
                text: `Hi ${data.firstName},`,
            },
            {
                type: 'paragraph',
                text: 'Thank you for your request to edit the campaign.',
            },
            {
                type: 'paragraph',
                text: 'Unfortunately, we’re unable to approve your edit request at this time.',
            },
            {
                type: 'list',
                title: 'REASON:',
                titleStyle: {
                    fontSize: 20,
                    lineHeight: '24px',
                    fontWeight: 400,
                    textTransform: 'none',
                    margin: '24px 0 16px 0',
                },
                itemStyle: {
                    fontSize: 20,
                    lineHeight: '24px',
                },
                items: [
                    'The campaign has already been sent to distribution ',
                    '(or due to internal review / scheduling constraints)',
                ],
            },
            {
              type: 'paragraph',
              text: 'Once a campaign enters distribution, editing is no longer available.'
            },
            {
                type: 'button',
                cta: {
                    label: 'Open Campaign',
                    href: process.env.EMAIL_DASHBOARD_URL!,
                },
                wrapperStyle: {
                    margin: '32px auto 48px auto'
                }
            },
            {
                type: 'paragraph',
                text: "If you’d like to discuss this further or clarify any details, feel free to reach out to us — we’re always open to reviewing and exploring potential opportunities together.",
                style: {
                    margin: '0',
                }
            },
            {
                type: 'button',
                cta: {
                    label: 'Contact Support',
                    href: process.env.EMAIL_SUPPORT_URL!
                },
                wrapperStyle: {
                    margin: '32px auto 20px auto',
                },
                containerStyle: {
                    background: emailTheme.colors.secondBtn,
                },
                linkStyle: {
                    color: emailTheme.colors.text
                }
            },
        ],
        footerNote: 'We’re always here to help',
    });
}