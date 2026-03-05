import {IsEnum, IsMongoId, IsNumber, IsOptional, IsString} from "class-validator";
import {ObjId} from "../../../common/types/base.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {CurrencyCode} from "../../../common/types/finance.types";
import {Role} from "../../../common/types/user.types";
import {Type} from "class-transformer";

// Dto for creating negotiation offer (for new/existing negotiation)
export class CreateNegotiationOfferDto {
    @IsEnum(Role)
    role: Role; // role of side that's creating this offer

    @IsOptional()
    @IsMongoId()
    negotiationId?: ObjId; // id of negotiation that offer needs to be connected with

    @IsNumber()
    offeredPrice: number; // price that side is offering

    @IsEnum(CurrencyCode)
    currencyCode: CurrencyCode; // selected currency

    @IsString()
    email: string;
}

// Dto for starting new negotiation
export class NegotiationDto {
    @IsMongoId()
    userId: ObjId; // influencer id

    @IsMongoId()
    accountId: ObjId; // social account id

    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum; // social media of disputed account

    @Type(() => CreateNegotiationOfferDto)
    offerPayload: CreateNegotiationOfferDto;
}