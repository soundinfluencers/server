import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CampaignStatusEnum } from '../../../common/types/client/campaign.types';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { InvoiceStatusEnum } from '../../../common/types/invoice.types';
import {
    PaymentHistoryAdminOverrideStatusEnum, PaymentHistoryEffectiveStatusEnum,
    PaymentHistorySystemStatusEnum
} from "../../../common/types/history.types";

export type PaymentHistoryCampaignSource = 'campaign' | 'completed';

@Schema({ timestamps: true, collection: 'paymenthistorycells' })
export class PaymentHistoryCell {
    @Prop({ type: Types.ObjectId })
    _id: Types.ObjectId;

    @Prop({ type: String, enum: ['campaign', 'completed'], required: true })
    campaignSource: PaymentHistoryCampaignSource;

    @Prop({ type: Types.ObjectId, required: true, index: true })
    campaignId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, required: true, index: true })
    accountId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, required: true, index: true })
    influencerId: Types.ObjectId;

    @Prop({ type: String, required: true })
    campaignName: string;

    @Prop({ type: Date, required: true, index: true })
    campaignCreatedAt: Date;

    @Prop({ type: String, enum: CampaignStatusEnum, required: true })
    campaignStatus: CampaignStatusEnum;

    @Prop({ type: String, enum: SocialMediaEnum, required: true, index: true })
    socialMedia: SocialMediaEnum;

    @Prop({ type: String, required: true, index: true })
    username: string;

    @Prop({ type: Number, required: true, min: 0 })
    price: number;

    @Prop({ type: Number, required: false, min: 0 })
    followers?: number;

    @Prop({ type: String, enum: InvoiceStatusEnum, required: false, index: true })
    invoiceStatus?: InvoiceStatusEnum;

    @Prop({ type: String, required: true, index: true })
    influencerName: string;

    @Prop({ type: String, required: false })
    influencerEmail?: string;

    @Prop({ type: String, required: false })
    influencerLogoUrl?: string;

    @Prop({
        type: String,
        enum: PaymentHistorySystemStatusEnum,
        required: true,
        index: true,
    })
    systemStatus: PaymentHistorySystemStatusEnum;

    @Prop({
        type: String,
        enum: PaymentHistoryAdminOverrideStatusEnum,
        required: false,
        index: true,
    })
    adminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;

    @Prop({
        type: String,
        enum: PaymentHistoryEffectiveStatusEnum,
        required: true,
        index: true,
    })
    effectiveStatus: PaymentHistoryEffectiveStatusEnum;

    @Prop({ type: Types.ObjectId, required: false })
    adminOverrideBy?: Types.ObjectId;

    @Prop({ type: Date, required: false })
    adminOverrideAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

export const PaymentHistoryCellSchema = SchemaFactory.createForClass(PaymentHistoryCell);

PaymentHistoryCellSchema.index(
    { campaignId: 1, accountId: 1 },
    { unique: true },
);
PaymentHistoryCellSchema.index({ campaignId: 1, accountId: 1 });
PaymentHistoryCellSchema.index({ campaignCreatedAt: -1, campaignId: 1 });
PaymentHistoryCellSchema.index({ username: 1, accountId: 1 });
PaymentHistoryCellSchema.index({ influencerId: 1, accountId: 1 });
PaymentHistoryCellSchema.index({ socialMedia: 1, accountId: 1 });
PaymentHistoryCellSchema.index({ effectiveStatus: 1 });