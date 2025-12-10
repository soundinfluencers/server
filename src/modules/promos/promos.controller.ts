import {
    Controller,
    Get,
    Post,
    Body,
    Put,
    Param,
    Query,
    UseInterceptors,
    UploadedFile,
    Res, Req,
} from '@nestjs/common';
import {PromosService} from './promos.service';
import {CreatePromosDto} from './dto/create-promo.dto';
import {ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags} from '@nestjs/swagger';
import {FileInterceptor} from '@nestjs/platform-express';
import File from 'multer';
import {GetSelectedSocialAccountsDto} from './dto/get-selected-social-accounts.dto';
import {SendNewFullServicedCampaignRequest} from './dto/send-new-full-serviced-campaign-request';
import {SaveXlsxPromoDto} from './dto/save-xlsx-promo.dto';
import {Response} from 'express';
import {
    InfluencerGetPastPromoReqDto,
    InfluencerGetPastPromoResDto,
} from "./dto/influencer-get-past-promo.dto";
import {ClientGetCampaignsListDto} from "./dto/client-get-campaigns-list.dto";
import {AuthenticatedRequest} from "../../common/types/auth.types";
import {decodeAndDecrypt} from "../../common/utils/crypt";
import {Auth} from "../../common/decorators/auth.decorator";
import {Public} from "../../common/decorators/public.decorator";
import {ApiResponseDto} from "../../common/decorators/api-response.decorator";

@ApiTags('promos')
@Controller('promos')
export class PromosController {
    constructor(private readonly promosService: PromosService) {
    }

    @Auth()
    @ApiOperation({ summary: 'Get client campaigns list' })
    @ApiResponseDto(ClientGetCampaignsListDto, { isArray: true })
    @Get('client/get/list')
    clientGetCampaignsList(
        @Req() request: AuthenticatedRequest,
    ) {
        return this.promosService.clientGetCampaignsList(request.user._id);
    }

    @Auth()
    @ApiOperation({ summary: 'Creates a new campaign from client side' })
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Post('client-create-campaign')
    createPromos(@Body() data: CreatePromosDto) {
        return this.promosService.createPromo(data);
    }

