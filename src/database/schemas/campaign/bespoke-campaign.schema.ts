import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  BespokeRequestCategory,
  CampaignConfirmationEnum,
} from '../../../common/types/client/campaign.types';
import { Types } from 'mongoose';

// ------------ SUB SCHEMES ------------

// sub scheme for music bespoke campaign extra fields
@Schema()
export class MusicBespokeCampaignFields {
  @Prop({ type: String, required: true })
  trackLink: string;

  @Prop({ type: String, required: true })
  releaseDate: string;

  @Prop({ type: String, required: true })
  smartLink: string;
}

export const MusicBespokeCampaignFieldsSchema = SchemaFactory.createForClass(
  MusicBespokeCampaignFields,
);

// sub scheme for event bespoke campaign extra fields
@Schema()
export class EventBespokeCampaignFields {
  @Prop({ type: String, required: true })
  ticketLink: string;
}

export const EventBespokeCampaignFieldsSchema = SchemaFactory.createForClass(
  EventBespokeCampaignFields,
);

// ------------ MAIN SCHEME ------------

@Schema({
  timestamps: true,
  discriminatorKey: 'category',
})
export class BespokeCampaignRequest {
  _id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(BespokeRequestCategory), required: true })
  category: BespokeRequestCategory;

  @Prop({ type: String, required: true, enum: CampaignConfirmationEnum })
  status: CampaignConfirmationEnum;

  // main fields for artist/music/event
  @Prop({
    type: String,
    required: function (this: any) {
      return this.category !== BespokeRequestCategory.other;
    },
  })
  campaignGoal?: string;

  @Prop({
    type: String,
    required: function (this: any) {
      return this.category !== BespokeRequestCategory.other;
    },
  })
  contentLink?: string;

  @Prop({
    type: Number,
    min: 0,
    required: function (this: any) {
      return this.category !== BespokeRequestCategory.other;
    },
  })
  budget?: number;

  @Prop({
    type: String,
    default: 'worldwide',
    required: function (this: any) {
      return this.category !== BespokeRequestCategory.other;
    },
  })
  targetTerritories?: string;

  @Prop({ type: String, required: false })
  extraBriefs?: string;

  // other-only
  @Prop({
    type: String,
    required: function (this: any) {
      return this.category === BespokeRequestCategory.other;
    },
  })
  brief?: string;
}

export const BespokeCampaignRequestSchema = SchemaFactory.createForClass(BespokeCampaignRequest);
