import {Body, Controller, Patch, Post} from '@nestjs/common';
import {ForgotService} from './forgot.service';
import {ApiOperation, ApiQuery, ApiTags} from '@nestjs/swagger';
import {Public} from "../../common/decorators/public.decorator";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {CloseForgotRequestDto, CreateNewForgotRequestDto} from "./dto/forgot.dto";

@ApiTags('forgot')
@Controller('forgot')
export class ForgotController {
    constructor(private readonly forgotService: ForgotService) {
    }

    @Public()
    @ApiResponseDto(undefined, {successStatusCode: 201})
    @ApiOperation({summary: 'Creates new reset password request'})
    @Post()
    createResetRequest(@Body() data: CreateNewForgotRequestDto) {
        return this.forgotService.createResetPasswordRequest(data.email, data.role);
    }

    @Public()
    @ApiResponseDto()
    @ApiOperation({summary: "Closes user's password request"})
    @Patch()
    closeResetRequest(@Body() data: CloseForgotRequestDto) {
        return this.forgotService.closeResetPasswordRequest(data.email, data.role, data.code);
    }
}
