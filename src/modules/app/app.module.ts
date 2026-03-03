import {Module} from '@nestjs/common';
import {join} from 'path';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {MongooseModule} from '@nestjs/mongoose';
import {ServeStaticModule} from '@nestjs/serve-static';
import {AuthModule} from "../auth/auth.module";
import {ForgotModule} from "../forgot/forgot.module";
import {ProfileModule} from "../profile/profile.module";
import {InvoiceModule} from "../invoice/invoice.module";
import {PromosModule} from "../promos/promos.module";
import {FileModule} from "../file/file.module";
import {PaymentModule} from "../payment/payment.module";
import {AdminModule} from "../admin/admin.module";
import {InfluencerActionsHistoryModule} from "../influencer-actions-history/influencer-actions-history.module";
import {ProposalSystemModule} from "../proposal-system/proposal-system.module";
import {WebsocketModule} from "../websocket/app.gateway";
import {OffersModule} from "../offers/offers.module";
import {ScrapersModule} from "../scrapers/scrapers.module";
import {ReportsSizesModule} from "../reports-sizes/reports-sizes.module";
import {HealthController} from "../health/health.controller";
import {DatabaseModule} from "../../database/database.module";
import {CampaignsModule} from "../campaigns/campaigns.module";
import {MigrationsModule} from "../migrations/migrations.module";
import {EmailModule} from "../../integrations/email/email.module";
import {MediaModule} from "../media/media.module";
import {ExchangeRateModule} from "../../integrations/exchange-rate/exchange-rate.module";
import {ScheduleModule} from "@nestjs/schedule";
import {JobsModule} from "../../jobs/jobs.module";
import {ConfigModule} from "@nestjs/config";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        MongooseModule.forRoot(
            process.env.DATABASE_ROOT
        ),
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
        PaymentModule,
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
    ],
    controllers: [AppController, HealthController],
    providers: [AppService],
})
export class AppModule {
}
