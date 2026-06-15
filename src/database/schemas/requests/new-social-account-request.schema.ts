import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  RequestForAdminType,
  RequestLifecycleState,
  RequestSpecifiedStatus,
} from '../../../common/types/request-for-admin/request-for-admin.types';
import { HydratedDocument, Types } from 'mongoose';
import { Influencer } from '../users/influencer.schema';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { RequestForAdmin } from './request-for-admin.schema';

export type NewSocialAccountAdminRequestDocument = HydratedDocument<
  RequestForAdmin & NewSocialAccountAdminRequest
>;

@Schema()
export class NewSocialAccountAdminRequest {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: Influencer.name,
    index: true,
  })
  influencerId: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
    index: true,
  })
  accountId: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: SocialMediaEnum,
  })
  socialMedia: SocialMediaEnum;

  @Prop({
    type: String,
    trim: true,
    maxlength: 1000,
    required: function (this: RequestForAdmin & NewSocialAccountAdminRequest) {
      return this.specifiedStatus === RequestSpecifiedStatus.REJECTED;
    },
  })
  rejectionReason?: string;
}

export const NewSocialAccountAdminRequestSchema = SchemaFactory.createForClass(
  NewSocialAccountAdminRequest,
);

NewSocialAccountAdminRequestSchema.index(
  { influencerId: 1, accountId: 1, lifecycleStatus: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: RequestForAdminType.NEW_SOCIAL_ACCOUNT_REQUEST,
      lifecycleStatus: RequestLifecycleState.OPEN,
    },
  },
);
