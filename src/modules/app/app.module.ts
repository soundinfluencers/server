import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {MongooseModule} from '@nestjs/mongoose';
import {ServeStaticModule} from '@nestjs/serve-static';
import {join} from 'path';
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
import {MultiPromoModule} from "../multipromos/multipromo.module";
import {WebsocketModule} from "../websocket/app.gateway";
import {OffersModule} from "../offers/offers.module";
import {ScrapersModule} from "../scrapers/scrapers.module";
import {ReportsSizesModule} from "../reports-sizes/reports-sizes.module";
import {HealthController} from "../health/health.controller";
import {DatabaseModule} from "../../database/database.module";
import {CampaignsModule} from "../campaigns/campaigns.module";

@Module({
    imports: [
        MongooseModule.forRoot(
            // `mongodb+srv://test:b1fA5EG9SNuA0M35@cluster0.svrxsep.mongodb.net/music`,
            'mongodb+srv://test:b1fA5EG9SNuA0M35@cluster0.svrxsep.mongodb.net/dev_db',
        ),
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
        MultiPromoModule,
        WebsocketModule,
        OffersModule,
        ScrapersModule,
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'uploads'),
            serveRoot: '/uploads',
        }),
        ReportsSizesModule,
        DatabaseModule,
    ],
    controllers: [AppController, HealthController],
    providers: [AppService],
})
export class AppModule {
}
