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
import {AdminService} from "./admin.service";
import {AdminUpdatePersonalClientDto} from "./dto/admin-update-client.dto";
import {AdminUpdateInfluencerPersonalDto} from "./dto/admin-update-influencer-personal.dto";
import {AdminUpdateInfluencerInstagramDto} from "./dto/admin-update-influencer-instagram.dto";
import {AdminUpdateInfluencerInvoiceDto} from "./dto/admin-update-influencer-invoice.dto";
import {AdminUpdateClientPayment} from "./dto/admin-update-client-payment.update";
import {AdminUpdateCampaignDto} from "./dto/admin-update-promo.dto";
import {AdminUpdateCampaignVideoDto} from "./dto/admin-update-promo-video.dto";
import {AdminUpdateCampaignInfluencersDto} from "./dto/admin-update-promo-influencers.dto";
import {AdminAddInfluencerToCampaignDto} from "./dto/admin-add-influencer-to-campaign.dto";
import {AdminSendEmailToInfluencerDto} from "./dto/admin-send-email-to-influencer.dto";
import {AdminSaveOffersToTempDto} from "./dto/admin-save-offer-to-temp.dto";
import {AdminPutOfferToOffersDto} from "./dto/admin-put-offer-to-offers.dto";
import {AdminUpdateInfluencerFullAccountDto} from "./dto/admin-update-influencer-full-account.dto";
import {decodeAndDecrypt} from "../utils/crypt";

@Controller('admin')
export class AdminController {
    constructor(private readonly adminService: AdminService) {
    }

    @Get('client/getAll')
    adminGetAllClients() {
        return this.adminService.adminGetClients();
    }
    
    @Put('client/update')
    adminUpdateClient(@Body() data: AdminUpdatePersonalClientDto) {
        return this.adminService.adminUpdateClient(data);
    }
    
    @Get('influencer/getAll/:socialMedia')
    adminGetAllInfluencerInstaAccounts(@Param('socialMedia') socialMedia: string) {
        return this.adminService.adminGetAllInfluencerInstaAccounts(socialMedia);
    }
    
    @Put('influencer/update/personal')
    adminUpdateInfluencerPersonal(@Body() data: AdminUpdateInfluencerPersonalDto) {
        return this.adminService.adminUpdatePersonalInfluencer(data);
    }
    
    @Put('influencer/update/socialMediaAccount')
    adminUpdateInfluencerInstagram(@Body() data: AdminUpdateInfluencerInstagramDto) {
        return this.adminService.adminUpdateInfluencerSocialMediaAccount(data);
    }
    
    @Get('influencer/getOne/:id/:socialMedia/:instagramUsername')
    adminGetOneInfluencerInstaAccount(@Param('id') id: string, @Param('socialMedia') socialMedia: string, @Param('instagramUsername') instagramUsername: string) {
        return this.adminService.adminGetOneInfluencerInstaAccount(id, socialMedia, instagramUsername);
    }
    
    @Get('invoices-influencers/getAll')
    adminGetAllInvoices() {
        return this.adminService.adminGetAllInvoices();
    }
    
    @Put('invoices-influencers/update')
    adminUpdateInfluencerInvoice(@Body() data: AdminUpdateInfluencerInvoiceDto) {
        return this.adminService.adminUpdateInfluencerInvoice(data);
    }
    
    @Get('invoices-influencers/getOne/:id')
    adminGetOneInfluencerInvoice(@Param('id') id: string) {
        return this.adminService.adminGetOneInfluencerInvoice(id);
    }
    
    @Get('invoices-clients/getAll')
    adminGetAllClientInvoices() {
        return this.adminService.adminGetAllClientsPayments();
    }
    
    @Put('invoices-clients/update')
    adminUpdateClientInvoice(@Body() data: AdminUpdateClientPayment) {
        return this.adminService.adminUpdateClientPayment(data);
    }
    
    @Get('invoices-clients/getOne/:id')
    adminGetOneClientInvoice(@Param('id') id: string) {
        return this.adminService.adminGetOneClientPayment(id);
    }
    
    @Get('campaigns/getAll')
    adminGetAllCampaigns() {
        return this.adminService.adminGetAllCampaigns();
    }
    
    @Delete('promos/delete/:id')
    adminDeletePromo(@Param('id') id: string) {
        return this.adminService.adminDeletePromo(id);
    }
    
