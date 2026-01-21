import {ApiOperation, ApiParam, ApiQuery, ApiTags} from "@nestjs/swagger";
import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    Res,
    UnauthorizedException
} from "@nestjs/common";
import {CampaignsService} from "./campaigns.service";
import {AuthenticatedRequest, Role} from "../../common/types/auth.types";
import {
    ClientCampaignForTableDto,
    ClientGetCampaignsDto,
    ClientGetDashboardCampaignsQueryDto, DetailedDraftCampaignDto
} from "./dto/get-campaigns.dto";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {Auth} from "../../common/decorators/auth.decorator";
import {Public} from "../../common/decorators/public.decorator";
import {SaveXlsxCampaignDto} from "./dto/save-xlsx-campaign.dto";
import {SendNewFullServicedCampaignRequest} from "./dto/send-new-full-serviced-campaign-request";
import {CreateCampaignDto, CreateDraftCampaignDto} from "./dto/create-campaign.dto";
import { Response } from 'express';
import {
    CampaignTypeEnumForDevelopment,
    PublicCampaignForTable
} from "../../common/types/client/campaign.types";
import {Roles} from "../../common/decorators/roles.decorator";

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
    constructor(private readonly campaignsService: CampaignsService) {
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({ summary: 'Get client campaigns list' })
    @ApiResponseDto(ClientGetCampaignsDto)
    @ApiQuery({
        name: 'status',
        required: false,
        enum: CampaignTypeEnumForDevelopment,
    })
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
    @Get()
    async getCampaignsList(
        @Req() request: AuthenticatedRequest,
        @Query() query: ClientGetDashboardCampaignsQueryDto,
    ): Promise<ClientGetCampaignsDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        const campaigns = await this.campaignsService.getCampaignsList({...query, clientId: request.user._id});

        return { campaigns };
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({summary: 'Creates a new default campaign'})
    @ApiResponseDto(undefined, {successStatusCode: 201})
    @Post()
    createCampaign(@Req() req: AuthenticatedRequest, @Body() data: CreateCampaignDto) {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');

        return this.campaignsService.createCampaign({...data, clientId: req.user._id});
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({summary: 'Get detailed campaign draft'})
    @ApiResponseDto(DetailedDraftCampaignDto)
    @ApiParam({
        name: 'draftId',
        required: true,
    })
    @Get('draft/:draftId')
    getDraftCampaign(@Req() req: AuthenticatedRequest, @Param('draftId') draftId: string): Promise<DetailedDraftCampaignDto> {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');

        return this.campaignsService.getDraftCampaign(draftId);
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({summary: 'Saves new campaign draft'})
    @ApiResponseDto(undefined, {successStatusCode: 201})
    @Post('draft')
    createDraftCampaign(@Req() req: AuthenticatedRequest, @Body() data: CreateDraftCampaignDto) {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');

        return this.campaignsService.createDraftCampaign({...data, clientId: req.user._id});
    }

    @Public()
    @ApiOperation({summary: 'Verify campaign (For email)'})
    @Get('verify')
    async verifyCampaign(@Query() args: { promoId: string; status: string }, @Res() res: Response) {
        const result: { code: number, message: string } = await this.campaignsService.verifyCampaign(args.promoId, args.status);

        if (result.code === 200) {
            const successMessage = result.message || 'Campaign verified';
            return res.send(`
      <html lang="">
        <head>
          <title>Campaign Verification</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background-color: #f4f4f8;
              color: #333;
              text-align: center;
            }
            .container {
              max-width: 500px;
              padding: 20px;
              background-color: white;
              border-radius: 10px;
              box-shadow: 0 0 15px rgba(0,0,0,0.1);
            }
            h1 {
              color: #4CAF50;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${successMessage}</h1>
            <p>Thank you! This window can now be closed.</p>
          </div>
        </body>
      </html>
    `);
        }

        return res.status(result.code || 500).send(`
    <html lang="">
      <head>
        <title>Error</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            margin-top: 100px;
            color: #c00;
          }
        </style>
      </head>
      <body>
        <h1>Something went wrong</h1>
        <p>${result.message || 'Unknown error occurred'}</p> 
      </body>
    </html>
  `);
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({summary: 'Get client campaign (completed or ongoing)'})
    @ApiParam({name: 'campaignId', required: true})
    @ApiResponseDto(ClientCampaignForTableDto)
    @Get(':campaignId')
    clientGetOngoingOrPastCampaign(@Param('campaignId') campaignId: string, @Req() request: AuthenticatedRequest): Promise<ClientCampaignForTableDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.campaignsService.getClientOngoingOrPastCampaign(campaignId, request.user._id);
    }

    // TODO: DELETE (INSTEAD OF THIS - CREATE LOGIC IN client/get/list)
    @Auth()
    @Roles(Role.client)
    @Get('proposals')
    @ApiOperation({summary: `Gets client's proposal campaigns (Will be deleted)`})
    @ApiResponseDto(ClientGetCampaignsDto)
    async getClientProposalPromos(@Req() request: AuthenticatedRequest): Promise<ClientGetCampaignsDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        const campaigns = await this.campaignsService.getClientProposalCampaigns(request.user._id);

        return { campaigns }
    }

    @Public()
    @ApiOperation({summary: `Importing .xlsx campaign`})
    @ApiResponseDto()
    @Post('xlsx')
    saveXLSXCampaign(@Body() data: SaveXlsxCampaignDto) {
        return this.campaignsService.saveXLSXCampaign(data);
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({summary: `Sends full service campaign request`})
    @Post('requests/full-service')
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    sendNewFullServicedCampaignRequest(@Req() request: AuthenticatedRequest, @Body() data: SendNewFullServicedCampaignRequest) {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.campaignsService.sendNewFullServicedCampaignRequest(data);
    }

    @Public()
    @ApiOperation({summary: `Get campaign by public share link`})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiResponseDto(ClientCampaignForTableDto)
    @Get(':campaignId/share')
    getCampaignByPublicShareLink(@Param() campaignId: string): Promise<PublicCampaignForTable> {
        return this.campaignsService.getCampaignByPublicShareLink(campaignId);
    }
}