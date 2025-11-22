import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AppGateway } from '../websocket/app.gateway';
import {Client, ClientSchema} from "../auth/schemas/client.schema";
import {Influencer, InfluencerSchema} from "../auth/schemas/influencer.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Influencer.name, schema: InfluencerSchema },
    ]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService, AppGateway],
})
export class ProfileModule {}
