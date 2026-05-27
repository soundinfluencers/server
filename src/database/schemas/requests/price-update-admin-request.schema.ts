import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  RequestForAdminType,
  RequestLifecycleState,
  RequestSpecifiedStatus,
} from '../../../common/types/request-for-admin/request-for-admin.types';
import { Influencer } from '../users/influencer.schema';
import { RequestForAdmin } from './request-for-admin.schema';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { CurrencyCode } from '../../../common/types/finance.types';

export type PriceUpdateAdminRequestDocument = HydratedDocument<
  RequestForAdmin & PriceUpdateAdminRequest
>;

@Schema()
export class PriceUpdateAdminRequest {
  @Prop({
    required: true,
    type: String,
    enum: Object.values(RequestSpecifiedStatus),
    default: RequestSpecifiedStatus.WAITING_FOR_ADMIN,
    index: true,
  })
  specifiedStatus: RequestSpecifiedStatus;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: Influencer.name,
    index: true,
  })
  influencerId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  socialAccountId: Types.ObjectId;

  @Prop({ required: true, type: String, enum: Object.values(SocialMediaEnum) })
  socialMedia: SocialMediaEnum;

  @Prop({ required: true, type: Number })
  newPrice: number;

  @Prop({ required: true, type: String, enum: Object.values(CurrencyCode) })
  currency: CurrencyCode;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  rejectionReason?: string;
}

export const PriceUpdateAdminRequestSchema = SchemaFactory.createForClass(PriceUpdateAdminRequest);

PriceUpdateAdminRequestSchema.index(
  { influencerId: 1, socialAccountId: 1, lifecycleStatus: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: RequestForAdminType.PRICE_UPDATE_REQUEST,
      lifecycleStatus: RequestLifecycleState.OPEN,
    },
  },
);
