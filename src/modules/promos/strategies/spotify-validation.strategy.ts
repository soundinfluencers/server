import {InfluencerUpdatedPostDetailsDto} from "../dto/influencer-get-promos.dto";
import {BadRequestException} from "@nestjs/common";
import {SocialMediaValidationStrategy} from "../types/promos.types";

export class SpotifyValidationStrategy implements SocialMediaValidationStrategy {
    validate(data: InfluencerUpdatedPostDetailsDto) {
        if (!data.rating) {
            throw new BadRequestException('Rating required');
        }
        if (!data.screenshotUrl) {
            throw new BadRequestException('Screenshot required');
        }
    }
}