import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Types} from "mongoose";

@Schema()
export class UserSizes {
    @Prop({ type: Types.ObjectId })
    _id: Types.ObjectId;

    @Prop({ type: Types.ObjectId })
    userId: Types.ObjectId;

    @Prop({ type: Map, of: Number, default: {} })
    columnSizes: Map<string, number>;
}

export const UserSizesSchema = SchemaFactory.createForClass(UserSizes);