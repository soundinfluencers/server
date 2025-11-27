import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.entity';
import {InvoiceDetails, InvoiceDetailsSchema} from "../invoice/schemas/invoice-details.schema";
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Client.name, schema: ClientSchema },
      { name: InvoiceDetails.name, schema: InvoiceDetailsSchema },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
