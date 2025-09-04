export interface AccountObjectForCreateNewPromoRequestMessage {
  pageName: string;
  reward: string;
  socialMedia: string;
  contentLink: string;
  description?: string;
  storyTag?: string;
  storyLink?: string;
  specialRequests?: string;
}

interface CreateNewPromoRequestMessageProps {
  firstName: string;
  accountsAndDetails: AccountObjectForCreateNewPromoRequestMessage[];
}

export const createNewPromoRequestTextMessage = (
  data: CreateNewPromoRequestMessageProps
): string => {
  const { firstName, accountsAndDetails } = data;

  const platformMessages = accountsAndDetails.map(formatAccountText);

  return `Hi ${firstName},

You have a new promo request 🔥

CAMPAIGN DETAILS:

${platformMessages.join('\n\n')}

You can manage this promo(s) in your account here: https://go.soundinfluencers.com/account/influencer/new-promos

Let us know if you'd like to take part in this campaign(s)
`;
};

export const createNewPromoRequestHTMLMessage = (
  data: CreateNewPromoRequestMessageProps
): string => {
  const { firstName, accountsAndDetails } = data;

  const platformMessages = accountsAndDetails.map(formatAccountHTML);

  return `Hi ${firstName},<br><br>

You have a new promo request 🔥<br><br>

<strong>CAMPAIGN DETAILS:</strong><br><br>

${platformMessages.join('<br><br>')}

<br><br>You can manage this promo(s) in your account here: <a href="https://go.soundinfluencers.com/account/influencer/new-promos">Dashboard Link</a><br><br>

Let us know if you'd like to take part in this campaign(s)
`;
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

function formatAccountText(acc: AccountObjectForCreateNewPromoRequestMessage): string {
  const lines: string[] = [];

  lines.push(`*Platform:* ${getPlatformDescription(acc.socialMedia)}`);

  switch (acc.socialMedia.toLowerCase()) {
    case 'youtube':
      lines.push(`*Channel:* ${acc.pageName}`);
      lines.push(`*Content:* ${acc.contentLink}`);
      if (acc.description) lines.push(`*Description:* ${acc.description}`);
      if (acc.storyTag) lines.push(`*Story Tag:* ${acc.storyTag}`);
      if (acc.storyLink) lines.push(`*Story Link:* ${acc.storyLink}`);
      if (acc.specialRequests) lines.push(`*Special Requests:* ${acc.specialRequests}`);
      break;
    case 'spotify':
      lines.push(`*Playlist:* ${acc.pageName}`);
      lines.push(`*Track:* ${acc.contentLink}`);
      break;
    case 'soundcloud':
      lines.push(`*Channel:* ${acc.pageName}`);
      lines.push(`*Track:* ${acc.contentLink}`);
      break;
    case 'press':
      lines.push(`*Website:* ${acc.pageName}`);
      lines.push(`*Press Release:* ${acc.contentLink}`);
      break;
    default:
      lines.push(`*Page:* ${acc.pageName}`);
      lines.push(`*Content:* ${acc.contentLink}`);
      if (acc.description) lines.push(`*Description:* ${acc.description}`);
      if (acc.storyTag) lines.push(`*Story Tag:* ${acc.storyTag}`);
      if (acc.storyLink) lines.push(`*Story Link:* ${acc.storyLink}`);
      if (acc.specialRequests) lines.push(`*Special Requests:* ${acc.specialRequests}`);
      break;
  }

  lines.push(`*Reward:* ${acc.reward}`);
  return lines.join('\n');
}

function formatAccountHTML(acc: AccountObjectForCreateNewPromoRequestMessage): string {
  const lines: string[] = [];

  lines.push(`<strong>Platform:</strong> ${getPlatformDescription(acc.socialMedia)}`);

  switch (acc.socialMedia.toLowerCase()) {
    case 'youtube':
      lines.push(`<strong>Channel:</strong> ${acc.pageName}`);
      lines.push(`<strong>Content:</strong> ${acc.contentLink}`);
      if (acc.description) lines.push(`<strong>Description:</strong> ${acc.description}`);
      if (acc.storyTag) lines.push(`<strong>Story Tag:</strong> ${acc.storyTag}`);
      if (acc.storyLink) lines.push(`<strong>Story Link:</strong> ${acc.storyLink}`);
      if (acc.specialRequests) lines.push(`<strong>Special Requests:</strong> ${acc.specialRequests}`);
      break;
    case 'spotify':
      lines.push(`<strong>Playlist:</strong> ${acc.pageName}`);
      lines.push(`<strong>Track:</strong> ${acc.contentLink}`);
      break;
    case 'soundcloud':
      lines.push(`<strong>Channel:</strong> ${acc.pageName}`);
      lines.push(`<strong>Track:</strong> ${acc.contentLink}`);
      break;
    case 'press':
      lines.push(`<strong>Website:</strong> ${acc.pageName}`);
      lines.push(`<strong>Press Release:</strong> ${acc.contentLink}`);
      break;
    default:
      lines.push(`<strong>Page:</strong> ${acc.pageName}`);
      lines.push(`<strong>Content:</strong> ${acc.contentLink}`);
      if (acc.description) lines.push(`<strong>Description:</strong> ${acc.description}`);
      if (acc.storyTag) lines.push(`<strong>Story Tag:</strong> ${acc.storyTag}`);
      if (acc.storyLink) lines.push(`<strong>Story Link:</strong> ${acc.storyLink}`);
      if (acc.specialRequests) lines.push(`<strong>Special Requests:</strong> ${acc.specialRequests}`);
      break;
  }

  lines.push(`<strong>Reward:</strong> ${acc.reward?.replace(/\D/g, '') + '€' || ''}`);
  return lines.join('<br>');
}
