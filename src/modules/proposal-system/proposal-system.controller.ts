import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ProposalSystemService } from './proposal-system.service';
import { SaveProposalCampaignDto } from './dto/save-proposal-campaign.dto';
import * as process from 'node:process';
import {decodeAndDecrypt} from "../../common/utils/crypt";

@Controller('proposal-system')
export class ProposalSystemController {
  constructor(private readonly proposalSystemService: ProposalSystemService) {}

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
    if (!id) return;
    return this.proposalSystemService.getProposalCampaignById(id);
  }

  @Delete('delete-proposal-campaign/:campaignId/:campaignName')
  deleteProposalCampaign(
    @Param('campaignId') campaignId: string,
    @Param('campaignName') campaignName: string,
  ) {
    const decodedCampaignId = decodeAndDecrypt(
      campaignId,
      process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
    );
    return this.proposalSystemService.deleteProposalCampaign(decodedCampaignId, campaignName);
  }

  @Post('send-email-to-admin-changes/:campaignId/:campaignName')
  sendMailToAdminAboutChangingProposalCampaign(
    @Param('campaignId') campaignId: string,
    @Param('campaignName') campaignName: string,
  ) {
    const decodedCampaignId = decodeAndDecrypt(
      campaignId,
      process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
    );
    return this.proposalSystemService.sendMailToAdminAboutChangingProposalCampaign(
      decodedCampaignId,
      campaignName,
    );
  }

  @Post('approve/:campaignId')
  approveProposalCampaign(@Param('campaignId') campaignId: string) {
    return this.proposalSystemService.approveProposalCampaign(campaignId);
  }
}
