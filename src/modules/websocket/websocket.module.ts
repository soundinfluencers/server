import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { AppGateway } from './app.gateway';
import { RealtimeNotificationService } from './realtime-notification.service';

@Module({
    imports: [
        DatabaseModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET,
        }),
    ],
    providers: [AppGateway, RealtimeNotificationService],
    exports: [RealtimeNotificationService],
})
export class WebsocketModule {}
