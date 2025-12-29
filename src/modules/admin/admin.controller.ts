import {
    Controller,
    Get,
    Post,
    Body,
    Put,
    Param,
    Delete,
    ParseBoolPipe,
    UsePipes,
    ValidationPipe,
    Patch,
} from '@nestjs/common';
import {AdminService} from './admin.service';
import {AdminUpdatePersonalClientDto} from './dto/admin-update-client.dto';
import {AdminUpdateInfluencerPersonalDto} from './dto/admin-update-influencer-personal.dto';
import {AdminUpdateInfluencerInstagramDto} from './dto/admin-update-influencer-instagram.dto';
import {AdminUpdateInfluencerInvoiceDto} from './dto/admin-update-influencer-invoice.dto';
import {AdminUpdateClientPayment} from './dto/admin-update-client-payment.update';
import {AdminUpdateCampaignDto} from './dto/admin-update-promo.dto';
import {AdminSendWhatsappMessageDto} from './dto/admin-send-whatsapp-message.dto';
import {AdminUpdateInfluencerFullAccountDto} from './dto/admin-update-influencer-full-account.dto';
import {AdminUpdateFullCampaignDto} from './dto/admin-update-full-campaign';
import {AdminSendMailToInfluencerDto} from './dto/admin-send-mail-to-influencer.dto';
import {AdminImportXlsxInfluencersDto} from './dto/admin-import-xlsx-influencers';
import {decodeAndDecrypt} from "../../common/utils/crypt";
import {ApiTags} from "@nestjs/swagger";
import {AddSocialMediasDto} from "../profile/dto/update-influencer.dto";

@ApiTags('admin')
@Controller('admin')
export class AdminController {
    constructor(private readonly adminService: AdminService) {
    }

    @Get('client/getAll')
    adminGetAllClients() {
        return this.adminService.adminGetClients();
    }

