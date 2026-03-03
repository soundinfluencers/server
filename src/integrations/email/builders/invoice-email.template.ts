import {BuildInvoiceEmailDto} from "../dto/invoice-email.dto";
import {escapeHtmlForEmail} from "../utils/email.utils";

const listToHtml = (raw?: string, empty = '0 accounts') => {
    const s = (raw ?? '').toString().trim();
    if (!s) return `<span>${empty}</span>`;

    const items = s
        .replace(/<br\s*\/?>/gi, '\n')
        .split(/\n|,/g)
        .map(x => x.replace(/^\s*-\s*/g, '').trim())
        .filter(Boolean);

    if (!items.length) return `<span>${empty}</span>`;

    return `
    <ul style="margin:6px 0 12px; padding-left:18px;">
      ${items.map(i => `<li>${escapeHtmlForEmail(i)}</li>`).join('')}
    </ul>
  `;
};

export const buildInfluencerInvoiceEmail = (invoiceData: BuildInvoiceEmailDto) => {
    const influencerEmail = escapeHtmlForEmail(invoiceData.influencerEmail ?? "Invalid email address");

    const instagramHtml = listToHtml(invoiceData.instagramAccounts);
    const tiktokHtml = listToHtml(invoiceData.tiktokAccounts);
    const spotifyHtml = listToHtml(invoiceData.spotifyAccounts);
    const soundcloudHtml = listToHtml(invoiceData.soundcloudAccounts);
    const facebookHtml = listToHtml(invoiceData.facebookAccounts);
    const youtubeHtml = listToHtml(invoiceData.youtubeAccounts);
    const pressHtml = listToHtml(invoiceData.pressAccounts);

    const selectedPaymentMethod = escapeHtmlForEmail(invoiceData.selectedPaymentMethod ?? "Unknown payment method");

    return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color:#111; line-height:1.4;">
      <p>Invoice from ${influencerEmail}</p>

      <p><b>Instagram Accounts:</b></p>${instagramHtml}
      <p><b>TikTok Accounts:</b></p>${tiktokHtml}
      <p><b>Spotify Accounts:</b></p>${spotifyHtml}
      <p><b>SoundCloud Accounts:</b></p>${soundcloudHtml}
      <p><b>Facebook Accounts:</b></p>${facebookHtml}
      <p><b>YouTube Accounts:</b></p>${youtubeHtml}
      <p><b>Press Accounts:</b></p>${pressHtml}

      <p><b>Selected Payment Method:</b> ${selectedPaymentMethod}</p>
    </div>
  `;
};


export const buildInfluencerInvoiceResponseEmail = () => {
    return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color:#111; line-height:1.4;">
        <p>Hello</p>
                    <p>We acknowledge the receipt of your invoice. If everything is in order, we will process the payment to your details within the next 7 days.</p></br></br>
                    <p>Bests</br>Sound Influencers Team</p>
    </div>
    `;
};

export const buildClientCampaignInvoiceTemplate = () => {
    return `
<div style="
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
  background:#f6f7fb;
  padding:40px 20px;
">
  <div style="
    max-width:600px;
    margin:0 auto;
    background:#ffffff;
    border-radius:16px;
    padding:36px;
    box-shadow:0 10px 30px rgba(0,0,0,0.06);
  ">

    <h2 style="margin:0 0 18px 0; font-size:22px;">
      Campaign Request Received ✅
    </h2>

    <p style="margin:0 0 16px 0; color:#444; line-height:1.6;">
      Thank you for your campaign submission.
    </p>

    <p style="margin:0 0 20px 0; color:#444; line-height:1.6;">
      We have successfully received your request to create a new campaign.
      Our team has started reviewing the details and will proceed with the next steps shortly.
    </p>

    <div style="
      background:#f3f5f9;
      border-radius:12px;
      padding:18px;
      margin-bottom:22px;
    ">
      <p style="margin:0 0 8px 0; font-weight:600;">
        📎 Invoice Attached
      </p>
      <p style="margin:0; color:#555; line-height:1.5;">
        Please find the invoice for this campaign attached as a PDF file to this email.
        Kindly review it and proceed with the payment according to the terms specified in the document.
      </p>
    </div>

    <p style="margin:0 0 18px 0; color:#444; line-height:1.6;">
      Once the payment is confirmed, we will move your campaign forward to the execution phase.
    </p>

    <p style="margin:0 0 8px 0; color:#444;">
      If you have any questions, feel free to reply to this email.
    </p>

    <p style="margin:24px 0 0 0; color:#111; font-weight:500;">
      Best regards,<br/>
      The SoundInfluencers Team
    </p>

    <p style="
      margin-top:30px;
      font-size:12px;
      color:#9ca3af;
      text-align:center;
    ">
      This is an automated message from the SoundInfluencers system.
    </p>

  </div>
</div>
`;
};
