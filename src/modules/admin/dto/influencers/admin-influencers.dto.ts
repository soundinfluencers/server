import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {SocialMediaEnum} from "../../../../common/types/social-media.types";
import {CurrencyCode} from "../../../../common/types/finance.types";
import {PaginatedListResponseDto} from "../../../../common/dto/responses/paginated-list-response.dto";

// DTO with social account and owner's information. For admin panel influencers list
export class AdminSocialAccountForListDto {
    @ApiProperty({ type: String })
    influencerId: string; // influencer _id

    @ApiProperty({ type: String })
    firstName: string;

    @ApiProperty({ type: String })
    lastName: string;

    @ApiProperty({ type: String })
    email: string;

    @ApiProperty({ type: String })
    phone: string;

    @ApiProperty({ type: Number })
    balance: number;

    @ApiProperty({ type: String })
    accountId: string; // social account _id

    @ApiProperty({ type: String })
    username: string;

    @ApiProperty({ type: String, enum: SocialMediaEnum })
    socialMedia: SocialMediaEnum;

    @ApiPropertyOptional({ type: String })
    logoUrl?: string;

    @ApiProperty({ type: Number })
    followers: number;

    @ApiProperty({ type: String })
    profileLink: string;

    @ApiProperty({ type: Number })
    publicPrice: number; // show to clients

    @ApiProperty({ type: Number })
    price: number; // real price. real price = initial price * exchange rate

    @ApiProperty({ type: Number })
    initialPrice: number; // price that was chosen by account's owner

    @ApiProperty({ type: Number })
    currency: CurrencyCode; // currency that was chosen by account's owner

    @ApiProperty({ type: Number })
    costPerFollower: number;

    @ApiProperty({ type: Boolean })
    isHidden: boolean;

    @ApiPropertyOptional({ type: String })
    internalNote?: string;
}

// DTO response for fetching influencers list on admin panel
export class AdminInfluencersListDto extends PaginatedListResponseDto<AdminSocialAccountForListDto>{
    @ApiProperty({ type: AdminSocialAccountForListDto, isArray: true })
    items: AdminSocialAccountForListDto[];
}
