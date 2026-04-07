import {Global, Module} from '@nestjs/common';
import {ProfileService} from './services/profile.service';
import {ProfileController} from './profile.controller';
import {MongooseModule} from '@nestjs/mongoose';
import {AppGateway} from '../websocket/app.gateway';
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";
import {AuthService} from "../auth/auth.service";
import {UpdateSocialAccountService} from "./services/update-social-account.service";

@Module({
    imports: [
        MongooseModule.forFeature([
            {name: Client.name, schema: ClientSchema},
            {name: Influencer.name, schema: InfluencerSchema},
        ]),
    ],
    controllers: [ProfileController],
    providers: [ProfileService, AuthService, AppGateway],
    exports: [ProfileService],
})
export class ProfileModule {
}

@Global()
@Module({
    providers: [UpdateSocialAccountService],
    exports: [UpdateSocialAccountService],
})
export class UpdateSocialAccountModule {}