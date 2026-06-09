import { Module } from '@nestjs/common';
import { RequestNegotiationController } from './request-negotiation.controller';
import { StartNegotiationService } from './services/start-negotiation.service';
import { SendNegotiationMessageService } from './services/send-negotiation-message.service';
import { NegotiationParticipantResolver } from './services/negotiation-participant.resolver';
import { WebsocketModule } from '../websocket/websocket.module';

// Repositories (RequestForAdmin / RequestNegotiation*) come from the global
// DatabaseModule; EmailService from the global EmailModule;
// RealtimeNotificationService from WebsocketModule.
@Module({
  imports: [WebsocketModule],
  controllers: [RequestNegotiationController],
  providers: [
    StartNegotiationService,
    SendNegotiationMessageService,
    NegotiationParticipantResolver,
  ],
})
export class RequestNegotiationModule {}
