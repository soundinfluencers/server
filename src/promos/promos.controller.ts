import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Put,
    Param,
    Delete,
    Query,
    UseInterceptors,
    UploadedFile,
    Res, UseGuards, Req,
} from '@nestjs/common';
import {PromosService} from './promos.service';
import {CreatePromosDto} from './dto/create-promo.dto';
import {CreatePromosEstimateDto} from './dto/create-promo-estimate.dto';
import {ApiBody, ApiQuery} from '@nestjs/swagger';
import {FileInterceptor} from '@nestjs/platform-express';
import File from 'multer';
import {GetSelectedSocialAccountsDto} from './dto/get-selected-social-accounts.dto';
import {decodeAndDecrypt} from '../utils/crypt';
import {SendNewFullServicedCampaignRequest} from './dto/send-new-full-serviced-campaign-request';
import {SaveXlsxPromoDto} from './dto/save-xlsx-promo.dto';
import {Response} from 'express';
import {OneCampaignQueryDto} from "./dto/influencer-get-past-campaign";
import {JwtAuthGuard} from "../auth/jwt-auth.guard";
import {AuthenticatedRequest} from "../types/auth.types";
import {ClientGetCampaignsListDto} from "./dto/client-get-campaigns-list.dto";

@Controller('promos')
export class PromosController {
    constructor(private readonly promosService: PromosService) {
    }

    @UseGuards(JwtAuthGuard)
    @Get('client/get/list')
    clientGetCampaignsList(@Req() request: AuthenticatedRequest): Promise<ClientGetCampaignsListDto> {
        const userId = request.user.id;
        return this.promosService.clientGetCampaignsList(userId);
    }

    @Post('client-create-campaign')
    createPromos(@Body() data: CreatePromosDto) {
        return this.promosService.createPromo(data);
    }

    @Post('estimate/:isPO')
    createPromosForEstimate(@Body() data: CreatePromosEstimateDto, @Param('isPO') isPO: boolean) {
        return this.promosService.createPromosForEstimate();
    }

    @ApiQuery({name: 'promoId', required: true})
    @ApiQuery({name: 'isPoNeed', required: true})
    @Put('update-estimate')
    async updateEstimatePromo(
        @Query('promoId') promoId: string,
        @Query('isPoNeed') isPoNeed: string,
    ) {
        return this.promosService.updateEstimatePromo(promoId, isPoNeed);
    }

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

    @Post('uploadScreenshot')
    @UseInterceptors(FileInterceptor('file'))
    uploadFile(@UploadedFile() file: File) {
        return this.promosService.uploadDropBox(file);
    }

    @Get('check-upload-status')
    async checkUploadStatus(@Query('fileName') fileName: string): Promise<boolean> {
        return await this.promosService.checkUploadStatus(fileName);
    }

    @ApiQuery({name: 'id', required: true})
    @Get('client-completed-campaigns/history')
    clientCompletedCampaignsHistory(@Query() args: { id: string }) {
        return this.promosService.clientCompletedCampaignsHistory(args.id);
    }

    @ApiQuery({name: 'influencerId', required: true})
    @Get('influencer-completed-campaigns/history')
    influencerCompletedCampaignsHistory(@Query() args: { influencerId: string }) {
        return this.promosService.influencerCompletedCampaignsHistory(args.influencerId);
    }

    @Post('influencer-completed-campaigns/one-campaign')
    @ApiBody({type: OneCampaignQueryDto})
    influencerPastCampaignOne(@Body() args: OneCampaignQueryDto) {
        const decryptedCampaignId = decodeAndDecrypt(
            args.campaignId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        const decryptedInfluencerId = decodeAndDecrypt(
            args.influencerId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        const decryptedSelectInfluencersId = decodeAndDecrypt(
            args.selectInfluencersId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );

        return this.promosService.influencerPastCampaignOne(
            decryptedCampaignId,
            decryptedInfluencerId,
            decryptedSelectInfluencersId
        );
    }

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

    @ApiQuery({name: 'influencerId', required: true})
    @Get('influencer-get-new-campaigns')
    influencerGetNewCampaigns(@Query() args: { influencerId: string }) {
        const decryptedInfluencerId = decodeAndDecrypt(
            args.influencerId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );

        return this.promosService.influencerGetNewCampaigns(decryptedInfluencerId);
    }

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
