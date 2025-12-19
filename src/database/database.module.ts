import {Global, Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";
import {Influencer, InfluencerSchema} from "./schemas/users/influencer.schema";
import {Client, ClientSchema} from "./schemas/users/client.schema";
import {InfluencerRepository} from "./repositories/users/influencer.repository";
import {ClientRepository} from "./repositories/users/client.repository";
import {VerifyInfluencer, VerifyInfluencerSchema} from "./schemas/verify-users/verifyInfluencer.schema";
import {VerifyClient, VerifyClientSchema} from "./schemas/verify-users/verifyClient.schema";
import {VerifyClientRepository} from "./repositories/verify-users/verify-client.repository";
import {VerifyInfluencerRepository} from "./repositories/verify-users/verify-influencer.repository";
import {
    InfluencerActionsHistory,
    InfluencerActionsHistorySchema
} from "./schemas/histories/influencer-actions-history.schema";
import {InfluencerHistoryRepository} from "./repositories/histories/influencer-history.repository";

@Global()
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Influencer.name, schema: InfluencerSchema },
            { name: Client.name, schema: ClientSchema },
            { name: VerifyInfluencer.name, schema: VerifyInfluencerSchema },
            { name: VerifyClient.name, schema: VerifyClientSchema },
            { name: InfluencerActionsHistory.name, schema: InfluencerActionsHistorySchema },
        ]),
    ],
    providers: [
        ClientRepository,
        InfluencerRepository,
        VerifyClientRepository,
        VerifyInfluencerRepository,
        InfluencerHistoryRepository,
    ],
    exports: [
        ClientRepository,
        InfluencerRepository,
        VerifyClientRepository,
        VerifyInfluencerRepository,
        InfluencerHistoryRepository,
    ],
})
export class DatabaseModule {}