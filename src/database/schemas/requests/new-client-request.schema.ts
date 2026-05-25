import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {HydratedDocument, Types} from 'mongoose';
import {Client} from '../users/client.schema';
import {
    RequestSpecifiedStatus,
    RequestForAdminType,
    RequestLifecycleState,
} from '../../../common/types/request-for-admin/request-for-admin.types';
import {RequestForAdmin} from "./request-for-admin.schema";

export type NewClientAdminRequestDocument = HydratedDocument<
    RequestForAdmin & NewClientAdminRequest
>;

@Schema()
export class NewClientAdminRequest {
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
        ref: Client.name,
        index: true,
    })
    clientId: Types.ObjectId;

    @Prop({
        type: String,
        trim: true,
        maxlength: 1000,
        required: function (this: NewClientAdminRequest) {
            return this.specifiedStatus === RequestSpecifiedStatus.REJECTED;
        },
    })
    rejectionReason?: string;
}

export const NewClientAdminRequestSchema =
    SchemaFactory.createForClass(NewClientAdminRequest);

NewClientAdminRequestSchema.index(
    {
        clientId: 1,
        state: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            type: RequestForAdminType.NEW_CLIENT_REQUEST,
            state: RequestLifecycleState.OPEN,
        },
    },
);