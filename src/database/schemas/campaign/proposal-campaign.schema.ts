import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import {Types} from 'mongoose';
import {
    CampaignAdminMeta, CampaignAdminMetaSchema,
} from "./campaign.schema";
import {Role} from "../../../common/types/user.types";
import {SocialMediaEnum, SocialMediaType} from "../../../common/types/social-media.types";

@Schema({ timestamps: true })
export class ProposalCampaign {
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({ type: Number, default: 2, index: true, required: false })
    schemaVersion: number;

    @Prop({ required: true, type: Types.ObjectId })
    creatorId: Types.ObjectId;

    @Prop({ required: true, enum: Role, type: String })
    creatorRole: Role;

    @Prop({ required: true, enum: [...Object.values(SocialMediaEnum), "multipromo"], default: SocialMediaEnum.instagram })
    socialMedia: SocialMediaType | "multipromo";

    @Prop({ required: true })
    campaignName: string;

    @Prop({ required: true, type: [Types.ObjectId] })
    optionsIds: Types.ObjectId[];

    @Prop({ required: false, type: [String] })
    hiddenColumns?: string[];

    @Prop({ required: false, type: CampaignAdminMetaSchema })
    adminMeta?: CampaignAdminMeta;

    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}

export const ProposalCampaignSchema = SchemaFactory.createForClass(ProposalCampaign);

ProposalCampaignSchema.index({ optionsIds: 1 });
ProposalCampaignSchema.index({ socialMedia: 1, createdAt: -1 });