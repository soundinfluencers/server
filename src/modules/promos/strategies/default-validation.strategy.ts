import {SocialMediaValidationStrategy} from "../types/promos.types";
import {InfluencerUpdatedPostDetailsDto} from "../dto/influencer-get-promos.dto";
import {BadRequestException} from "@nestjs/common";

export class DefaultSocialValidationStrategy implements SocialMediaValidationStrategy {
    validate(data: InfluencerUpdatedPostDetailsDto) {
        if (!data.postLink || !data.impressions || !data.like || !data.screenshotUrl) {
            throw new BadRequestException('Invalid promo data');
        }
    }
}
