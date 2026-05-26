import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {
    RequestForAdminType, RequestLifecycleState,
    RequestSpecifiedStatus
} from "../../../common/types/request-for-admin/request-for-admin.types";
import {Types} from "mongoose";
import {Influencer} from "../users/influencer.schema";

@Schema()
export class NewInfluencerAdminRequest {
    @Prop({
        required: true,
        type: String,
        enum: Object.values(RequestSpecifiedStatus),
        default: RequestSpecifiedStatus.WAITING_FOR_ADMIN,
        index: true,
    })
    specifiedStatus: RequestSpecifiedStatus;

    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: Influencer.name,
        index: true,
    })
    influencerId: Types.ObjectId;

    @Prop({
        type: String,
        trim: true,
        maxlength: 1000,
        required: function (this: NewInfluencerAdminRequest) {
            return this.specifiedStatus === RequestSpecifiedStatus.REJECTED;
        },
    })
    rejectionReason?: string;
}

export const NewInfluencerAdminRequestSchema = SchemaFactory.createForClass(NewInfluencerAdminRequest);

NewInfluencerAdminRequestSchema.index(
    {influencerId: 1, lifecycleStatus: 1},
    {
        unique: true,
        partialFilterExpression: {
            type: RequestForAdminType.NEW_INFLUENCER_REQUEST,
            lifecycleStatus: RequestLifecycleState.OPEN,
        }
    }
);