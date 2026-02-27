import {
    BadRequestException,
    Body,
    Controller,
    Delete, ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    Res,
    UnauthorizedException
} from '@nestjs/common';
import {ProfileService} from './profile.service';
import {ClientUpdatedPersonalDetailsDto, UpdateClientPersonalDetailsDto} from './dto/client/update-client.dto';
import {UpdateUserPasswordDto} from './dto/update-password.dto';
import {
    AddSocialAccountDto,
    DeleteSocialAccountDto,
    InfluencerUpdatedPersonalDetailsDto,
    UpdateInfluencerPersonalDetailsDto,
    UpdateSocialMediaAccountDto
} from './dto/influencer/update-influencer.dto';
import {ApiExcludeEndpoint, ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {AuthenticatedRequest, NotificationMethodsEnum, Role} from "../../common/types/user.types";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {
    AgreementAccountsListDto,
    ClientAccountDetailsDto,
    FoundAccountsDto,
    GetSocialAccountDetailsParamsDto,
    InfluencerAccountDetailsDto,
    SocialAccountDetailsDto
} from "./dto/influencer/get-profile.dto";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {
    GetFilteredAccountsBodyDto,
    GetFilteredAccountsQueryDto,
    SearchSocialAccountsDto
} from "./dto/client/search-social-accounts.dto";
import {SocialAccountSortByEnum} from "../../common/types/influencer/influencer.types";
import {GetFilterOptionsDataDto} from "./dto/client/filter-options.dto";
import {InvoiceDetailsDto, UpdateInvoiceDetailsDto} from "./dto/invoice-details.dto";
import {PaymentDetailsDto, PaymentMethodRequestEnum, UpdatePaymentDetailsDto} from "./dto/payment-details.dto";
import {UserNotificationMethods} from "../../database/schemas/users/influencer.schema";
import {InfluencerConfirmationStatusEnum} from "../../common/types/influencer/promo.types";
import {GetMeResponseDto, LoginResponseDto} from "../auth/dto/login.dto";
import {Response} from "express";
import {Public} from "../../common/decorators/public.decorator";

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
    constructor(private readonly profileService: ProfileService) {
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @ApiOperation({summary: "Get client's account details"})
    @ApiResponseDto(ClientAccountDetailsDto)
    @Get('/client')
    getClientProfileDetails(@Req() req: AuthenticatedRequest): Promise<ClientAccountDetailsDto> {
        return this.profileService.getClientAccountDetails(req.user._id);
    }

    @Auth()
    @Roles(Role.influencer, Role.admin)
    @ApiOperation({summary: "Get influencer's account details"})
    @ApiResponseDto(InfluencerAccountDetailsDto)
    @Get('/influencer')
    getInfluencerProfileDetails(@Req() req: AuthenticatedRequest): Promise<InfluencerAccountDetailsDto> {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');

        return this.profileService.getInfluencerAccountDetails(req.user._id);
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({summary: "Updates client's personal details"})
    @ApiResponseDto(ClientUpdatedPersonalDetailsDto)
    @Patch('client/personal')
    updatePersonalClient(@Req() request: AuthenticatedRequest, @Body() data: UpdateClientPersonalDetailsDto): Promise<ClientUpdatedPersonalDetailsDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.profileService.updatePersonalClient({...data, _id: request.user._id});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: "Updates influencer's personal details"})
    @ApiResponseDto(InfluencerUpdatedPersonalDetailsDto)
    @Patch('influencer/personal')
    updatePersonalInfluencer(@Req() request: AuthenticatedRequest, @Body() data: UpdateInfluencerPersonalDetailsDto): Promise<InfluencerUpdatedPersonalDetailsDto> {
        return this.profileService.updatePersonalInfluencer({...data, influencerId: request.user._id});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: "Updates influencer's notification methods"})
    @ApiResponseDto(Boolean)
    @ApiParam({
        name: 'method',
        required: true,
        enum: NotificationMethodsEnum,
        type: String
    })
    @Patch('influencer/notification/:method')
    updateNotificationMethodsInfluencer(@Req() request: AuthenticatedRequest, @Param('method') method: NotificationMethodsEnum): Promise<UserNotificationMethods> {
        return this.profileService.updateNotificationMethodsInfluencer(method, request.user);
    }

    @Auth()
    @Roles(Role.client, Role.influencer)
    @ApiOperation({summary: "Returns user's invoice details"})
    @ApiResponseDto(InvoiceDetailsDto)
    @Get('/invoice-details')
    getInvoiceDetails(@Req() request: AuthenticatedRequest): Promise<InvoiceDetailsDto> {
        return this.profileService.getInvoiceDetails(request.user._id, request.user.role);
    }

    @Auth()
    @Roles(Role.client, Role.influencer)
    @ApiOperation({summary: "Updates user's invoice details"})
    @ApiResponseDto(InvoiceDetailsDto)
    @Patch('/invoice-details')
    updateInvoiceDetails(@Req() request: AuthenticatedRequest, @Body() data: UpdateInvoiceDetailsDto): Promise<InvoiceDetailsDto> {
        return this.profileService.updateInvoiceDetails({...data, userId: request.user._id, userRole: request.user.role});
    }

    @Auth()
    @Roles(Role.client, Role.influencer)
    @ApiOperation({summary: "Returns user's payment details"})
    @ApiResponseDto(PaymentDetailsDto)
    @ApiQuery({
        name: 'method',
        type: 'string',
        enum: PaymentMethodRequestEnum,
        required: false
    })
    @Get('/payment-details')
    getPaymentDetails(@Req() req: AuthenticatedRequest, @Query('method') paymentMethod = PaymentMethodRequestEnum.all): Promise<PaymentDetailsDto> {
        return this.profileService.getPaymentDetails(req.user, paymentMethod);
    }

    @Auth()
    @Roles(Role.client, Role.influencer)
    @ApiOperation({summary: "Updates user's payment details"})
    @ApiResponseDto(PaymentDetailsDto)
    @Patch('/payment-details')
    updatePaymentDetails(@Req() req: AuthenticatedRequest, @Body() data: UpdatePaymentDetailsDto): Promise<PaymentDetailsDto> {
        return this.profileService.updatePaymentDetailsOrchestrator(data, req.user);
    }

    @Auth()
    @Roles(Role.client, Role.influencer, Role.admin)
    @ApiOperation({summary: "Updates user's password"})
    @ApiResponseDto()
    @Patch('password')
    updatePasswordClient(@Req() request: AuthenticatedRequest, @Body() data: UpdateUserPasswordDto) {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.profileService.updateUserPassword({...data, _id: request.user._id, role: request.user.role});
    }

    @Public()
    @ApiOperation({summary: "Get influencer's social accounts that need agreement"})
    @ApiResponseDto(AgreementAccountsListDto)
    @ApiParam({
        name: 'influencerId',
        required: true,
        type: String,
    })
    @Get('agreement/:influencerId')
    getAgreementAccountsList(@Req() request: AuthenticatedRequest, @Param('influencerId') influencerId: string): Promise<AgreementAccountsListDto> {
        if (request.user && request.user._id !== influencerId) throw new ForbiddenException('Not enough access');

        return this.profileService.getAgreementAccountsList(
            request.user ? request.user._id : influencerId,
            request.user ? request.user.role : undefined
        );
    }

    @Public()
    @ApiOperation({summary: "Updates influencer's social accounts agreement meta field"})
    @ApiResponseDto(LoginResponseDto)
    @ApiParam({
        name: 'status',
        required: true,
        type: String,
        enum: InfluencerConfirmationStatusEnum,
    })
    @ApiParam({
        name: 'influencerId',
        required: true,
        type: String,
    })
    @Patch('agreement/:status/:influencerId')
    updateSocialAccountsAgreement(
        @Req() request: AuthenticatedRequest,
        @Param('status') status: InfluencerConfirmationStatusEnum,
        @Param('influencerId') influencerId: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<GetMeResponseDto> {
        if (!status || status === InfluencerConfirmationStatusEnum.wait) throw new BadRequestException('Invalid status value');
        if (request.user && request.user._id !== influencerId) throw new ForbiddenException('Not enough access');

        return this.profileService.updateSocialAccountsAgreement(
            request.user ? request.user._id : influencerId,
            status,
            res,
            request.user ? request.user.role : undefined
        );
    }

    @Auth()
    @Roles(Role.influencer, Role.admin)
    @ApiOperation({summary: "Gets detailed influencer's social account"})
    @ApiResponseDto(SocialAccountDetailsDto)
    @ApiParam({
        name: "accountId",
        required: true
    })
    @ApiParam({
        name: "socialMedia",
        enum: SocialMediaEnum,
        required: true
    })
    @Get('social-account/:accountId/:socialMedia')
    getDetailedSocialAccount(@Req() request: AuthenticatedRequest, @Param() params: GetSocialAccountDetailsParamsDto): Promise<SocialAccountDetailsDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.profileService.getDetailedSocialAccount({...params, influencerId: request.user._id});
    }

    @Auth()
    @Roles(Role.influencer, Role.admin)
    @ApiOperation({summary: "Updates influencer's social account"})
    @ApiResponseDto(SocialAccountDetailsDto)
    @Patch('social-account')
    updateSocialAccount(@Req() request: AuthenticatedRequest, @Body() data: UpdateSocialMediaAccountDto): Promise<SocialAccountDetailsDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.profileService.updateSocialAccount({...data, influencerId: request.user._id});
    }

    @Auth()
    @Roles(Role.influencer, Role.admin)
    @ApiOperation({summary: "Deletes influencer's social account"})
    @ApiResponseDto()
    @Delete('social-account')
    deleteSocialAccount(@Req() request: AuthenticatedRequest, @Body() data: DeleteSocialAccountDto) {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.profileService.deleteSocialAccount({...data, influencerId: request.user._id});
    }

    @Auth()
    @Roles(Role.influencer, Role.admin)
    @ApiOperation({summary: "Adds new social account and returns updated influencer"})
    @ApiResponseDto(InfluencerAccountDetailsDto, {successStatusCode: 201})
    @Post('social-account')
    async addSocialAccount(@Req() request: AuthenticatedRequest, @Body() data: AddSocialAccountDto): Promise<InfluencerAccountDetailsDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return await this.profileService.addSocialAccount({...data, influencerId: request.user._id});
    }

    @Public()
    @ApiExcludeEndpoint()
    @Get('influencer/verify-new-accounts')
    verifyNewSocialMediaAccounts(
        @Query() query: { influencerId: string; accounts: []; isVerified: string; newPrice?: string; },
    ) {
        const isVerified = query.isVerified === 'true';
        const newPrice =
            query.newPrice == null || query.newPrice.trim() === ''
                ? undefined
                : Number(query.newPrice);

        if (newPrice !== undefined && Number.isNaN(newPrice)) {
            throw new BadRequestException('Invalid newPrice');
        }

        return this.profileService.verifyNewSocialMediaAccounts(
            query.influencerId,
            query.accounts,
            isVerified,
            newPrice
        );
    }

    @Auth()
    @Roles(Role.client)
    @ApiResponseDto(GetFilterOptionsDataDto)
    @ApiOperation({summary: "Gets filters for getting social accounts"})
    @Get('filters')
    async getFilters(): Promise<GetFilterOptionsDataDto> {
        return this.profileService.getFilterOptions();
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({summary: "Gets filtered social accounts"})
    @ApiResponseDto(FoundAccountsDto, {successStatusCode: 200})
    @ApiQuery({
        name: "page",
        type: "number",
        required: true
    })
    @ApiQuery({
        name: "limit",
        type: "number",
        required: true
    })
    @ApiQuery({
        name: "sortBy",
        type: "string",
        enum: SocialAccountSortByEnum,
        required: true
    })
    @Post('social-account/filter')
    async findAccountsByFilter(@Query() query: GetFilteredAccountsQueryDto, @Body() filters: GetFilteredAccountsBodyDto): Promise<FoundAccountsDto> {
        const accounts = await this.profileService.findAccountsByFilter({
            ...filters,
            page: query.page,
            limit: query.limit,
            sortBy: query.sortBy
        });
        return ({accounts});
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @ApiOperation({summary: 'Searching social accounts by username match and social medias'})
    @Post('social-account/search')
    async searchSocialAccounts(@Body() dto: SearchSocialAccountsDto): Promise<FoundAccountsDto> {
        const accounts = await this.profileService.searchSocialAccounts(dto);
        return {accounts};
    }

    // // TODO: UPDATE
    // @Post('influencer/send-mail-price-change')
    // sendMailAboutChangingPrice(@Body() data: SendMailPriceChangeDto) {
    //     return this.profileService.sendMailAboutChangingPrice(data);
    // }
    //
    // // TODO: UPDATE
    // @ApiQuery({name: 'influencerId'})
    // @ApiQuery({name: 'socialMedia'})
    // @ApiQuery({name: 'networkUsername'})
    // @ApiQuery({name: 'isPriceGoodToGo'})
    // @ApiQuery({name: 'newPrice'})
    // @Get('influencer/verify-new-social-media-price')
    // changeSocialMediaPrice(
    //     @Query()
    //     query: {
    //         influencerId: string;
    //         socialMedia: string;
    //         networkUsername: string;
    //         isPriceGoodToGo: string;
    //         newPrice: string;
    //     },
    // ) {
    //     const isPriceGoodToGo = query.isPriceGoodToGo === 'true';
    //     return this.profileService.changeSocialMediaPrice(
    //         query.influencerId,
    //         query.socialMedia,
    //         query.networkUsername,
    //         isPriceGoodToGo,
    //         query.newPrice,
    //     );
    // }
    //
    // // TODO: update
    // @Auth()
    // @ApiOperation({summary: 'Get influencers by social media platform'})
    // @Get('influencers/:socialMedia')
    // getInfluencersWithSocialMedia(@Param('socialMedia') socialMedia: string) {
    //     return this.profileService.getInfluencersWithSocialMedia(socialMedia);
    // }
    //
    // // TODO: update
    // @Auth()
    // @ApiOperation({summary: 'Get all influencers without filtering'})
    // @Get('influencers-all')
    // getInfluencersWithoutSocialMedia() {
    //     return this.profileService.getInfluencersWithoutSocialMedia();
    // }
    //
    // // TODO: update
    // @Auth()
    // @ApiOperation({summary: 'Get client list'})
    // @Get('clients')
    // getClients() {
    //     return this.profileService.getClients();
    // }
    //
    // // TODO: update
    // @Auth()
    // @ApiOperation({summary: 'Get influencer by id'})
    // @Get('influencer/:id')
    // getInfluencer(@Param('id') id: string) {
    //     return this.profileService.getInfluencerById(id);
    // }
    //
    // // TODO: update
    // @Auth()
    // @ApiOperation({summary: 'Get specific social network account of influencer'})
    // @Get('influencer/one-network/:id/:socialMedia/:networkUsername')
    // getOneSocialNetworkAccount(
    //     @Param('id') id: string,
    //     @Param('socialMedia') socialMedia: string,
    //     @Param('networkUsername') networkUsername: string,
    // ) {
    //     return this.profileService.getOneSocialNetworkAccount(id, socialMedia, networkUsername);
    // }
    //
    // // TODO: update
    // @Auth()
    // @ApiOperation({summary: 'Get client by id'})
    // @Get('client/:id')
    // getClient(@Param('id') id: string) {
    //     return this.profileService.getClientById(id);
    // }
}
