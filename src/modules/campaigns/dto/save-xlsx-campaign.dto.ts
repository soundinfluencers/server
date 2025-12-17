import { ApiProperty } from '@nestjs/swagger';

interface Page {
  socialMediaUsername: string;
  followersNumber: number;
  videoLink: string | null;
  storyTag: string | null;
  storyLink: string | null;
  postDescription: string | null;
  specialWishes: string | null;
}

export class SaveXlsxCampaignDto {
  @ApiProperty({ required: false })
  campaignName: string | null;

  @ApiProperty({ required: false })
  price: number | null;

  @ApiProperty({ required: false })
  timeline: string;

  @ApiProperty({ required: false })
  socialMedia: string | null;

  @ApiProperty({ required: false })
  pages: Page[];
}
