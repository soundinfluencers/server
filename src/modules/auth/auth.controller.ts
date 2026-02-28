import {
    Controller,
    Post,
    Body,
    Query,
    Res,
    Req,
    Patch, Get
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateInfluencerDto } from './dto/create-influencer.dto';
import {GetMeResponseDto, LoginDto, LoginResponseDto} from './dto/login.dto';
import {ApiOperation, ApiCookieAuth, ApiQuery, ApiTags} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {Auth} from "../../common/decorators/auth.decorator";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {AuthenticatedRequest, Role} from "../../common/types/user.types";
import {Roles} from "../../common/decorators/roles.decorator";
import {ClientAccountDetailsDto} from "../profile/dto/influencer/get-profile.dto";

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @ApiOperation({ summary: 'Create new client account' })
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Post('create/client')
    createClient(@Body() data: CreateClientDto): Promise<void> {
        return this.authService.createClient(data);
    }

    @Public()
    @ApiOperation({ summary: 'Create new influencer account' })
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Post('create/influencer')
    createInfluencer(@Body() data: CreateInfluencerDto): Promise<void> {
        return this.authService.createInfluencer(data);
    }

    @Public()
    @ApiOperation({ summary: 'Login user' })
    @ApiResponseDto(LoginResponseDto)
    @Post('login')
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<LoginResponseDto> {
        return this.authService.login(dto, res);
    }

    @Public()
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Refresh access token using refreshToken cookie' })
    @ApiResponseDto()
    @Post('refresh')
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<{ accessToken: string }> {
        return this.authService.refresh(req.cookies.refreshToken, res);
    }

    @Auth()
    @ApiOperation({ summary: 'Logout user' })
    @ApiResponseDto()
    @Post('logout')
    async logout(
        @Req() req,
        @Res({ passthrough: true }) res: Response,
    ): Promise<void> {
        return this.authService.logout(req.cookies.refreshToken, req?.user?.role, res);
    }

    @Public()
    @ApiOperation({ summary: 'Verify influencer by admin' })
    @ApiQuery({ name: 'verifyId' })
    @ApiQuery({ name: 'responseVerify' })
    @Get('verify/influencer')
    verifyAdminInfluencer(@Query() args: { verifyId: string; responseVerify: string }) {
        return this.authService.verifyAdminInfluencer(args.verifyId, args.responseVerify);
    }

    @Public()
    @ApiOperation({ summary: 'Verify client by admin' })
    @ApiQuery({ name: 'verifyId' })
    @ApiQuery({ name: 'responseVerify' })
    @Get('verify/client')
    verifyAdminClient(@Query() args: { verifyId: string; responseVerify: string }) {
        return this.authService.verifyAdminClient(args.verifyId, args.responseVerify);
    }

    @Auth()
    @Roles(Role.client, Role.influencer)
    @ApiOperation({summary: "Returns current user base info (for home page)"})
    @ApiResponseDto(GetMeResponseDto)
    @Get('/me')
    getClientProfileDetails(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response): Promise<GetMeResponseDto> {
        return this.authService.getMe(req.user._id, req.user.role, res);
    }
}
