import {Global, Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";
import {Influencer, InfluencerSchema} from "./schemas/users/influencer.schema";
import {Client, ClientSchema} from "./schemas/users/client.schema";
import {InfluencerRepository} from "./repositories/users/influencer.repository";
import {ClientRepository} from "./repositories/users/client.repository";
import {VerifyInfluencer, VerifyInfluencerSchema} from "./schemas/verify-users/verifyInfluencer.schema";
import {VerifyClient, VerifyClientSchema} from "./schemas/verify-users/verifyClient.schema";

@Global()
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Influencer.name, schema: InfluencerSchema },
            { name: Client.name, schema: ClientSchema },
            { name: VerifyInfluencer.name, schema: VerifyInfluencerSchema },
            { name: VerifyClient.name, schema: VerifyClientSchema },
        ]),
    ],
    providers: [
        ClientRepository,
        InfluencerRepository
    ],
    exports: [
        ClientRepository,
        InfluencerRepository,
    ],
})
export class DatabaseModule {}