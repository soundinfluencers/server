import {Module} from '@nestjs/common';
import {AdminService} from './admin.service';
import {MongooseModule} from '@nestjs/mongoose';
import {Promos, PromosSchema} from '../promos/schemas/promo.schema';
import {Client, ClientSchema} from '../auth/schemas/client.schema';
import {Influencer, InfluencerSchema} from '../auth/schemas/influencer.schema';
import {AdminController} from './admin.controller';
import {Invoices} from '../invoice/schemas/invoices.schema';
import {Payment} from '../payment/schemas/payment.entity';
import {PromosCopies, PromosCopiesSchema} from './schemas/promos-copies.schema';
import { ProposalCampaign, ProposalCampaignSchema } from '../proposal-system/schemas/proposal-campaign.schema';
import {PromosModule} from '../promos/promos.module';
import {WebsocketModule} from '../websocket/app.gateway';

@Module({
    imports: [
        MongooseModule.forFeature([
            {name: Promos.name, schema: PromosSchema},
            {name: Client.name, schema: ClientSchema},
            {name: Influencer.name, schema: InfluencerSchema},
            {name: Invoices.name, schema: Invoices},
            {name: Payment.name, schema: Payment},
            {name: PromosCopies.name, schema: PromosCopiesSchema},
            {name: ProposalCampaign.name, schema: ProposalCampaignSchema},
        ]),
        WebsocketModule,
        PromosModule,
    ],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {
}
