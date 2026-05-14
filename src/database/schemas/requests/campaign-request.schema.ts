import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {
    CampaignRequestStatus,
} from "../../../common/types/request-for-admin/request-for-admin.types";
import {HydratedDocument, Types} from "mongoose";
import {Client} from "../users/client.schema";
import {Campaign} from "../campaign/campaign.schema";
import {RequestForAdmin} from "./request-for-admin.schema";

export type CampaignAdminRequestDocument = HydratedDocument<
    RequestForAdmin & CampaignAdminRequest
>;

@Schema()
export class CampaignAdminRequest {
    @Prop({
        required: true,
        type: String,
        enum: Object.values(CampaignRequestStatus),
        default: CampaignRequestStatus.WAITING_FOR_ADMIN,
        index: true,
    })
    status: CampaignRequestStatus;

    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: Client.name,
        index: true,
    })
    clientId: Types.ObjectId;

    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: Campaign.name,
        index: true,
    })
    campaignId: Types.ObjectId;
}

export const CampaignAdminRequestSchema = SchemaFactory.createForClass(CampaignAdminRequest);

CampaignAdminRequestSchema.index({ clientId: 1, campaignId: 1, status: 1 }, { unique: true });
CampaignAdminRequestSchema.index({ clientId: 1, status: 1 });
CampaignAdminRequestSchema.index({ campaignId: 1, status: 1 });