    @Put('client/update/client-proposal-status/:clientId/:newStatus')
    async adminUpdateClientProposalStatus(
        @Param('clientId') clientId: string,
        @Param('newStatus', ParseBoolPipe) newStatus: boolean,
    ) {
        return this.adminService.adminUpdateClientProposalStatus(clientId, newStatus);
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
    adminGetOneInfluencerInstaAccount(
        @Param('id') id: string,
        @Param('socialMedia') socialMedia: string,
        @Param('instagramUsername') instagramUsername: string,
    ) {
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
    adminCloseCampaignForInfluencer(
        @Param('campaignId') campaignId: string,
        @Param('selectInfluencersAccountId') selectInfluencersAccountId: string,
    ) {
        const decryptedCampaignId = decodeAndDecrypt(
            campaignId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        const decryptedSelectInfluencersAccountId = decodeAndDecrypt(
            selectInfluencersAccountId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );

        return this.adminService.adminCloseCampaignForInfluencer(
            decryptedCampaignId,
            decryptedSelectInfluencersAccountId,
        );
    }

    @Get('campaigns/getOne/:campaignId/:isProposalCampaign?')
    adminGetOneCampaign(
        @Param('campaignId') campaignId: string,
        @Param('isProposalCampaign') isProposalCampaign?: string,
    ) {
        const decryptedCampaignId = decodeAndDecrypt(
            campaignId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );

        const isProposal = isProposalCampaign ? isProposalCampaign.toLowerCase() === 'true' : false;
        return this.adminService.adminGetOneCampaign(decryptedCampaignId, isProposal);
    }

    @Put('campaign/update-from-campaigns-page')
    adminUpdateCampaignUpdateFromCampaignsPage(@Body() data: AdminUpdateCampaignDto) {
        return this.adminService.adminUpdateCampaignUpdateFromCampaignsPage(data);
    }

    @Put('campaign/update')
    adminUpdateCampaign(@Body() data: AdminUpdateFullCampaignDto) {
        return this.adminService.adminUpdateCampaign(data);
    }

    @Post('promos/send-public-link/:userId/:publicLink')
    adminSendCampaignPublicLinkToClient(
        @Param('userId') userId: string,
        @Param('publicLink') publicLink: string,
    ) {
        const decryptedPublicLink = decodeAndDecrypt(
            publicLink,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        return this.adminService.adminSendCampaignPublicLinkToClient(userId, decryptedPublicLink);
    }

    @Post('send-invoice-client')
    adminSendNewInvoiceToClient(@Body() data: any) {
        return this.adminService.adminSendNewInvoiceToClient(data);
    }

    @Put('promos/update/add-influencer-to-temp-list/:campaignId/:socialMediaUsername/:socialMedia')
    adminAddInfluencerToTempList(
        @Param('campaignId') campaignId: string,
        @Param('socialMediaUsername') socialMediaUsername: string,
        @Param('socialMedia') socialMedia: string,
    ) {
        return this.adminService.adminAddInfluencerToTempList(
            campaignId,
            socialMediaUsername,
            socialMedia,
        );
    }

    @Post('campaign/send-whats-app-message-to-influencer')
    adminSendWhatsAppMessageToInfluencer(@Body() data: AdminSendWhatsappMessageDto) {
        return this.adminService.adminSendWhatsAppMessageToInfluencer(data);
    }

    @Post('campaign/send-whats-app-message-to-each-influencer/:campaignId')
    adminSendWhatsAppMessageToEachInfluencer(
        @Param('campaignId') campaignId: string,
        @Body('socketId') socketId: string,
    ) {
        return this.adminService.adminSendWhatsAppMessageToEachInfluencer(campaignId, socketId);
    }

    @Put('campaign/convert-to-multipromo/:campaignId')
    adminConvertCampaignToMultipromo(@Param('campaignId') campaignId: string) {
        return this.adminService.adminConvertCampaignToMultipromo(campaignId);
    }

    @Post('campaign/send-mail-to-influencer')
    adminSendMailToInfluencer(@Body() data: AdminSendMailToInfluencerDto) {
        return this.adminService.adminSendMailToInfluencer(data);
    }

    @Put('promos/give-partial-refund/:userId/:partialRefund/:campaignId')
    adminGivePartialRefundToClient(
        @Param('userId') userId: string,
        @Param('partialRefund') partialRefund: number,
        @Param('campaignId') campaignId: string,
    ) {
        return this.adminService.adminGivePartialRefundToClient(userId, partialRefund, campaignId);
    }

    @Post('promos/close-campaign/:campaignId')
    adminClosePromo(@Param('campaignId') campaignId: string) {
        const decryptedCampaignId = decodeAndDecrypt(
            campaignId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        return this.adminService.adminClosePromo(decryptedCampaignId);
    }

    @Post('campaign/reopen-campaign/:campaignId')
    adminReopenPromo(@Param('campaignId') campaignId: string) {
        const decryptedCampaignId = decodeAndDecrypt(
            campaignId,
            process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
        );
        return this.adminService.adminReopenCampaign(decryptedCampaignId);
    }

    @Put('influencer/hide-instagram/:influencerId/:instagramUsername')
    adminHideInstagramAccount(
        @Param('influencerId') influencerId: string,
        @Param('instagramUsername') instagramUsername: string,
    ) {
        return this.adminService.adminHideInstagramAccount(influencerId, instagramUsername);
    }

    @Get('edit-influencer/getInfluencerAccount/:influencerId')
    adminGetInfluencerAccount(@Param('influencerId') influencerId: string) {
        return this.adminService.adminGetInfluencerAccount(influencerId);
    }

    @Put('edit-influencer/updateInfluencerAccount')
    adminUpdateInfluencerAccount(@Body() data: AdminUpdateInfluencerFullAccountDto) {
        return this.adminService.adminUpdateInfluencerAccount(data);
    }

    @Put('edit-influencer/add-new-brands')
    adminAddNewBrandsToInfluencerAccount(@Body() data: AddSocialMediasDto) {
        return this.adminService.adminAddNewBrandsToInfluencerAccount(data);
    }

    // @Put('influencer/import-xlsx')
    // @UsePipes(new ValidationPipe({transform: true}))
    // adminImportXlsxInfluencers(@Body() data: AdminImportXlsxInfluencersDto) {
        // return this.adminService.adminImportXlsxInfluencers(data);
    // }

    @Patch('campaigns/update-to-date')
    adminUpdateCampaignsUpToDate() {
        return this.adminService.adminUpdateCampaignsUpToDate();
    }

    @Patch('campaigns/proposal/update-to-date')
    adminUpdateProposalCampaignsUpToDate() {
        return this.adminService.adminUpdateProposalCampaignsUpToDate();
    }

    @Patch('check-id-each-account')
    adminCheckIdEachAccount() {
        return this.adminService.checkIdInEachAccount()
    }
}
