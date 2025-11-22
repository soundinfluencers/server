import { Module } from '@nestjs/common';
import { ForgotService } from './forgot.service';
import { ForgotController } from './forgot.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Forgot, ForgotSchema } from './schemas/forgot.schema';
import {Client, ClientSchema} from "../auth/schemas/client.schema";
import {Influencer, InfluencerSchema} from "../auth/schemas/influencer.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Influencer.name, schema: InfluencerSchema },
      { name: Forgot.name, schema: ForgotSchema },
    ]),
  ],
  controllers: [ForgotController],
  providers: [ForgotService],
})
export class ForgotModule {}
