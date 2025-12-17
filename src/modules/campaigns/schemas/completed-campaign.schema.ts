import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {Campaign} from './campaign.schema';

@Schema({
  timestamps: true,
})
export class CompletedCampaign extends Campaign {
  @Prop()
  totalFollowers: number;
}

export const CompletedCampaignSchema = SchemaFactory.createForClass(CompletedCampaign);
