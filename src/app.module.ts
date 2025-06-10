import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {AuthModule} from './auth/auth.module';
import {ForgotModule} from './forgot/forgot.module';
import {ProfileModule} from './profile/profile.module';
import {InvoiceModule} from './invoice/invoice.module';
import {MongooseModule} from '@nestjs/mongoose';
import {Client} from './auth/schemas/client.schema';
import {PromosModule} from './promos/promos.module';
import {FileModule} from './file/file.module';
import {ServeStaticModule} from '@nestjs/serve-static';
import {join} from 'path';
import {PaymentModule} from './payment/payment.module';
import {AdminModule} from "./admin/admin.module";
import {AppGateway} from "./websocket/app.gateway";
import {InfluencerActionsHistoryModule} from "./influencer-actions-history/influencer-actions-history.module";
import {ProposalSystemModule} from "./proposal-system/proposal-system.module";
import {MultiPromoModule} from "./multipromos/multipromo.module";
import {TwilioController} from "./websocket/twilio.controller";
import {HealthController} from "./health/health.controller";

@Module({
    imports: [
        MongooseModule.forRoot(
            // `mongodb+srv://test:b1fA5EG9SNuA0M35@cluster0.svrxsep.mongodb.net/music`,
            'mongodb+srv://test:b1fA5EG9SNuA0M35@cluster0.svrxsep.mongodb.net/dev_db',
            // 'mongodb+srv://test:b1fA5EG9SNuA0M35@cluster0.svrxsep.mongodb.net/music_dev',
        ),
        AuthModule,
        ForgotModule,
        ProfileModule,
        InvoiceModule,
        Client,
        PromosModule,
        FileModule,
        PaymentModule,
        AdminModule,
        InfluencerActionsHistoryModule,
        ProposalSystemModule,
        MultiPromoModule,
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'uploads'),
            serveRoot: '/uploads',
        }),
    ],
    controllers: [AppController, TwilioController, HealthController],
    providers: [AppService, AppGateway],
})
export class AppModule {
}