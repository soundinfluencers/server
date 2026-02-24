import { Module } from '@nestjs/common';
import { ForgotService } from './forgot.service';
import { ForgotController } from './forgot.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Forgot, ForgotSchema } from './schemas/forgot.schema';
import {ForgotRepository} from "./repositories/forgot.repository";
import {EmailService} from "../email/email.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Forgot.name, schema: ForgotSchema },
    ]),
  ],
  controllers: [ForgotController],
  providers: [ForgotService, ForgotRepository, EmailService],
})
export class ForgotModule {}
