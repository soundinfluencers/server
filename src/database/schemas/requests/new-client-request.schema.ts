import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {HydratedDocument, Schema as MongooseSchema, Types} from 'mongoose';
import {Client} from '../users/client.schema';
import {
    NewClientRequestStatus,
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
        enum: Object.values(NewClientRequestStatus),
        default: NewClientRequestStatus.WAITING_FOR_ADMIN,
        index: true,
    })
    status: NewClientRequestStatus;

    @Prop({
        required: true,
        type: MongooseSchema.Types.ObjectId,
        ref: Client.name,
        index: true,
    })
    clientId: Types.ObjectId;

    @Prop({
        type: String,
        trim: true,
        maxlength: 1000,
        required: function (this: NewClientAdminRequest) {
            return this.status === NewClientRequestStatus.REJECTED;
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