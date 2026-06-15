import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Client } from '../users/client.schema';
import { Campaign } from '../campaign/campaign.schema';

export type CampaignAdminRequestDocument = HydratedDocument<CampaignAdminRequest & Document>;

@Schema()
export class CampaignAdminRequest {
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
    ref: Campaign.name,
    index: true,
  })
  campaignId: Types.ObjectId;
}

export const CampaignAdminRequestSchema = SchemaFactory.createForClass(CampaignAdminRequest);

CampaignAdminRequestSchema.index({ clientId: 1, campaignId: 1, specifiedStatus: 1 }, { unique: true });
