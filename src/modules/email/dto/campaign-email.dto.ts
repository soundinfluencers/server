// dto fot building 'request edit' email template
export class BuildCampaignEmailDto {
    campaignId: string;
    clientId: string;

    campaignName: string;
    clientName: string;
    clientEmail: string;

    acceptLink: string;
    declineLink: string;
}