import {Body, Controller, Get, Param, Post, Put} from "@nestjs/common";
import {ProposalSystemService} from "./proposal-system.service";
import {SaveProposalCampaignDto} from "./dto/save-proposal-campaign.dto";

@Controller('proposal-system')
export class ProposalSystemController {
    constructor(private readonly proposalSystemService: ProposalSystemService) {
    }
    
    @Get('get-all-clients')
    getAllClients() {
        return this.proposalSystemService.getAllClients();
    }
    
    @Get('get-all-brand-accounts/:socialMedia')
    getAllBrandAccounts(@Param('socialMedia') socialMedia: string) {
        return this.proposalSystemService.getAllBrandAccounts(socialMedia);
    }
    
    @Put('save-proposal-campaign')
    saveProposalCampaign(@Body() data: SaveProposalCampaignDto) {
        return this.proposalSystemService.saveProposalCampaign(data);
    }
    
    @Get('get-all-proposal-campaigns')
    getAllProposalCampaigns() {
        return this.proposalSystemService.getAllProposalCampaigns();
    }
    
    @Get('get-proposal-campaign/:id')
    getProposalCampaignById(@Param('id') id: string) {
        return this.proposalSystemService.getProposalCampaignById(id);
    }
}