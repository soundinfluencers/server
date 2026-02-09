import {MediaStrategyFactory} from "./media.factory";
import {Injectable} from "@nestjs/common";
import {CampaignContentItem} from "../../database/schemas/campaign/campaign.schema";

@Injectable()
export class MediaService {
    constructor(private readonly factory: MediaStrategyFactory) {}

    // getting previews
    async getPreviewsBatch(fileIds: string[]) {
        // getting all of previews
        // use strategies
    }

    // getting video
    async getVideoRedirectUrl(params: { fileId?: string; url?: string }) {
        // getting one video
        // use strategies
    }

    async applyMediaCacheForCreate(contentItems: CampaignContentItem[]): Promise<CampaignContentItem[]>  {
        const out = await Promise.all(
            contentItems.map(async (ci: any) => {
                const strategy = this.factory.getStrategy(ci.mainLink);
                const { mediaCachePatch } = await strategy.resolve(ci, 'create');

                return mediaCachePatch
                    ? { ...ci, mediaCache: mediaCachePatch }
                    : ci;
            }),
        );

        return out;
    }
}
