import {ApiOperation, ApiQuery, ApiTags} from "@nestjs/swagger";
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
import {AuthenticatedRequest} from "../../common/types/auth.types";
import {ClientCampaignForTableDto, ClientGetCampaignsDto} from "./dto/get-campaigns.dto";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {Auth} from "../../common/decorators/auth.decorator";
import {Public} from "../../common/decorators/public.decorator";
import {SaveXlsxCampaignDto} from "./dto/save-xlsx-campaign.dto";
import {SendNewFullServicedCampaignRequest} from "./dto/send-new-full-serviced-campaign-request";
import {CreateCampaignDto} from "./dto/create-campaign.dto";
import { Response } from 'express';
import {
    CampaignStatusEnumForDevelopment,
    CampaignStatusTypeForDevelopment, PublicCampaignForTable
} from "../../common/types/client/campaign.types";

// TODO: add 403 forbidden for influencers
@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
    constructor(private readonly campaignsService: CampaignsService) {
    }

    @Auth()
    @ApiOperation({ summary: 'Get client campaigns list' })
    @ApiResponseDto(ClientGetCampaignsDto)
    @ApiQuery({
        name: 'status',
        required: false,
        enum: CampaignStatusEnumForDevelopment,
    })
    @Get()
    async getCampaignsList(
        @Req() request: AuthenticatedRequest,
        @Query('status') status?: CampaignStatusTypeForDevelopment,
    ): Promise<ClientGetCampaignsDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        const campaigns = await this.campaignsService.getClientCampaignsList(
            request.user._id,
            status,
        );

        return { campaigns };
    }

    @Auth()
    @ApiOperation({summary: 'Creates a new campaign from client side'})
    @ApiResponseDto(undefined, {successStatusCode: 201})
    @Post()
    createCampaign(@Body() data: CreateCampaignDto) {
        return this.campaignsService.createCampaign(data);
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
    @ApiOperation({summary: 'Get client campaign (completed or ongoing)'})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiResponseDto(ClientCampaignForTableDto)
    @Get(':campaignId')
    clientGetOngoingOrPastCampaign(@Param('campaignId') campaignId: string, @Req() request: AuthenticatedRequest): Promise<ClientCampaignForTableDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');
        if (!campaignId) throw new BadRequestException('Not enough arguments');

        return this.campaignsService.getClientOngoingOrPastCampaign(campaignId, request.user._id);
    }

    // TODO: DELETE (INSTEAD OF THIS - CREATE LOGIC IN client/get/list)
    @Auth()
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