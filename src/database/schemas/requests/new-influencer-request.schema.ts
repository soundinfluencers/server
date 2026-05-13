import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Influencer } from '../users/influencer.schema';
import {
    NewInfluencerRequestStatus,
    RequestForAdminType,
    RequestLifecycleState,
} from '../../../common/types/request-for-admin/request-for-admin.types';
import {RequestForAdmin} from "./request-for-admin.schema";

export type NewInfluencerAdminRequestDocument = HydratedDocument<
    RequestForAdmin & NewInfluencerAdminRequest
>;

@Schema()
export class NewInfluencerAdminRequest {
    @Prop({
        required: true,
        type: String,
        enum: Object.values(NewInfluencerRequestStatus),
        default: NewInfluencerRequestStatus.WAITING_FOR_ADMIN,
        index: true,
    })
    status: NewInfluencerRequestStatus;

    @Prop({
        required: true,
        type: MongooseSchema.Types.ObjectId,
        ref: Influencer.name,
        index: true,
    })
    influencerId: Types.ObjectId;

    @Prop({
        type: String,
        trim: true,
        maxlength: 1000,
        required: function (this: NewInfluencerAdminRequest) {
            return this.status === NewInfluencerRequestStatus.REJECTED;
        },
    })
    rejectionReason?: string;
}

export const NewInfluencerAdminRequestSchema =
    SchemaFactory.createForClass(NewInfluencerAdminRequest);

NewInfluencerAdminRequestSchema.index(
    {
        influencerId: 1,
        state: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            type: RequestForAdminType.NEW_INFLUENCER_REQUEST,
            state: RequestLifecycleState.OPEN,
        },
    },
);