    @Public()
    @ApiOperation({ summary: 'Verify campaign (For email)' })
    @Get('verify-promo')
    async verifyCampaign(@Query() args: { promoId: string; status: string }, @Res() res: Response) {
        const result = await this.promosService.verifyCampaign(args.promoId, args.status);

        if (result.code === 200) {
            const successMessage = result.message || 'Campaign verified';
            return res.send(`
      <html>
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
    <html>
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

    // TODO: REMOVE TO FILES SERVICE
    @Post('uploadScreenshot')
    @ApiOperation({ summary: 'Uploads screenshot - will be removed to files controller' })
    @ApiResponseDto()
    @UseInterceptors(FileInterceptor('file'))
    uploadFile(@UploadedFile() file: File) {
        return this.promosService.uploadDropBox(file);
    }

    @Get('check-upload-status')
    @ApiOperation({ summary: 'Checks if screenshot uploaded - will be removed to files controller' })
    @ApiResponseDto()
    async checkUploadStatus(@Query('fileName') fileName: string): Promise<boolean> {
        return await this.promosService.checkUploadStatus(fileName);
    }

    @Auth()
    @ApiOperation({ summary: `Gets client's completed campaigns (Will be deleted)` })
    @ApiResponseDto()
    @ApiQuery({name: 'id', required: true})
    @Get('client-completed-campaigns/history')
    clientCompletedCampaignsHistory(@Query() args: { id: string }) {
        return this.promosService.clientCompletedCampaignsHistory(args.id);
    }

    @Auth()
    @ApiOperation({ summary: 'Get influencer completed promos' })
    @ApiQuery({name: 'influencerId', required: true})
    @Get('influencer-completed-campaigns/history')
    influencerCompletedCampaignsHistory(@Query() args: { influencerId: string }) {
        return this.promosService.influencerCompletedCampaignsHistory(args.influencerId);
    }

    @Auth()
    @ApiOperation({ summary: 'Get influencer completed promo' })
    @ApiResponseDto(InfluencerGetPastPromoResDto)
    @Post('influencer-completed-promos/one-promo')
    @ApiBody({type: InfluencerGetPastPromoReqDto})
    influencerPastCampaignOne(@Body() data: InfluencerGetPastPromoReqDto): Promise<InfluencerGetPastPromoResDto> {
        return this.promosService.influencerPastPromoOne(data);
    }

    @Auth()
    @ApiOperation({ summary: 'Get client campaign' })
    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'clientId', required: true})
    @Get('client-campaign/one')
    clientGetOngoingOrPastCampaign(@Query() args: { campaignId: string; clientId: string }) {
        const decryptedCampaignId = decodeAndDecrypt(
            args.campaignId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        const decryptedClientId = decodeAndDecrypt(
            args.clientId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        return this.promosService.clientGetOngoingOrPastCampaign(
            decryptedCampaignId,
            decryptedClientId,
        );
    }

    @Auth()
    @ApiOperation({ summary: 'Get influencer new promos requests' })
    @ApiQuery({name: 'influencerId', required: true})
    @Get('influencer-get-new-campaigns')
    influencerGetNewCampaigns(@Query() args: { influencerId: string }) {
        const decryptedInfluencerId = decodeAndDecrypt(
            args.influencerId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );

        return this.promosService.influencerGetNewCampaigns(decryptedInfluencerId);
    }

    @Auth()
    @ApiOperation({ summary: 'Get influencer new promos requests' })
    @ApiQuery({name: 'influencerId', required: true})
    @ApiQuery({name: 'socialMediaUsername', required: true})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'campaignResponse', required: true})
    @ApiQuery({name: 'selectInfluencersId', required: true})
    @Put('influencer-update-response-new-campaign')
    influencerUpdateResponseNewCampaign(
        @Query()
        args: {
            influencerId: string;
            socialMediaUsername: string;
            campaignId: string;
            campaignResponse: string;
            selectInfluencersId: string;
        },
    ) {
        const decryptedInfluencerId = decodeAndDecrypt(
            args.influencerId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        const decryptedCampaignId = decodeAndDecrypt(
            args.campaignId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        const decryptedSocialMediaUsername = decodeAndDecrypt(
            args.socialMediaUsername,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );

        return this.promosService.influencerUpdateResponseNewCampaign(
            decryptedInfluencerId,
            decryptedSocialMediaUsername,
            decryptedCampaignId,
            args.campaignResponse,
            args.selectInfluencersId,
        );
    }

    @ApiQuery({name: 'influencerId', required: true})
    @Get('influencer-get-ongoing-campaigns')
    influencerGetOngoingCampaigns(@Query() args: { influencerId: string }) {
        return this.promosService.influencerGetOngoingCampaigns(args.influencerId);
    }

    @ApiQuery({name: 'influencerId', required: true})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'selectInfluencersId', required: true})
    @Get('influencer-get-ongoing-campaign/one')
    influencerGetOngoingCampaign(
        @Query()
        args: {
            influencerId: string;
            campaignId: string;
            selectInfluencersId: string;
        },
    ) {
        const decryptedInfluencerId = decodeAndDecrypt(
            args.influencerId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        const decryptedCampaignId = decodeAndDecrypt(
            args.campaignId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        const decryptedSelectInfluencersId = decodeAndDecrypt(
            args.selectInfluencersId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );

        return this.promosService.influencerGetOngoingCampaign(
            decryptedInfluencerId,
            decryptedCampaignId,
            decryptedSelectInfluencersId,
        );
    }

    @ApiQuery({name: 'influencerId', required: true})
    @ApiQuery({name: 'socialNetworkUsername', required: true})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'selectInfluencersId', required: true})
    @Put('influencer-update-ongoing')
    influencerUpdateOngoingCampaign(
        @Query()
        args: {
            influencerId: string;
            socialNetworkUsername: string;
            campaignId: string;
            selectInfluencersId: string;
        },
        @Body() body,
    ) {
        const decryptedInfluencerId = decodeAndDecrypt(
            args.influencerId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        const decryptedCampaignId = decodeAndDecrypt(
            args.campaignId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        const decryptedSelectInfluencersId = decodeAndDecrypt(
            args.selectInfluencersId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );

        return this.promosService.influencerUpdateOngoingCampaign(
            decryptedInfluencerId,
            args.socialNetworkUsername,
            decryptedCampaignId,
            decryptedSelectInfluencersId,
            body,
        );
    }

    @Get('share-link/:campaignId')
    getCampaignByPublicShareLink(@Param() args: { campaignId: string }) {
        return this.promosService.getCampaignByPublicShareLink(args.campaignId);
    }

    @Post('send-new-full-serviced-campaign-request')
    sendNewFullServicedCampaignRequest(@Body() data: SendNewFullServicedCampaignRequest) {
        return this.promosService.sendNewFullServicedCampaignRequest(data);
    }

    @Post('get-selected-social-accounts')
    getSelectedSocialMediaAccountsForCampaignStrategy(@Body() data: GetSelectedSocialAccountsDto) {
        return this.promosService.getSelectedSocialMediaAccountsForCampaignStrategy(data);
    }

    @Post('save-xlsx-campaign/:typeOfStorage')
    saveXLSXCampaign(@Param() args: { typeOfStorage: string }, @Body() data: SaveXlsxPromoDto) {
        return this.promosService.saveXLSXCampaign(args.typeOfStorage, data);
    }

    @Get('client/get-proposal-promos/:clientId')
    getClientProposalPromos(@Param('clientId') clientId: string) {
        const decryptedClientId = decodeAndDecrypt(
            clientId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );

        return this.promosService.getClientProposalPromos(decryptedClientId);
    }
}
