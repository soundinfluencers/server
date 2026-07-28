import { Logger, Module } from '@nestjs/common';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from '../auth/auth.module';
import { ForgotModule } from '../forgot/forgot.module';
import {
  CreateSocialAccountModule,
  ProfileModule,
  UpdateInfluencerModule,
  UpdateSocialAccountModule,
} from '../profile/profile.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { PromosModule } from '../promos/promos.module';
import { FileModule } from '../file/file.module';
import { InfluencerActionsHistoryModule } from '../influencer-actions-history/influencer-actions-history.module';
import { ProposalSystemModule } from '../proposal-system/proposal-system.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { OffersModule } from '../offers/offers.module';
import { ScrapersModule } from '../scrapers/scrapers.module';
import { ReportsSizesModule } from '../reports-sizes/reports-sizes.module';
import { HealthController } from '../health/health.controller';
import { DatabaseModule } from '../../database/database.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { MigrationsModule } from '../migrations/migrations.module';
import { EmailModule } from '../../integrations/email/email.module';
import { MediaModule } from '../media/media.module';
import { ExchangeRateModule } from '../../integrations/exchange-rate/exchange-rate.module';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsModule } from '../../jobs/jobs.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminModule } from '../admin/admin.module';
import { PaymentsHistoryModule } from '../payments-history/payments-history.module';
import { WhatsappModule } from '../../integrations/whatsapp/whatsapp.module';
import { RequestNegotiationInboundModule } from '../request-negotiation/inbound/request-negotiation-inbound.module';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { validateEnvironment } from '../../config/env.validation';
import { HealthService } from '../health/health.service';
import { CacheLifecycleService } from '../../common/lifecycle/cache-lifecycle.service';
import { PuppeteerLifecycleService } from '../../common/lifecycle/puppeteer-lifecycle.service';

const cacheLogger = new Logger('CacheModule');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.getOrThrow<string>('REDIS_URL');

        const redisPrefix = configService.getOrThrow<string>('REDIS_PREFIX');
        cacheLogger.log('Redis cache configured');

        const redisStore = createKeyv(redisUrl, {
          namespace: `${redisPrefix}:cache`,
        });

        return {
          stores: [redisStore],
          ttl: Number(configService.get<string>('OFFERS_CACHE_TTL_MS') ?? 300000),
        };
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('DATABASE_ROOT'),
      }),
    }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    ForgotModule,
    ProfileModule,
    InvoiceModule,
    CampaignsModule,
    PromosModule,
    FileModule,
    AdminModule,
    InfluencerActionsHistoryModule,
    ProposalSystemModule,
    WebsocketModule,
    OffersModule,
    ScrapersModule,
    ReportsSizesModule,
    MigrationsModule,
    MediaModule,
    EmailModule,
    DatabaseModule,
    ExchangeRateModule,
    JobsModule,
    CreateSocialAccountModule,
    UpdateSocialAccountModule,
    UpdateInfluencerModule,
    PaymentsHistoryModule,
    WhatsappModule,
    RequestNegotiationInboundModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    HealthService,
    CacheLifecycleService,
    PuppeteerLifecycleService,
  ],
})
export class AppModule {}
