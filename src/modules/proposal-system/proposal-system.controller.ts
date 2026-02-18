import {Body, Controller, Delete, Get, Param, Patch, Post, Query, Req} from '@nestjs/common';
import {ProposalSystemService} from './proposal-system.service';
import {ApiOperation, ApiParam, ApiQuery, ApiTags} from "@nestjs/swagger";
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {AuthenticatedRequest, Role} from "../../common/types/user.types";
import {
    CreatedProposalCampaignIdDto, GetProposalCampaignDto,
    GetProposalCampaignsQueryDto,
    ProposalCampaignsListDto, ProposalCampaignWithOptionDto,
} from "./dto/proposal-campaigns.dto";
import {CreateCampaignDto} from "../campaigns/dto/create-campaign.dto";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {UpdateCampaignDto} from "../campaigns/dto/update-campaign.dto";
import {ProposalAccess} from "../../common/decorators/proposal-access.decorator";
import {Public} from "../../common/decorators/public.decorator";

@ApiTags('proposal-system')
@Controller('proposal-system')
export class ProposalSystemController {
    constructor(private readonly proposalSystemService: ProposalSystemService) {
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @ProposalAccess('adminOrProposalClient')
    @ApiOperation({summary: 'Create a proposal campaign or add new option to existing campaign (if request with query campaignId)'})
    @ApiResponseDto(CreatedProposalCampaignIdDto, {successStatusCode: 201})
    @ApiQuery({
        name: 'campaignId',
        type: 'string',
        required: false,
    })
    @Post()
    createProposalCampaign(
        @Req() req: AuthenticatedRequest,
        @Body() data: CreateCampaignDto,
        @Query('campaignId') campaignId?: string
    ): Promise<CreatedProposalCampaignIdDto> {
        return this.proposalSystemService.createProposalCampaign(data, req.user, campaignId);
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @ProposalAccess('adminOrProposalClient')
    @ApiOperation({summary: "Update proposal campaign option"})
    @ApiQuery({
        name: 'optionIndex',
        type: 'number',
        required: false,
    })
    @Patch(':campaignId')
    async updateProposalCampaignOption(
        @Req() req: AuthenticatedRequest,
        @Param('campaignId') campaignId: string,
        @Query('optionIndex') optionIndex: number = 0,
        @Body() data: UpdateCampaignDto
    ): Promise<ProposalCampaignWithOptionDto> {
        return this.proposalSystemService.updateProposalCampaignOption(
            {
                ...data,
                campaignId,
                optionIndex
            },
            req.user
        );
    }


    // @Auth()
    // @Roles(Role.client, Role.admin)
    // @Patch()
    // updateProposalCampaign(@Body() data: UpdateProposalCampaignDto) {
    //     return this.proposalSystemService.updateProposalCampaign(data);
    // }

    @Public()
    @ApiOperation({summary: 'Returns proposal campaign with one selected option'})
    @ApiResponseDto(ProposalCampaignWithOptionDto)
    @ApiQuery({
        name: 'optionIndex',
        type: 'number',
        required: true,
    })
    @Get(':campaignId')
    async getProposalCampaign(
        @Req() request: AuthenticatedRequest,
        @Query('optionIndex') optionIndex: number,
        @Param('campaignId') campaignId: string,
    ): Promise<ProposalCampaignWithOptionDto> {
        return this.proposalSystemService.getProposalCampaign(
            {
                campaignId: campaignId,
                optionIndex: optionIndex,
            },
            request.user
        );
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @ApiOperation({summary: 'Deletes selected option from proposal campaign'})
    @ApiResponseDto()
    @ApiQuery({
        name: 'optionIndex',
        type: 'number',
        required: true,
    })
    @Delete(':campaignId')
    async deleteProposalCampaignOption(
        @Req() request: AuthenticatedRequest,
        @Query('optionIndex') optionIndex: number,
        @Param('campaignId') campaignId: string,
    ) {
        return this.proposalSystemService.deleteProposalCampaignOption(
            {
                campaignId: campaignId,
                optionIndex: optionIndex,
            },
            request.user
        );
    }
}
