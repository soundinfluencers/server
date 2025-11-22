import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    Res,
    Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateInfluencerDto } from './dto/create-influencer.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyDto } from './dto/verify.dto';
import {ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery, ApiTags} from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {Auth} from "../../common/decorators/auth.decorator";

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @ApiOperation({ summary: 'Create new client account' })
    @ApiResponse({ status: 201, description: 'Client created' })
    @Post('create/client')
    createClient(@Body() data: CreateClientDto) {
        return this.authService.createClient(data);
    }

    @Public()
    @ApiOperation({ summary: 'Create new influencer account' })
    @ApiResponse({ status: 201, description: 'Influencer created' })
    @Post('create/influencer')
    createInfluencer(@Body() data: CreateInfluencerDto) {
        return this.authService.createInfluencer(data);
    }

    @Public()
    @ApiOperation({ summary: 'Login user' })
    @ApiResponse({ status: 200, description: 'Logged in successfully' })
    @Post('login')
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        return this.authService.login(dto, res);
    }

    @Public()
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Refresh access token using refreshToken cookie' })
    @ApiResponse({ status: 200, description: 'Access token refreshed' })
    @Post('refresh')
    async refresh(
        @Req() req,
        @Res({ passthrough: true }) res: Response
    ) {
        return this.authService.refresh(req.cookies.refreshToken, res);
    }

    @Auth()
    @ApiOperation({ summary: 'Logout user' })
    @ApiResponse({ status: 200, description: 'Logged out' })
    @Post('logout')
    async logout(
        @Req() req,
        @Res({ passthrough: true }) res: Response,
    ) {
        return this.authService.logout(req.cookies.refreshToken, res);
    }

    @Auth()
    @ApiOperation({ summary: 'Get current authenticated user' })
    @ApiResponse({ status: 200 })
    @Get('me')
    getUser(@Req() req) {
        return req.user;
    }

    @Auth()
    @ApiOperation({ summary: 'Verify influencer by admin' })
    @ApiQuery({ name: 'verifyId' })
    @ApiQuery({ name: 'responseVerify' })
    @Get('verify-influencer')
    verifyAdminInfluencer(@Query() args: { verifyId: string; responseVerify: string }) {
        return this.authService.verifyAdminInfluencer(args.verifyId, args.responseVerify);
    }

    @Auth()
    @ApiOperation({ summary: 'Verify client by admin' })
    @ApiQuery({ name: 'verifyId' })
    @ApiQuery({ name: 'responseVerify' })
    @Get('verify-client')
    verifyAdminClient(@Query() args: { verifyId: string; responseVerify: string }) {
        return this.authService.verifyAdminClient(args.verifyId, args.responseVerify);
    }

    @Auth()
    @ApiOperation({ summary: 'User email verification' })
    @Post('verify')
    verify(@Body() data: VerifyDto) {
        return this.authService.verify(data);
    }

    @Auth()
    @ApiOperation({ summary: 'Get influencers by social media platform' })
    @Get('influencers/:socialMedia')
    getInfluencersWithSocialMedia(@Param('socialMedia') socialMedia: string) {
        return this.authService.getInfluencersWithSocialMedia(socialMedia);
    }

    @Auth()
    @ApiOperation({ summary: 'Get all influencers without filtering' })
    @Get('influencers-all')
    getInfluencersWithoutSocialMedia() {
        return this.authService.getInfluencersWithoutSocialMedia();
    }

    @Auth()
    @ApiOperation({ summary: 'Get client list' })
    @Get('clients')
    getClients() {
        return this.authService.getClients();
    }

    @Auth()
    @ApiOperation({ summary: 'Get influencer by id' })
    @Get('influencer/:id')
    getInfluencer(@Param('id') id: string) {
        return this.authService.getInfluencerById(id);
    }

    @Auth()
    @ApiOperation({ summary: 'Get specific social network account of influencer' })
    @Get('influencer/one-network/:id/:socialMedia/:networkUsername')
    getOneSocialNetworkAccount(
        @Param('id') id: string,
        @Param('socialMedia') socialMedia: string,
        @Param('networkUsername') networkUsername: string,
    ) {
        return this.authService.getOneSocialNetworkAccount(id, socialMedia, networkUsername);
    }

    @Auth()
    @ApiOperation({ summary: 'Get client by id' })
    @Get('client/:id')
    getClient(@Param('id') id: string) {
        return this.authService.getClientById(id);
    }
}
