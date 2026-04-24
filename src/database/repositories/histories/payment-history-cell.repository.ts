import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {PaymentHistoryCell} from "../../schemas/histories/payment-history-cell.schema";
import {
    PaymentHistoryAdminOverrideStatusEnum,
    PaymentHistoryEffectiveStatusEnum,
    PaymentHistoryProjection,
    PaymentHistorySystemStatusEnum
} from "../../../common/types/history.types";
import {ClientSession, DeleteResult, Model, PipelineStage, Types, UpdateWriteOpResult} from "mongoose";
import {InjectModel} from "@nestjs/mongoose";
import {ObjId} from "../../../common/types/base.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {CampaignStatusEnum} from "../../../common/types/client/campaign.types";
import {
    PaymentHistoryAccountCursor,
    PaymentHistoryCampaignCursor
} from "../../../modules/admin/services/admin-payments-history.service";

export type PaymentHistoryCampaignHeaderRow = {
    campaignId: ObjId;
    campaignName: string;
    campaignCreatedAt: Date;
    campaignStatus: CampaignStatusEnum;
};

export type PaymentHistoryAccountRow = {
    influencerId: ObjId;
    accountId: ObjId;
    username: string;
    logoUrl?: string;
    // influencerName: string;
    // followers: number;
};

export type PaymentHistoryViewportCellRow = {
    campaignId: ObjId;
    accountId: ObjId;
    effectiveStatus: PaymentHistoryEffectiveStatusEnum;
    systemStatus: PaymentHistorySystemStatusEnum;
    adminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;
};

// Interface for payment history cell repository
interface IPaymentHistoryCellRepository {
    // Upsert one by campaignId + accountId key
    upsertOneByBusinessKey(cellDocument: PaymentHistoryProjection, session?: ClientSession): Promise<UpdateWriteOpResult>;

    // Update statuses in specified cells by cellId
    updateCellStatuses(cells: {
        cellId: ObjId;
        systemStatus: PaymentHistorySystemStatusEnum;
        effectiveStatus: PaymentHistoryEffectiveStatusEnum;
        adminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;
        adminOverrideBy?: ObjId;
        adminOverrideAt?: Date
    }[], session?: ClientSession): Promise<any>

    // Clear admin override by cellId
    clearAdminOverrideById(
        cellId: ObjId,
        newEffectiveStatus: PaymentHistoryEffectiveStatusEnum,
        session?: ClientSession
    ): Promise<UpdateWriteOpResult>

    // Delete all cells by campaignId
    deleteManyByCampaignId(campaignId: string | ObjId, session?: ClientSession): Promise<DeleteResult>;

    // Get cursor paginated campaign headers
    getCampaignHeadersPage(params: {
        take: number;
        cursor?: PaymentHistoryCampaignCursor | null;
        search?: string;
        socialMedia?: SocialMediaEnum | 'multipromo';
        effectiveStatus?: PaymentHistoryEffectiveStatusEnum;
    }): Promise<PaymentHistoryCampaignHeaderRow[]>;

    // Get cursor paginated account headers
    getAccountRowsPage(params: {
        campaignIds: ObjId[];
        take: number;
        cursor?: PaymentHistoryAccountCursor | null;
        search?: string;
        socialMedia?: SocialMediaEnum;
        effectiveStatus?: PaymentHistoryEffectiveStatusEnum;
    }): Promise<PaymentHistoryAccountRow[]>;

    findViewportCells(params: {
        campaignIds: ObjId[];
        accountIds: ObjId[];
    }): Promise<PaymentHistoryViewportCellRow[]>
}

@Injectable()
export class PaymentHistoryCellRepository extends BaseRepository<PaymentHistoryCell> implements IPaymentHistoryCellRepository {
    constructor(
        @InjectModel(PaymentHistoryCell.name) private readonly paymentHistoryCellModel: Model<PaymentHistoryCell>
    ) {
        super(paymentHistoryCellModel);
    }

    // Upsert one by campaignId + accountId key
    upsertOneByBusinessKey(cellDocument: PaymentHistoryProjection, session?: ClientSession): Promise<UpdateWriteOpResult> {
        return this.paymentHistoryCellModel.updateOne(
            {
                campaignId: cellDocument.campaignId,
                accountId: cellDocument.accountId,
            },
            {$set: cellDocument},
            {
                session,
                upsert: true
            }
        );
    }

    // Update cell statuses by cellId
    async updateCellStatuses(
        cells: {
            cellId: ObjId;
            systemStatus: PaymentHistorySystemStatusEnum;
            effectiveStatus: PaymentHistoryEffectiveStatusEnum;
            adminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;
            adminOverrideBy?: ObjId;
            adminOverrideAt?: Date;
        }[],
        session?: ClientSession,
    ): Promise<any> {
        if (!cells.length) {
            return {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
            };
        }

        const operations = cells.map((cell) => {
            const $set: Record<string, any> = {
                systemStatus: cell.systemStatus,
                effectiveStatus: cell.effectiveStatus,
            };

            const $unset: Record<string, any> = {};

            if (cell.adminOverrideStatus !== undefined) {
                $set.adminOverrideStatus = cell.adminOverrideStatus;
            } else {
                $unset.adminOverrideStatus = 1;
            }

            if (cell.adminOverrideBy !== undefined) {
                $set.adminOverrideBy = cell.adminOverrideBy;
            } else {
                $unset.adminOverrideBy = 1;
            }

            if (cell.adminOverrideAt !== undefined) {
                $set.adminOverrideAt = cell.adminOverrideAt;
            } else {
                $unset.adminOverrideAt = 1;
            }

            const update: Record<string, any> = { $set };

            if (Object.keys($unset).length > 0) {
                update.$unset = $unset;
            }

            return {
                updateOne: {
                    filter: { _id: cell.cellId },
                    update,
                },
            };
        });

        return this.paymentHistoryCellModel.bulkWrite(operations, { session });
    }

