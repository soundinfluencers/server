import {Body, Controller, Get, Patch, Post, Query, Req} from '@nestjs/common';
import {ProposalSystemService} from './proposal-system.service';
import {ApiOperation, ApiQuery, ApiTags} from "@nestjs/swagger";
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {AuthenticatedRequest, Role} from "../../common/types/auth.types";
import {
    CreatedProposalCampaignIdDto,
    GetProposalCampaignsQueryDto,
    ProposalCampaignsListDto,
    UpdateProposalCampaignDto
} from "./dto/proposal-campaigns.dto";
import {CreateCampaignDto} from "../campaigns/dto/create-campaign.dto";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";

@ApiTags('proposal-system')
@Controller('proposal-system')
export class ProposalSystemController {
    constructor(private readonly proposalSystemService: ProposalSystemService) {
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @ApiOperation({summary: 'Create a proposal campaign'})
    @ApiResponseDto(CreatedProposalCampaignIdDto, {successStatusCode: 201})
    @Post()
    createProposalCampaign(@Req() req: AuthenticatedRequest, @Body() data: CreateCampaignDto): Promise<CreatedProposalCampaignIdDto> {
        return this.proposalSystemService.createProposalCampaign(data, {creatorId: req.user._id, creatorRole: req.user.role});
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @Patch()
    updateProposalCampaign(@Body() data: UpdateProposalCampaignDto) {
        return this.proposalSystemService.updateProposalCampaign(data);
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