    @Put('promos/close-for-influencer/:campaignId/:selectInfluencersAccountId')
    adminCloseCampaignForInfluencer(@Param('campaignId') campaignId: string, @Param('selectInfluencersAccountId') selectInfluencersAccountId: string) {
        const decryptedCampaignId = decodeAndDecrypt(campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        const decryptedSelectInfluencersAccountId = decodeAndDecrypt(selectInfluencersAccountId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        
        return this.adminService.adminCloseCampaignForInfluencer(decryptedCampaignId, decryptedSelectInfluencersAccountId);
    }
    
    @Get('campaigns/getOne/:campaignId')
    adminGetOneCampaign(@Param('campaignId') campaignId: string) {
        const decryptedCampaignId = decodeAndDecrypt(campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        return this.adminService.adminGetOneCampaign(decryptedCampaignId);
    }
    
    @Put('promos/update')
    adminUpdateCampaign(@Body() data: AdminUpdateCampaignDto) {
        return this.adminService.adminUpdateCampaign(data);
    }
    
    @Post('promos/send-public-link/:userId/:publicLink')
    adminSendCampaignPublicLinkToClient(@Param('userId') userId: string, @Param('publicLink') publicLink: string) {
        const decryptedPublicLink = decodeAndDecrypt(publicLink, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        return this.adminService.adminSendCampaignPublicLinkToClient(userId, decryptedPublicLink);
    }
    
    @Post('send-invoice-client')
    adminSendNewInvoiceToClient(@Body() data: any) {
        return this.adminService.adminSendNewInvoiceToClient(data);
    }
    
    @Put('promos/update/campaignContentItem')
    adminUpdateCampaignVideo(@Body() data: AdminUpdateCampaignVideoDto) {
        return this.adminService.adminUpdateCampaignVideo(data);
    }
    
    @Put('promos/update/influencers-list')
    adminUpdateInfluencersListCampaign(@Body() data: AdminUpdateCampaignInfluencersDto) {
        return this.adminService.adminUpdateInfluencersListCampaign(data);
    }
    
    @Put('promos/update/remove-influencer/:campaignId/:selectInfluencersAccountId')
    adminRemoveInfluencerFromCampaign(@Param('campaignId') campaignId: string, @Param('selectInfluencersAccountId') selectInfluencersAccountId: string) {
        const decryptedCampaignId = decodeAndDecrypt(campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        const decryptedSelectInfluencersAccountId = decodeAndDecrypt(selectInfluencersAccountId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        return this.adminService.adminRemoveInfluencerFromCampaign(decryptedCampaignId, decryptedSelectInfluencersAccountId);
    }
    
    @Put('promos/update/add-influencer-to-campaign')
    adminAddInfluencerToCampaign(@Body() data: AdminAddInfluencerToCampaignDto) {
        return this.adminService.adminAddInfluencerToCampaign(data);
    }

    @Put('promos/update/add-influencer-to-temp-list/:campaignId/:socialMediaUsername')
    adminAddInfluencerToTempList(@Param('campaignId') campaignId: string, @Param('socialMediaUsername') socialMediaUsername: string) {
        return this.adminService.adminAddInfluencerToTempList(campaignId, socialMediaUsername);
    }
    
    @Post('promos/send-mail-influencer')
    adminSendEmailToInfluencer(@Body() data: AdminSendEmailToInfluencerDto) {
        return this.adminService.adminSendEmailToInfluencer(data);
    }
    
    @Put('promos/give-partial-refund/:userId/:partialRefund/:campaignId')
    adminGivePartialRefundToClient(@Param('userId') userId: string, @Param('partialRefund') partialRefund: number, @Param('campaignId') campaignId: string) {
        return this.adminService.adminGivePartialRefundToClient(userId, partialRefund, campaignId);
    }
    
    @Post('promos/close-campaign/:campaignId')
    adminClosePromo(@Param('campaignId') campaignId: string) {
        const decryptedCampaignId = decodeAndDecrypt(campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        return this.adminService.adminClosePromo(decryptedCampaignId);
    }
    
    @Get('offers/getAll')
    adminGetAllOffers() {
        return this.adminService.adminGetAllOffers();
    }
    
    @Put('offers/delete-and-save-to-temp')
    adminDeleteOfferAndSaveToTemp(@Body() data: AdminSaveOffersToTempDto) {
        return this.adminService.adminDeleteOfferAndSaveToTemp(data);
    }
    
    @Put('offers/save-to-temp')
    adminSaveOffersToTemp(@Body() data: AdminSaveOffersToTempDto) {
        return this.adminService.adminSaveOffersToTemp(data);
    }
    
    @Put('offers/delete-from-temp/:offerId')
    adminDeleteOffer(@Param('offerId') offerId: string) {
        return this.adminService.adminDeleteOffer(offerId);
    }
    
    @Put('offers/return-from-deleted')
    adminReturnOfferFromDeleted(@Body() data: AdminPutOfferToOffersDto) {
        return this.adminService.adminReturnOfferFromDeleted(data);
    }
    
    @Put('offers/publish')
    adminPublishOffers() {
        return this.adminService.adminPublishOffers();
    }
    
    @Put('offers/update')
    adminUpdateOldOffer(@Body() data: AdminSaveOffersToTempDto) {
        return this.adminService.adminUpdateOldOffer(data);
    }
    
    @Put('influencer/hide-instagram/:influencerId/:instagramUsername')
    adminHideInstagramAccount(@Param('influencerId') influencerId: string, @Param('instagramUsername') instagramUsername: string) {
        return this.adminService.adminHideInstagramAccount(influencerId, instagramUsername);
    }
    
    @Put('promos/update/hideCpmAndResultForCampaign/:campaignId')
    hideCpmAndResultForCampaign(@Param('campaignId') campaignId: string) {
        const decryptedCampaignId = decodeAndDecrypt(campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        return this.adminService.hideCpmAndResultForCampaign(decryptedCampaignId);
    }

    @Put('promos/update/hide-price-for-campaign/:campaignId')
    hidePriceForCampaign(@Param('campaignId') campaignId: string) {
        const decryptedCampaignId = decodeAndDecrypt(campaignId, process.env.SERVER_API_ENCRYPTION_SECRET_KEY);
        return this.adminService.hidePriceForCampaign(decryptedCampaignId);
    }
    
    @Get('edit-influencer/getInfluencerAccount/:influencerId')
    adminGetInfluencerAccount(@Param('influencerId') influencerId: string) {
        return this.adminService.adminGetInfluencerAccount(influencerId);
    }
    
    @Put('edit-influencer/updateInfluencerAccount')
    adminUpdateInfluencerAccount(@Body() data: AdminUpdateInfluencerFullAccountDto) {
        return this.adminService.adminUpdateInfluencerAccount(data);
    }
    
    @Put('promos/update/give-id-influencers-campaign-contents')
    adminGiveIdsToSelectInfluencersAndVideos() {
        return this.adminService.adminGiveIdsToSelectInfluencersAndVideos();
    }
}