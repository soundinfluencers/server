import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/auth.decorator';
import { ApiResponseDto } from '../../common/decorators/api/response/api-response.decorator';
import { AuthenticatedRequest } from '../../common/types/user.types';
import { WhatsappService } from '../../integrations/whatsapp/whatsapp.service';
import { SendCampaignWhatsappMessagesDto } from './dto/send-campaign-whatsapp-messages.dto';
import { SendWhatsappMessageDto } from './dto/send-whatsapp-message.dto';

@ApiTags('whatsapp')
@Auth('whatsapp')
@Controller('whatsapp')
export class WhatsappController {
    constructor(private readonly whatsappService: WhatsappService) {}

    @ApiOperation({ summary: 'Send WhatsApp message' })
    @ApiResponseDto()
    @Post('send')
    sendMessage(
        @Req() req: AuthenticatedRequest,
        @Body() dto: SendWhatsappMessageDto,
    ): Promise<{ status: 'sent' }> {
        const sessionId = req.user.sessionId ?? req.user.sid;

        if (!sessionId) {
            throw new UnauthorizedException('Authenticated session is required');
        }

        return this.whatsappService.sendMessage({
            message: dto.message,
            phone: dto.phone,
            clientId: dto.clientId,
            sessionId,
        });
    }

    @ApiOperation({ summary: 'Send WhatsApp messages to campaign accounts' })
    @ApiResponseDto()
    @Post('campaign/messages')
    sendCampaignMessages(
        @Req() req: AuthenticatedRequest,
        @Body() dto: SendCampaignWhatsappMessagesDto,
    ): Promise<{ status: 'sent'; count: number; failedCount: number }> {
        const sessionId = req.user.sessionId ?? req.user.sid;

        if (!sessionId) {
            throw new UnauthorizedException('Authenticated session is required');
        }

        return this.whatsappService.sendCampaignMessages({
            sessionId,
            clientId: dto.clientId,
            campaignId: dto.campaignId,
            message: dto.message,
            accounts: dto.accounts,
        });
    }
}
