import {MediaStrategyFactory} from "./media.factory";
import {Injectable} from "@nestjs/common";
import {CampaignContentItem} from "../../database/schemas/campaign/campaign.schema";
import {GetCampaignContentVideoUrl, GetCampaignPreviewItem} from "./dto/resolved-media.dto";

@Injectable()
export class MediaService {
    constructor(private readonly factory: MediaStrategyFactory) {}

    // returns jpeg image with campaign content video preview
    async getCampaignPreviewJpeg(params: GetCampaignPreviewItem): Promise<Buffer | null> {
        return this.factory.getStrategyByProvider(params.provider).getPreviewJpeg(params);
    }

    // returns redirect url for campaign content video
    async getVideoRedirectUrl(params: GetCampaignContentVideoUrl) {
        const strategy = this.factory.getStrategyByProvider(params.provider);

        const videoUrl = await (strategy as any).getVideoUrl({
            pathLower: params.pathLower,
            url: params.url,
        });

        return { videoUrl };
    }

    async applyMediaCacheForCreate(contentItems: CampaignContentItem[]): Promise<CampaignContentItem[]> {
        const out = await Promise.all(
            contentItems.map(async (ci: any) => {
                const strategy = this.factory.getStrategy(ci.mainLink);
                const { mediaCachePatch } = await strategy.resolve(ci, 'create');

                return mediaCachePatch ? { ...ci, mediaCache: mediaCachePatch } : ci;
            }),
        );

        // console.log(`MEDIA SERVICE - out: ${JSON.stringify(out)}`)

        return out;
    }
}