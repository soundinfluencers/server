import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, AuthenticatedRequest } from '../../common/types/user.types';
import { ParseObjectIdPipe } from '../../common/pipes/parse-oid.pipe';
import { StartNegotiationService } from './services/start-negotiation.service';
import { SendNegotiationMessageService } from './services/send-negotiation-message.service';
import { RequestNegotiationThreadRepository } from '../../database/repositories/negotiation/request-negotiation-thread.repository';
import { RequestNegotiationMessageRepository } from '../../database/repositories/negotiation/request-negotiation-message.repository';
import { SendNegotiationMessageDto } from './dto/request-negotiation.dto';

@Auth()
@Roles(Role.admin)
@ApiTags('admin/requests')
@Controller('admin/requests')
export class RequestNegotiationController {
  constructor(
    private readonly startNegotiationService: StartNegotiationService,
    private readonly sendNegotiationMessageService: SendNegotiationMessageService,
    private readonly threadRepository: RequestNegotiationThreadRepository,
    private readonly messageRepository: RequestNegotiationMessageRepository,
  ) {}

  @ApiOperation({ summary: 'Move a request into NEGOTIATION and open a conversation thread' })
  @ApiParam({ name: 'requestId', type: String, required: true })
  @Post(':requestId/negotiation')
  start(
    @Param('requestId', new ParseObjectIdPipe()) requestId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.startNegotiationService.exec(requestId, req.user._id);
  }

  @ApiOperation({ summary: 'Send a message to the request participant within the negotiation' })
  @ApiParam({ name: 'requestId', type: String, required: true })
  @Post(':requestId/negotiation/messages')
  sendMessage(
    @Param('requestId', new ParseObjectIdPipe()) requestId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendNegotiationMessageDto,
  ) {
    return this.sendNegotiationMessageService.exec(requestId, req.user._id, dto);
  }

  @ApiOperation({ summary: 'Get the negotiation thread with its messages for a request' })
  @ApiParam({ name: 'requestId', type: String, required: true })
  @Get(':requestId/negotiation/messages')
  async getMessages(@Param('requestId', new ParseObjectIdPipe()) requestId: string) {
    const thread = await this.threadRepository.findLatestByRequestId(requestId);

    if (!thread) {
      throw new NotFoundException('No negotiation for this request');
    }

    const messages = await this.messageRepository.listByThread(thread._id.toString());
    return { thread, messages };
  }

  @ApiOperation({ summary: 'Mark the negotiation conversation as read by the admin' })
  @ApiParam({ name: 'requestId', type: String, required: true })
  @Patch(':requestId/negotiation/read')
  async markRead(@Param('requestId', new ParseObjectIdPipe()) requestId: string) {
    const thread = await this.threadRepository.findLatestByRequestId(requestId);

    if (!thread) {
      throw new NotFoundException('No negotiation for this request');
    }

    await Promise.all([
      this.threadRepository.resetUnread(thread._id.toString()),
      this.messageRepository.markInboundRead(thread._id, new Date()),
    ]);

    return { ok: true };
  }
}
