import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {HydratedDocument, Types} from 'mongoose';

export type ExchangeRateDocument = HydratedDocument<ExchangeRate>;

@Schema({ timestamps: true })
export class ExchangeRate {
    _id: Types.ObjectId;

    @Prop({type: String, required: true})
    currency: string;

    @Prop({type: String, required: false, default: 'EUR'})
    base: string;

    @Prop({type: Number, required: true})
    rate: number;

    @Prop({ type: String, required: true })
    date: string;

    createdAt?: Date;
    updatedAt?: Date;
}

export const ExchangeRateSchema = SchemaFactory.createForClass(ExchangeRate);

ExchangeRateSchema.index({ currency: 1, createdAt: -1 });
ExchangeRateSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 15552000 }
);
ExchangeRateSchema.index(
    { currency: 1, base: 1, date: 1 },
    { unique: true }
);