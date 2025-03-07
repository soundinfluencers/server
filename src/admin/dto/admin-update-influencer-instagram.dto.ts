import {ApiProperty} from "@nestjs/swagger";

export class AdminUpdateInfluencerInstagramDto {
    @ApiProperty({required: true})
    influencerId: string;
    
    @ApiProperty({required: true})
    instagramId: string;
    
    @ApiProperty({required: false})
    instagramUsername: string;
    
    @ApiProperty({required: false})
    instagramLink: string;
    
    @ApiProperty({required: false})
    followersNumber: string;
    
    @ApiProperty({required: false})
    price: string;
    
    @ApiProperty({required: false})
    publicPrice: string;
    
    @ApiProperty({required: true})
    socialMedia: string;
    
    @ApiProperty({required: false})
    musicStyle: string;
    
    @ApiProperty({required: false})
    musicSubStyles: [];
    
    @ApiProperty({required: false})
    musicStyleOther: [];
    
    @ApiProperty({required: false})
    countries: [];
    
    @ApiProperty({required: false})
    categories: [];

    @ApiProperty({required: false})
    logo: string;
}
