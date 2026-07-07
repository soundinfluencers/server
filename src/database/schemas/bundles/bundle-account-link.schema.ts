import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { SocialMediaEnum } from "src/common/types/social-media.types";

@Schema({
    timestamps: false,
})
export class BundleAccountLink {
    _id: Types.ObjectId

    @Prop({ type: Types.ObjectId, required: true })
    bundleId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, required: true })
    influencerId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, required: true })
    accountId: Types.ObjectId;

    @Prop({ type: String, enum: SocialMediaEnum, required: true })
    socialMedia: SocialMediaEnum;
}

export const BundleAccountLinkSchema = SchemaFactory.createForClass(BundleAccountLink);

BundleAccountLinkSchema.index(
    { bundleId: 1, influencerId: 1, socialMedia: 1, accountId: 1 },
    { unique: true }
);
BundleAccountLinkSchema.index({ influencerId: 1, socialMedia: 1, accountId: 1 });