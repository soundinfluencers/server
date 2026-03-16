import {Body, Controller, Get, Param, Post, Res, Response} from '@nestjs/common';
import {AppService} from './app.service';
import {Auth} from "../../common/decorators/auth.decorator";
import {Role} from "../../common/types/user.types";
import {ApiOperation, ApiParam} from "@nestjs/swagger";
import {Roles} from "../../common/decorators/roles.decorator";
import {Public} from "../../common/decorators/public.decorator";
import {TEST_EMAIL_KEYS, TestEmailKey} from "../../integrations/email/email-test.registry";

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {
    }

    @Public()
    @Get()
    getHello(@Res() res) {
        return res.redirect(process.env.NODE_ENV === 'production' ? '/api' : '/dev-api');
    }

    @Public()
    @ApiOperation({summary: 'Sends all emails for testing'})
    @Post('/email')
    sendTestEmails() {
        return this.appService.sendTestEmails();
    }

    @Public()
    @ApiOperation({summary: 'Sends selected email for testing'})
    @ApiParam({
        name: 'key',
        enum: TEST_EMAIL_KEYS,
        required: true,
        description: 'Test email key',
    })
    @Post('email/:key')
    async sendTestEmail(@Param('key') key: TestEmailKey) {
        await this.appService.sendSelectedTestEmail(key);

        return {
            success: true,
            message: `Test email sent: ${key}`,
        };
    }
}
