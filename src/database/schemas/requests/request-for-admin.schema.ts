import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {HydratedDocument, Types} from "mongoose";
import {
    RequestForAdminType, RequestGroup,
    RequestLifecycleState,
    RequestSpecifiedStatus
} from "../../../common/types/request-for-admin/request-for-admin.types";
import {Role} from "../../../common/types/user.types";

export type RequestForAdminDocument = HydratedDocument<RequestForAdmin>;

@Schema({
    timestamps: true,
    collection: 'admin_requests',
    discriminatorKey: 'type',
    strict: 'throw',
})
export class RequestForAdmin {
    @Prop({type: Types.ObjectId, auto: true})
    _id: Types.ObjectId;

    @Prop({
        required: true,
        type: String,
        enum: Object.values(RequestGroup),
        immutable: true,
        index: true,
    })
    group: RequestGroup;

    @Prop({
        required: true,
        type: String,
        enum: Object.values(RequestForAdminType),
        immutable: true,
        index: true,
    })
    type: RequestForAdminType;

    @Prop({
        required: true,
        type: String,
        enum: Object.values(RequestLifecycleState),
        default: RequestLifecycleState.OPEN,
        index: true,
    })
    lifecycleStatus: RequestLifecycleState;

    @Prop({
        required: true,
        type: String,
        enum: Object.values(RequestSpecifiedStatus),
        default: RequestSpecifiedStatus.WAITING_FOR_ADMIN,
        index: true,
    })
    specifiedStatus: RequestSpecifiedStatus;

    @Prop({
        type: String,
        required: true,
    })
    userFirstName: string;

    @Prop({
        type: String,
        enum: Role,
        required: true,
    })
    userRole: Role;

    @Prop({
        type: Date,
    })
    reviewedAt?: Date;

    @Prop({
        type: String,
        default: '',
        trim: true,
        maxlength: 1000,
    })
    adminNote?: string;

    createdAt: Date;
    updatedAt: Date;
}

export const RequestForAdminSchema =
    SchemaFactory.createForClass(RequestForAdmin);

RequestForAdminSchema.index({ type: 1, group: 1, state: 1, createdAt: -1 });
