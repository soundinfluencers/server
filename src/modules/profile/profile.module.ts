import {Module} from '@nestjs/common';
import {ProfileService} from './profile.service';
import {ProfileController} from './profile.controller';
import {MongooseModule} from '@nestjs/mongoose';
import {AppGateway} from '../websocket/app.gateway';
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";

@Module({
    imports: [
        MongooseModule.forFeature([
            {name: Client.name, schema: ClientSchema},
            {name: Influencer.name, schema: InfluencerSchema},
        ]),
    ],
    controllers: [ProfileController],
    providers: [ProfileService, AppGateway],
    exports: [ProfileService],
})
export class ProfileModule {
}
