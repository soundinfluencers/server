import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { AppGateway } from './app.gateway';
import { RealtimeNotificationService } from './realtime-notification.service';

@Module({
    imports: [
        ConfigModule,
        DatabaseModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET,
        }),
    ],
    providers: [AppGateway, RealtimeNotificationService],
    exports: [AppGateway, RealtimeNotificationService],
})
export class WebsocketModule {}
