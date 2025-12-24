import {Body, Controller, Get, Param, Patch, Post, Put, Query, Req} from '@nestjs/common';
import {ProfileService} from './profile.service';
import {ClientUpdatedPersonalDetailsDto, UpdateClientPersonalDetailsDto} from './dto/update-client.dto';
import {UpdateUserPasswordDto} from './dto/update-password.dto';
import {
    AddSocialMediasDto, InfluencerUpdatedPersonalDetailsDto,
    UpdateInfluencerPersonalDetailsDto,
    UpdateSocialMediaAccountDto
} from './dto/update-influencer.dto';
import {SendMailPriceChangeDto} from './dto/send-mail-price-change.dto';
import {ApiOperation, ApiQuery, ApiTags} from '@nestjs/swagger';
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {AuthenticatedRequest, Role} from "../../common/types/auth.types";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
    constructor(private readonly profileService: ProfileService) {
    }

    @Auth()
    @Roles(Role.client)
    @ApiOperation({summary: "Updates client's personal details"})
    @ApiResponseDto(ClientUpdatedPersonalDetailsDto)
    @Patch('client/personal')
    updatePersonalClient(@Req() request: AuthenticatedRequest, @Body() data: UpdateClientPersonalDetailsDto): Promise<ClientUpdatedPersonalDetailsDto> {
        return this.profileService.updatePersonalClient({...data, _id: request.user._id});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: "Updates influencer's personal details"})
    @ApiResponseDto(InfluencerUpdatedPersonalDetailsDto)
    @Patch('influencer/personal')
    updatePersonalInfluencer(@Req() request: AuthenticatedRequest, @Body() data: UpdateInfluencerPersonalDetailsDto): Promise<InfluencerUpdatedPersonalDetailsDto> {
        return this.profileService.updatePersonalInfluencer({...data, _id: request.user._id});
    }

    @Auth()
    @Roles(Role.client, Role.influencer, Role.admin)
    @ApiOperation({summary: "Updates user's password"})
    @ApiResponseDto()
    @Patch('password')
    updatePasswordClient(@Req() request: AuthenticatedRequest, @Body() data: UpdateUserPasswordDto) {
        return this.profileService.updateUserPassword({...data, _id: request.user._id, role: request.user.role});
    }

    // // TODO: UPDATE
    // @Auth()
    // @Roles(Role.influencer)
    // @ApiOperation({summary: "Updates user's password"})
    // @ApiResponseDto()
    // @Put('influencer/update-social-media-account')
    // updateSocialMediaAccount(@Body() data: UpdateSocialMediaAccountDto) {
    //     return this.profileService.updateSocialAccount(data);
    // }
    //
    // // TODO: UPDATE
    // @Patch('influencer/delete-social-media-account')
    // deleteSocialMediaAccount(@Body() data: any) {
    //     return this.profileService.deleteSocialMediaAccount(data);
    // }
    //
    // // TODO: UPDATE
    // @Patch('influencer/add-social-media-accounts')
    // addSocialMediaAccounts(@Body() data: AddSocialMediasDto) {
    //     return this.profileService.addSocialMediaAccounts(data);
    // }
    //
    // // TODO: UPDATE
    // @Post('influencer/send-mail-price-change')
    // sendMailAboutChangingPrice(@Body() data: SendMailPriceChangeDto) {
    //     return this.profileService.sendMailAboutChangingPrice(data);
    // }
    //
    // // TODO: UPDATE
    // @ApiQuery({name: 'influencerId'})
    // @ApiQuery({name: 'accounts'})
    // @ApiQuery({name: 'isVerified'})
    // @Get('influencer/verify-new-brand')
    // verifyNewSocialMediaAccounts(
    //     @Query() query: { influencerId: string; accounts: []; isVerified: boolean },
    // ) {
    //     return this.profileService.verifyNewSocialMediaAccounts(
    //         query.influencerId,
    //         query.accounts,
    //         query.isVerified,
    //     );
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
