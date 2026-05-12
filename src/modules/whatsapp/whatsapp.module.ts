import { Module } from '@nestjs/common';
import { WhatsappService } from '../../integrations/whatsapp/whatsapp.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { WhatsappController } from './whatsapp.controller';

@Module({
    imports: [WebsocketModule],
    controllers: [WhatsappController],
    providers: [WhatsappService],
    exports: [WhatsappService],
})
export class WhatsappModule {}
