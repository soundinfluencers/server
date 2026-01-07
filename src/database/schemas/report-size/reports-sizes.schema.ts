import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {Types} from 'mongoose';

@Schema()
export class UserSize {
    @Prop({ type: Types.ObjectId })
    _id: Types.ObjectId;

    @Prop({ type: Types.ObjectId })
    userId: Types.ObjectId;

    @Prop({ type: Map, of: Number, default: {} })
    columnSizes: Map<string, number>;
}

export const UserSizeSchema = SchemaFactory.createForClass(UserSize);

@Schema({
  timestamps: true,
})
export class ReportSizes {
  @Prop({ type: Types.ObjectId })
  campaignId: Types.ObjectId;

  @Prop({ type: [UserSizeSchema], default: [] })
  userSizes: UserSize[];

  @Prop()
  readonly createdAt?: Date;

  @Prop()
  readonly updatedAt?: Date;
}

export const ReportSizesSchema = SchemaFactory.createForClass(ReportSizes);
