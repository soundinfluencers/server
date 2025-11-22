import {Controller, Get, Post, Body, Param, Query, Res, Req} from '@nestjs/common';
import {AuthService} from './auth.service';
import {CreateClientDto} from './dto/create-client.dto';
import {CreateInfluencerDto} from './dto/create-influencer.dto';
import {LoginDto} from './dto/login.dto';
import {VerifyDto} from './dto/verify.dto';
import {ApiQuery} from '@nestjs/swagger';
import { Request, Response } from 'express';

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

    @Post('refresh')
    async refreshToken(@Req() req: Request, @Res() res: Response) {
        try {
            const token = req.cookies['refreshToken'];
            if (!token) return res.status(401).json({ message: 'No refresh token' });

            const { accessToken } = await this.authService.refreshToken(token);

            return res.status(200).json({ accessToken });
        } catch (err: any) {
            console.error(err);
            return res.status(401).json({ message: err.message || 'Unauthorized' });
        }
    }

    @Post('logout')
    async logout(@Req() req: Request, @Res() res: Response) {
        try {
            const token = req.cookies['refreshToken'];

            if (token) {
                await this.authService.logout(token);
            }

            res.clearCookie('refreshToken', {
                path: '/auth/refresh',
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
            });

            return res.status(200).json({ message: 'Logged out' });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Server Error' });
        }
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
