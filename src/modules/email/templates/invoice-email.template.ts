import {escapeHtml} from "./campaign-email.template";
import {BuildInvoiceEmailDto} from "../dto/invoice-email.dto";

export const buildInfluencerInvoiceEmail = (invoiceData: BuildInvoiceEmailDto) => {
    const influencerEmail = escapeHtml(invoiceData.influencerEmail ?? "Invalid email address");
    const instagramAccounts = escapeHtml(invoiceData.instagramAccounts ?? "0 accounts");
    const tiktokAccounts = escapeHtml(invoiceData.tiktokAccounts ?? "0 accounts");
    const spotifyAccounts = escapeHtml(invoiceData.spotifyAccounts ?? "0 accounts");
    const soundcloudAccounts = escapeHtml(invoiceData.soundcloudAccounts ?? "0 accounts");
    const facebookAccounts = escapeHtml(invoiceData.facebookAccounts ?? "0 accounts");
    const youtubeAccounts = escapeHtml(invoiceData.youtubeAccounts ?? "0 accounts");
    const pressAccounts = escapeHtml(invoiceData.pressAccounts ?? "0 accounts");
    const selectedPaymentMethod = escapeHtml(invoiceData.selectedPaymentMethod ?? "Unknown payment method");

    return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color:#111; line-height:1.4;">
      <p>Invoice from ${influencerEmail}</p>
    <p><b>Instagram Accounts:</b> ${instagramAccounts || '0 accounts'}</p>
    <p><b>TikTok Accounts:</b> ${tiktokAccounts || '0 accounts'}</p>
    <p><b>Spotify Accounts:</b> ${spotifyAccounts || '0 accounts'}</p>
    <p><b>SoundCloud Accounts:</b> ${soundcloudAccounts || '0 accounts'}</p>
    <p><b>Facebook Accounts:</b> ${facebookAccounts || '0 accounts'}</p>
    <p><b>YouTube Accounts:</b> ${youtubeAccounts || '0 accounts'}</p>
    <p><b>Press Accounts:</b> ${pressAccounts || '0 accounts'}</p>
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