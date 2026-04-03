import {SocialMediaEnum} from "../../../../common/types/social-media.types";

interface Page {
    username: string;
    followers: number;
    mainLink: string | null;
    taggedUser: string | null;
    taggedLink: string | null;
    description: string | null;
    additionalBrief: string | null;
}

export class XlsxCampaignDto {
    campaignName: string | null;
    price: number | null;
    timeline: string;
    socialMedia: SocialMediaEnum | 'multipromo';
    pages: Page[];
}
