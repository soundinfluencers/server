import {InfluencerUpdatedPostDetailsDto} from "../dto/influencer-get-promos.dto";

export interface SocialMediaValidationStrategy {
    validate(data: InfluencerUpdatedPostDetailsDto): void;
}
