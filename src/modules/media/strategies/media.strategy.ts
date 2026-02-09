import { ResolvedMediaDto } from '../dto/resolved-media.dto';
import {CampaignContentItem, CampaignContentMediaCache} from "../../../database/schemas/campaign/campaign.schema";

export type ResolveMode = 'create' | 'read';

export interface MediaStrategy {
    canHandle(mainLink: string): boolean;

    //todo: getPreviews

    //todo: get video

    resolve(
        contentItem: CampaignContentItem,
        mode?: ResolveMode,
    ): Promise<{
        resolved?: ResolvedMediaDto;
        mediaCachePatch?: CampaignContentMediaCache;
    }>;
}