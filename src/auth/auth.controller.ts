import {Controller, Get, Post, Body, Param, Query, Res} from '@nestjs/common';
import {AuthService} from './auth.service';
import {CreateClientDto} from './dto/create-client.dto';
import {CreateInfluencerDto} from './dto/create-influencer.dto';
import {LoginDto} from './dto/login.dto';
import {VerifyDto} from './dto/verify.dto';
import {ApiQuery} from '@nestjs/swagger';
import {Response} from 'express';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {
    }

    @Post('create/client')
    createClient(@Body() data: CreateClientDto) {
        return this.authService.createClient(data);
    }

    @Post('create/influencer')
    createInfluencer(@Body() data: CreateInfluencerDto) {
        return this.authService.createInfluencer(data);
    }

    @ApiQuery({name: 'verifyId'})
    @ApiQuery({name: 'responseVerify'})
    @Get('verify-influencer')
    verifyAdminInfluencer(@Query() args: { verifyId: string; responseVerify: string }) {
        return this.authService.verifyAdminInfluencer(args.verifyId, args.responseVerify);
    }

    @ApiQuery({name: 'verifyId'})
    @ApiQuery({name: 'responseVerify'})
    @Get('verify-client')
    verifyAdminClient(@Query() args: { verifyId: string; responseVerify: string }) {
        return this.authService.verifyAdminClient(args.verifyId, args.responseVerify);
    }

    @Post('login')
    loginUser(@Body() data: LoginDto, @Res() res: Response) {
        return this.authService.loginUser(data, res);
    }

    @Post('verify')
    verify(@Body() data: VerifyDto) {
        return this.authService.verify(data);
    }

    @Get('influencers/:socialMedia')
    getInfluencersWithSocialMedia(@Param('socialMedia') socialMedia: string) {
        return this.authService.getInfluencersWithSocialMedia(socialMedia);
    }

    @Get('influencers-all')
    getInfluencersWithoutSocialMedia() {
        return this.authService.getInfluencersWithoutSocialMedia();
    }

    @Get('clients')
    getClients() {
        return this.authService.getClients();
    }

    @Get('influencer/:id')
    getInfluencer(@Param('id') id: string) {
        return this.authService.getInfluencerById(id);
    }

    @Get('influencer/one-network/:id/:socialMedia/:networkUsername')
    getOneSocialNetworkAccount(
        @Param('id') id: string,
        @Param('socialMedia') socialMedia: string,
        @Param('networkUsername') networkUsername: string,
    ) {
        return this.authService.getOneSocialNetworkAccount(id, socialMedia, networkUsername);
    }

    @Get('client/:id')
    getClient(@Param('id') id: string) {
        return this.authService.getClientById(id);
    }
}
