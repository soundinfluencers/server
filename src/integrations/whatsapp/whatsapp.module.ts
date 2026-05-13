import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WebsocketModule } from '../../modules/websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
