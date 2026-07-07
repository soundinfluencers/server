import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({
    timestamps: true,
})
export class Bundle {
    _id: Types.ObjectId

    @Prop({ type: Types.ObjectId, required: true })
    influencerId: Types.ObjectId;

    @Prop({ type: Number, required: true })
    price: number;

    createdAt: Date;
    updatedAt: Date;
}

export const BundleSchema = SchemaFactory.createForClass(Bundle);

BundleSchema.index({ influencerId: 1, createdAt: -1 });