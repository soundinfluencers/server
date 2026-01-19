import {Body, Controller, Get, Patch, Query} from '@nestjs/common';
import {ProposalSystemService} from './proposal-system.service';
import {SaveProposalCampaignDto} from './dto/save-proposal-campaign.dto';
import {ApiQuery, ApiTags} from "@nestjs/swagger";
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {Role} from "../../common/types/auth.types";
import {GetProposalCampaignsQueryDto, ProposalCampaignsListDto} from "./dto/get-proposal-campaigns.dto";

@ApiTags('proposal-system')
@Controller('proposal-system')
export class ProposalSystemController {
    constructor(private readonly proposalSystemService: ProposalSystemService) {
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @Patch('save')
    saveProposalCampaign(@Body() data: SaveProposalCampaignDto) {
        return this.proposalSystemService.saveProposalCampaign(data);
    }

    @Auth()
    @Roles(Role.admin)
    @ApiQuery({
        name: 'limit',
        required: false,
        type: 'number',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: 'number',
    })
    @Get('')
    async getAllProposalCampaigns(@Query() query: GetProposalCampaignsQueryDto): Promise<ProposalCampaignsListDto> {
        const campaigns = await this.proposalSystemService.getAllProposalCampaigns(query.limit, query.page);
        return ({campaigns});
    }

    // // TODO
    // @Get('get-proposal-campaign/:id')
    // getProposalCampaignById(@Param('id') id: string) {
    //     if (!id) return;
    //     return this.proposalSystemService.getProposalCampaignById(id);
    // }
    //
    // // TODO
    // @Delete('delete-proposal-campaign/:campaignId/:campaignName')
    // deleteProposalCampaign(
    //     @Param('campaignId') campaignId: string,
    //     @Param('campaignName') campaignName: string,
    // ) {
    //     const decodedCampaignId = decodeAndDecrypt(
    //         campaignId,
    //         process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
    //     );
    //     return this.proposalSystemService.deleteProposalCampaign(decodedCampaignId, campaignName);
    // }
    //
    // // TODO
    // @Post('send-email-to-admin-changes/:campaignId/:campaignName')
    // sendMailToAdminAboutChangingProposalCampaign(
    //     @Param('campaignId') campaignId: string,
    //     @Param('campaignName') campaignName: string,
    // ) {
    //     const decodedCampaignId = decodeAndDecrypt(
    //         campaignId,
    //         process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
    //     );
    //     return this.proposalSystemService.sendMailToAdminAboutChangingProposalCampaign(
    //         decodedCampaignId,
    //         campaignName,
    //     );
    // }
    //
    // // TODO
    // @Post('approve/:campaignId')
    // approveProposalCampaign(@Param('campaignId') campaignId: string) {
    //     return this.proposalSystemService.approveProposalCampaign(campaignId);
    // }
}
