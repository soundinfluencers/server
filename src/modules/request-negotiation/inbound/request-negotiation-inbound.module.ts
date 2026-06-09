import { Module } from '@nestjs/common';
import { WebsocketModule } from '../../websocket/websocket.module';
import { NegotiationInboundProcessor } from './negotiation-inbound.processor';
import { ZohoInboundService } from './zoho-inbound.service';
import { RedisLeaderLock } from './redis-leader-lock';

// Background worker module: consumes inbound negotiation replies over IMAP.
// Repositories come from the global DatabaseModule; RealtimeNotificationService
// from WebsocketModule. A Redis leader lease ensures a single active consumer
// across instances.
@Module({
  imports: [WebsocketModule],
  providers: [NegotiationInboundProcessor, ZohoInboundService, RedisLeaderLock],
})
export class RequestNegotiationInboundModule {}
