import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { UserSizes, UserSizesSchema } from '../entities/users-sizes.entity';

@Schema({
  timestamps: true,
})
export class ReportSizes {
  @Prop({ type: Types.ObjectId })
  campaignId: Types.ObjectId;

  @Prop({ type: [UserSizesSchema], default: [] })
  userSizes: UserSizes[];

  @Prop()
  readonly createdAt?: Date;

  @Prop()
  readonly updatedAt?: Date;
}

export const ReportSizesSchema = SchemaFactory.createForClass(ReportSizes);
