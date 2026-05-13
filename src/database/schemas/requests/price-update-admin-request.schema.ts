import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Influencer } from '../users/influencer.schema';
import {
    PriceUpdateRequestStatus,
    RequestForAdminType,
    RequestLifecycleState,
} from '../../../common/types/request-for-admin/request-for-admin.types';
import {RequestForAdmin} from "./request-for-admin.schema";

export type PriceUpdateAdminRequestDocument = HydratedDocument<
    RequestForAdmin & PriceUpdateAdminRequest
>;

@Schema()
export class PriceUpdateAdminRequest {
    @Prop({
        required: true,
        type: String,
        enum: Object.values(PriceUpdateRequestStatus),
        default: PriceUpdateRequestStatus.WAITING_FOR_ADMIN,
        index: true,
    })
    status: PriceUpdateRequestStatus;

    @Prop({
        required: true,
        type: MongooseSchema.Types.ObjectId,
        ref: Influencer.name,
        index: true,
    })
    influencerId: Types.ObjectId;

    @Prop({
        required: true,
        type: MongooseSchema.Types.ObjectId,
        index: true,
        // ref: SocialAccount.name,
    })
    socialAccountId: Types.ObjectId;

    @Prop({
        required: true,
        type: Number,
        min: 0,
    })
    oldPrice: number;

    @Prop({
        required: true,
        type: Number,
        min: 0,
        validate: {
            validator: function (this: PriceUpdateAdminRequest, value: number) {
                return value !== this.oldPrice;
            },
            message: 'newPrice must be different from oldPrice',
        },
    })
    newPrice: number;

    @Prop({
        required: true,
        type: String,
        trim: true,
        uppercase: true,
        minlength: 3,
        maxlength: 3,
        default: 'USD',
    })
    currency: string;

    @Prop({
        type: String,
        trim: true,
        maxlength: 1000,
        required: function (this: PriceUpdateAdminRequest) {
            return this.status === PriceUpdateRequestStatus.REJECTED;
        },
    })
    rejectionReason?: string;
}

export const PriceUpdateAdminRequestSchema =
    SchemaFactory.createForClass(PriceUpdateAdminRequest);

PriceUpdateAdminRequestSchema.index(
    {
        socialAccountId: 1,
        state: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            type: RequestForAdminType.PRICE_UPDATE_REQUEST,
            state: RequestLifecycleState.OPEN,
        },
    },
);