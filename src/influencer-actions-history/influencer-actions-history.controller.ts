import {Body, Controller, Get, Param, Post} from "@nestjs/common";
import {InfluencerActionsHistoryService} from "./influencer-actions-history.service";
import {UpsertCampaignHistoryDto} from "./dto/upsert-campaign-history.dto";
import {UpsertInvoiceHistoryDto} from "./dto/upsert-invoice-history.dto";

@Controller('influencer-actions-history')
export class InfluencerActionsHistoryController {
    constructor(private readonly influencerActionsHistoryService: InfluencerActionsHistoryService) {
    }
    
    @Post('upsert/campaign')
    async upsertInfluencerCampaignActionsHistory(@Body() data: UpsertCampaignHistoryDto) {
        return this.influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory(data);
    }
    
    @Post('upsert/invoice')
    async upsertInfluencerInvoiceHistory(@Body() data: UpsertInvoiceHistoryDto) {
        return this.influencerActionsHistoryService.upsertInfluencerInvoiceHistory(data);
    }
    
    @Get('get/all')
    async getActionsHistoryForAllOfInfluencers() {
        return this.influencerActionsHistoryService.getActionsHistoryForAllOfInfluencers();
    }

    @Get('get/one/:influencerId')
    getActionsHistoryForInfluencer(@Param('influencerId') influencerId: string) {
        return this.influencerActionsHistoryService.getActionsHistoryForInfluencer(influencerId);
    }

    @Get('get/last-updates')
    getLastUpdates() {
        return this.influencerActionsHistoryService.getLastUpdates();
    }
}