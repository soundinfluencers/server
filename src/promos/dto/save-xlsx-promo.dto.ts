import { ApiProperty } from '@nestjs/swagger';

interface page {
    socialMediaUsername: string;
    followersNumber: number;
    videoLink: string | null;
    storyTag: string | null;
    storyLink: string | null;
    postDescription: string | null;
}

export class SaveXlsxPromoDto {
    @ApiProperty({ required: false })
    price: number | null;

    @ApiProperty({ required: false })
    timeline: string;

    @ApiProperty({ required: false })
    socialMedia: string | null;

    @ApiProperty({ required: false })
    pages: page[];
}