import {ApiExcludeEndpoint, ApiOperation, ApiParam, ApiQuery, ApiTags} from "@nestjs/swagger";
import {
    Body,
    Controller,
    Delete,
    Get, Header,
    Param,
    Patch,
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
    ClientGetDashboardCampaignsQueryDto,
    DetailedDraftCampaignDto
} from "./dto/get-campaigns.dto";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {Auth} from "../../common/decorators/auth.decorator";
import {Public} from "../../common/decorators/public.decorator";
import {SaveXlsxCampaignDto} from "./dto/save-xlsx-campaign.dto";
import {CreateCampaignDto, CreateDraftCampaignDto} from "./dto/create-campaign.dto";
import {Response} from 'express';
import {CampaignTypeEnumForDevelopment, PublicCampaignForTable} from "../../common/types/client/campaign.types";
import {Roles} from "../../common/decorators/roles.decorator";
import {UpdateCampaignDto} from "./dto/update-campaign.dto";
import {CreateBespokeCampaignDto} from "./dto/bespoke-request.dto";
import {CampaignPreviewItemDto, GetCampaignContentVideoUrl} from "../media/dto/resolved-media.dto";
import {ThumbSizeTag} from "../media/strategies/media.strategy";

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
    constructor(private readonly campaignsService: CampaignsService) {
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({summary: 'Get client campaigns list'})
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

        return {campaigns};
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

    @Auth()
    @Roles(Role.client, Role.admin)
    @ApiOperation({summary: 'Delete draft by id'})
    @ApiResponseDto(DetailedDraftCampaignDto)
    @Delete('draft/:draftId')
    deleteDraftCampaign(@Req() request: AuthenticatedRequest, @Param('draftId') draftId: string) {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.campaignsService.deleteDraftCampaign(draftId, request.user._id);
    }

    @ApiExcludeEndpoint()
    @Public()
    @ApiOperation({summary: 'Verify campaign (For email)'})
    @Get('verify')
    async verifyCampaign(@Query() args: { campaignId: string; status: string }, @Res() res: Response) {
        const result: {
            code: number,
            message: string
        } = await this.campaignsService.verifyCampaign(args.campaignId, args.status);

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
    @ApiOperation({summary: 'Get client campaign (completed, ongoing)'})
    @ApiParam({name: 'campaignId', required: true})
    @ApiResponseDto(ClientCampaignForTableDto)
    @Get(':campaignId')
    clientGetOngoingOrPastCampaign(@Param('campaignId') campaignId: string, @Req() request: AuthenticatedRequest): Promise<ClientCampaignForTableDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.campaignsService.getClientOngoingOrPastCampaign(campaignId, request.user._id);
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @ApiOperation({summary: 'Updates ongoing campaign'})
    @ApiParam({name: 'campaignId', required: true})
    @ApiResponseDto(ClientCampaignForTableDto)
    @Patch(':campaignId/update')
    updateCampaign(@Param('campaignId') campaignId: string, @Body() data: UpdateCampaignDto, @Req() request: AuthenticatedRequest): Promise<ClientCampaignForTableDto> {
        return this.campaignsService.updateOngoingCampaign({...data, campaignId}, request.user);
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
    @Post('bespoke')
    @ApiResponseDto(undefined, {successStatusCode: 201})
    createBespokeCampaignRequest(@Req() request: AuthenticatedRequest, @Body() data: CreateBespokeCampaignDto) {
        return this.campaignsService.createBespokeCampaignRequest(data, request.user);
    }

    @Public()
    @ApiOperation({summary: `Get campaign by public share link`})
    @ApiParam({name: 'campaignId', required: true})
    @ApiResponseDto(ClientCampaignForTableDto)
    @Get(':campaignId/share')
    getCampaignByPublicShareLink(@Param('campaignId') campaignId: string): Promise<PublicCampaignForTable> {
        return this.campaignsService.getCampaignByPublicShareLink(campaignId);
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({summary: `Sending email about campaign edit request`})
    @ApiParam({name: 'campaignId', required: true})
    @ApiResponseDto()
    @Post(':campaignId/request-edit')
    sendEditRequestEmail(@Req() request: AuthenticatedRequest, @Param('campaignId') campaignId: string) {
        return this.campaignsService.requestCampaignEdit(campaignId, request.user._id);
    }

    // todo: in future improve logic for accepting/declining from email (а вообще-то нужно сделать возможным только через админку. потому что для этого админка и пишется)
    @Public()
    @ApiExcludeEndpoint()
    @Get(':campaignId/request-edit/:response')
    updateCampaignEditRequest(@Param('campaignId') campaignId: string, @Param('response') response: string) {
        return this.campaignsService.updateCampaignEditRequest(campaignId, response);
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @ApiOperation({summary: `Return .csv file with completed campaign info`})
    @ApiParam({name: 'campaignId', required: true, type: 'string'})
    @Get(':campaignId/csv')
    async getCampaignCsvFile(@Req() request: AuthenticatedRequest, @Param('campaignId') campaignId: string, @Res() res: Response) {
        const {stream, filename} = await this.campaignsService.streamCampaignCsv(campaignId, request.user);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', filename);
        res.setHeader('Cache-Control', 'no-store');

        stream.pipe(res);
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @Get(':campaignId/pdf')
    async getCampaignPdfFile(
        @Req() request: AuthenticatedRequest,
        @Param('campaignId') campaignId: string,
        @Res() res: Response,
    ) {
        const {pdfBuffer, filename} = await this.campaignsService.buildCampaignPdfReport(
            campaignId,
            request.user,
        );

        res.status(200);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', filename);
        res.setHeader('Cache-Control', 'no-store');

        return res.end(pdfBuffer);
    }

    @Public()
    @ApiOperation({summary: 'Returns previews for campaign content videos'})
    @ApiResponseDto(CampaignPreviewItemDto, {isArray: true})
    @ApiParam({
        name: 'campaignId',
    })
    @ApiQuery({
        name: 'pathLower'
    })
    @ApiQuery({
        name: 'sizeTag'
    })
    @Header('Content-Type', 'image/jpeg')
    @Header('Cache-Control', 'public, max-age=86400')
    @Get(':campaignId/preview')
    async getCampaignContentPreview(@Param('campaignId') campaignId: string, @Query('pathLower') pathLower: string, @Query('sizeTag') sizeTag: ThumbSizeTag = 'w256h256', @Res() res: Response) {
        if (!pathLower) return res.status(400).end();

        const buffer = await this.campaignsService.getCampaignContentPreviewJpeg(campaignId, pathLower, sizeTag);

        if (!buffer) return res.status(404).end();

        return res.send(buffer);
    }

    @Public()
    @ApiOperation({summary: 'Returns campaign content video'})
    @ApiResponseDto()
    @Get(':campaignId/video')
    async getCampaignVideo(@Body() data: GetCampaignContentVideoUrl, @Res() res: Response) {
        const videoUrl = await this.campaignsService.getCampaignContentVideoUrl(data);
        return res.redirect(302, videoUrl);
    }
}