    // Clear admin override by cellId
    clearAdminOverrideById(
        cellId: ObjId,
        newEffectiveStatus: PaymentHistoryEffectiveStatusEnum,
        session?: ClientSession
    ): Promise<UpdateWriteOpResult> {
        return this.paymentHistoryCellModel.updateOne(
            { _id: cellId },
            {
                $unset: {
                    adminOverrideStatus: 1,
                    adminOverrideBy: 1,
                    adminOverrideAt: 1,
                },
                $set: {
                    effectiveStatus: newEffectiveStatus,
                }
            },
            { session }
        );
    }

    // Delete all cells by campaignId
    deleteManyByCampaignId(campaignId: string | ObjId, session?: ClientSession): Promise<DeleteResult> {
        const id = new ObjId(campaignId);
        return this.paymentHistoryCellModel.deleteMany({campaignId: id}, {session});
    }

    // Get cursor paginated campaign headers
    async getCampaignHeadersPage(params: {
        take: number;
        cursor?: PaymentHistoryCampaignCursor | null;
        search?: string;
        socialMedia?: SocialMediaEnum | 'multipromo';
        effectiveStatus?: PaymentHistoryEffectiveStatusEnum;
    }): Promise<PaymentHistoryCampaignHeaderRow[]> {
        const { take, cursor, search, socialMedia, effectiveStatus } = params;

        const matchStage: Record<string, any> = {};

        if (socialMedia) {
            matchStage.socialMedia = socialMedia;
        }

        if (effectiveStatus) {
            matchStage.effectiveStatus = effectiveStatus;
        }

        if (search?.trim()) {
            matchStage.campaignName = {
                $regex: search.trim(),
                $options: 'i',
            };
        }

        const pipeline: PipelineStage[] = [];

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({
                $match: matchStage,
            });
        }

        pipeline.push({
            $group: {
                _id: '$campaignId',
                campaignId: { $first: '$campaignId' },
                campaignName: { $first: '$campaignName' },
                campaignCreatedAt: { $first: '$campaignCreatedAt' },
                campaignStatus: { $first: '$campaignStatus' },
            },
        });

        if (cursor) {
            pipeline.push({
                $match: {
                    $or: [
                        {
                            campaignCreatedAt: { $lt: cursor.campaignCreatedAt },
                        },
                        {
                            campaignCreatedAt: cursor.campaignCreatedAt,
                            campaignId: { $lt: new ObjId(cursor.campaignId) },
                        },
                    ],
                },
            });
        }

        pipeline.push(
            {
                $sort: {
                    campaignCreatedAt: -1,
                    campaignId: -1,
                },
            },
            {
                $limit: take + 1,
            },
            {
                $project: {
                    _id: 0,
                    campaignId: 1,
                    campaignName: 1,
                    campaignCreatedAt: 1,
                    campaignStatus: 1,
                },
            },
        );

        return this.paymentHistoryCellModel.aggregate<PaymentHistoryCampaignHeaderRow>(pipeline);
    }

    async getAccountRowsPage(params: {
        campaignIds: ObjId[];
        take: number;
        cursor?: PaymentHistoryAccountCursor | null;
        search?: string;
        socialMedia?: SocialMediaEnum;
        effectiveStatus?: PaymentHistoryEffectiveStatusEnum;
    }): Promise<PaymentHistoryAccountRow[]> {
        const { campaignIds, take, cursor, search, socialMedia, effectiveStatus } = params;

        if (!campaignIds.length) {
            return [];
        }

        const matchStage: Record<string, any> = {
            campaignId: { $in: campaignIds },
        };

        if (socialMedia) {
            matchStage.socialMedia = socialMedia;
        }

        if (effectiveStatus) {
            matchStage.effectiveStatus = effectiveStatus;
        }

        if (search?.trim()) {
            matchStage.username = {
                $regex: search.trim(),
                $options: 'i',
            };
        }

        const pipeline: PipelineStage[] = [
            {
                $match: matchStage,
            },
            {
                $group: {
                    _id: '$accountId',
                    accountId: { $first: '$accountId' },
                    influencerId: { $first: '$influencerId' },
                    username: { $first: '$username' },
                    logoUrl: { $first: 'logoUrl' },
                },
            },
        ];

        if (cursor) {
            pipeline.push({
                $match: {
                    accountId: { $lt: new ObjId(cursor.accountId) },
                },
            });
        }

        pipeline.push(
            {
                $sort: {
                    accountId: -1,
                },
            },
            {
                $limit: take + 1,
            },
            {
                $project: {
                    _id: 0,
                    influencerId: 1,
                    accountId: 1,
                    username: 1,
                    logoUrl: 1,
                },
            },
        );

        return this.paymentHistoryCellModel.aggregate<PaymentHistoryAccountRow>(pipeline);
    }

    async findViewportCells(params: {
        campaignIds: ObjId[];
        accountIds: ObjId[];
    }): Promise<PaymentHistoryViewportCellRow[]> {
        const { campaignIds, accountIds } = params;

        if (!campaignIds.length || !accountIds.length) {
            return [];
        }

        return this.paymentHistoryCellModel.find(
            {
                campaignId: { $in: campaignIds },
                accountId: { $in: accountIds },
            },
            {
                campaignId: 1,
                accountId: 1,
                influencerId: 1,
                effectiveStatus: 1,
                systemStatus: 1,
                adminOverrideStatus: 1,
            },
        ).lean<PaymentHistoryViewportCellRow[]>();
    }
}