import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Client } from '../users/client.schema';
import { RequestSpecifiedStatus } from '../../../common/types/request-for-admin/request-for-admin.types';

export type BespokeCampaignAdminRequestDocument = HydratedDocument<BespokeCampaignAdminRequest>;

@Schema()
export class BespokeCampaignAdminRequest {
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
    ref: Client.name,
    index: true,
  })
  clientId: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: BespokeCampaignAdminRequest.name,
    index: true,
  })
  bespokeCampaignRequestId: Types.ObjectId;
}

export const BespokeCampaignAdminRequestSchema = SchemaFactory.createForClass(
  BespokeCampaignAdminRequest,
);

BespokeCampaignAdminRequestSchema.index(
  { clientId: 1, bespokeCampaignRequestId: 1, specifiedStatus: 1 },
  { unique: true },
);
