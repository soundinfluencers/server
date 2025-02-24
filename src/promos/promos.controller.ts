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
    Res,
} from '@nestjs/common';
import {PromosService} from './promos.service';
import {CreatePromosDto} from './dto/create-promo.dto';
import {CreatePromosEstimateDto} from "./dto/create-promo-estimate.dto";
import {ApiQuery} from '@nestjs/swagger';
import {FileInterceptor} from '@nestjs/platform-express';
import File from 'multer';
import {GetSelectedSocialAccountsDto} from "./dto/get-selected-social-accounts.dto";
import {decodeAndDecrypt} from "../utils/crypt";

@Controller('promos')
export class PromosController {
    constructor(private readonly promosService: PromosService) {
    }

    @Post('client-create-campaign')
    createPromos(@Body() data: CreatePromosDto) {
        return this.promosService.createPromo(data);
    }

    @Post('estimate/:isPO')
    createPromosForEstimate(@Body() data: CreatePromosEstimateDto, @Param('isPO') isPO: boolean) {
        return this.promosService.createPromosForEstimate(data, isPO);
    }

    @ApiQuery({name: 'promoId', required: true})
    @ApiQuery({name: 'isPoNeed', required: true})
    @Put('update-estimate')
    async updateEstimatePromo(
        @Query('promoId') promoId: string,
        @Query('isPoNeed') isPoNeed: string
    ) {
        return this.promosService.updateEstimatePromo(promoId, isPoNeed);
    }

    @ApiQuery({name: 'promoId', required: true})
    @ApiQuery({name: 'status', required: true})
    @Get('verify-promo')
    verifyCampaign(@Query() args: { promoId: string; status: string }) {
        return this.promosService.verifyCampaign(args.promoId, args.status);
    }

    @Get('offers/:socialMedia')
    getOffers(@Param('socialMedia') socialMedia: string) {
        return this.promosService.getOffers(socialMedia);
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

    @ApiQuery({name: 'clientId', required: true})
    @Get('ongoing-campaigns-client')
    clientGetOngoingCampaigns(@Query() args: { clientId: string }) {
        const decryptedClientId = decodeAndDecrypt(args.clientId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        return this.promosService.clientGetOngoingCampaigns(decryptedClientId);
    }

    @ApiQuery({name: 'influencerId', required: true})
    @Get('influencer-completed-campaigns/history')
    influencerCompletedCampaignsHistory(@Query() args: { influencerId: string }) {
        return this.promosService.influencerCompletedCampaignsHistory(args.influencerId);
    }

    @ApiQuery({name: 'influencerId', required: true})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'socialMediaUsername', required: true})
    @ApiQuery({name: 'selectedCampaignContentItem', required: true})
    @Get('influencer-completed-campaigns/one-campaign')
    influencerPastCampaignOne(@Query() args: {
        influencerId: string;
        campaignId: string;
        socialMediaUsername: string;
        selectedCampaignContentItem: string
    }) {
        const decryptedInfluencerId = decodeAndDecrypt(args.influencerId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        const decryptedCampaignId = decodeAndDecrypt(args.campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        const decodedSocialMediaUsername = decodeURI(args.socialMediaUsername);
        const decryptedSelectedCampaignContentItem = decodeAndDecrypt(args.selectedCampaignContentItem, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        
        return this.promosService.influencerPastCampaignOne(decryptedInfluencerId, decryptedCampaignId, decodedSocialMediaUsername, decryptedSelectedCampaignContentItem);
    }

    @ApiQuery({name: 'clientId', required: true})
    @ApiQuery({name: 'campaignId', required: true})
    @Get('client-completed-campaigns/one-campaign')
    clientPastCampaignOne(@Query() args: { clientId: string; campaignId: string }) {
        const decryptedClientId = decodeAndDecrypt(args.clientId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        const decryptedCampaignId = decodeAndDecrypt(args.campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        return this.promosService.clientPastCampaignOne(decryptedClientId, decryptedCampaignId);
    }

    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'clientId', required: true})
    @Get('client-campaign/one')
    clientGetOngoingOrPastCampaign(@Query() args: { campaignId: string; clientId: string }) {
        const decryptedCampaignId = decodeAndDecrypt(args.campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        const decryptedClientId = decodeAndDecrypt(args.clientId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        return this.promosService.clientGetOngoingOrPastCampaign(decryptedCampaignId, decryptedClientId);
    }

    @ApiQuery({name: 'influencerId', required: true})
    @Get('influencer-get-new-campaigns')
    influencerGetNewCampaigns(@Query() args: { influencerId: string }) {
        const decryptedInfluencerId = decodeAndDecrypt(args.influencerId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);

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
        const decryptedInfluencerId = decodeAndDecrypt(args.influencerId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        const decryptedCampaignId = decodeAndDecrypt(args.campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        const decryptedSocialMediaUsername = decodeAndDecrypt(args.socialMediaUsername, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);

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
    @ApiQuery({name: 'socialNetworkUsername', required: true})
    @ApiQuery({name: 'selectInfluencersId', required: true})
    @Get('influencer-get-ongoing-campaign/one')
    influencerGetOngoingCampaign(
        @Query()
            args: {
            influencerId: string;
            campaignId: string;
            socialNetworkUsername: string;
            selectInfluencersId: string;
        },
    ) {
        const decryptedInfluencerId = decodeAndDecrypt(args.influencerId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        const decryptedCampaignId = decodeAndDecrypt(args.campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);

        return this.promosService.influencerGetOngoingCampaign(
            decryptedInfluencerId,
            decryptedCampaignId,
            args.socialNetworkUsername,
            args.selectInfluencersId,
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
        const decryptedInfluencerId = decodeAndDecrypt(args.influencerId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        const decryptedCampaignId = decodeAndDecrypt(args.campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);

        return this.promosService.influencerUpdateOngoingCampaign(
            decryptedInfluencerId,
            args.socialNetworkUsername,
            decryptedCampaignId,
            args.selectInfluencersId,
            body,
        );
    }

    @Get('share-link/:campaignId/:socialMedia')
    getCampaignByPublicShareLink(@Param() args: { campaignId: string; socialMedia: string }) {
        return this.promosService.getCampaignByPublicShareLink(args.campaignId, args.socialMedia);
    }

    @Post('migrate-promos')
    migrateClosedPromosToPromosCopies() {
        return this.promosService.migrateClosedPromosToPromosCopies();
    }

    @Post('get-selected-social-accounts')
    getSelectedSocialMediaAccountsForCampaignStrategy(@Body() data: GetSelectedSocialAccountsDto) {
        return this.promosService.getSelectedSocialMediaAccountsForCampaignStrategy(data);
    }
    
    @Put('add-ids-to-content-items')
    addIdsToContentItems() {
        return this.promosService.addIdsToContentItems();
    }
}