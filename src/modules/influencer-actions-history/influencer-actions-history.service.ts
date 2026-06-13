import {BadRequestException, Injectable, Logger, NotFoundException} from '@nestjs/common';
import mongoose, {ClientSession, Types} from 'mongoose';
import {UpsertCampaignActionDto, UpsertCampaignActionsDto, UpsertInvoiceActionDto} from "./dto/upsert-actions.dto";
import {InfluencerHistoryRepository} from "../../database/repositories/histories/influencer-history.repository";
import {SocialAccountMigrationContext} from "../migrations/types/migrations.types";
import {
    CampaignActionWithCampaignMeta,
} from "./types/influencer-history.types";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {
    CampaignAction,
    InfluencerActionsHistory, InvoiceAction
} from "../../database/schemas/histories/influencer-actions-history.schema";
import {
    GetAllHistoriesQueryDto,
    GetCurrentUserCampaignsHistoryQueryDto,
    HistoryCampaignItemForProcessedHistory
} from "./dto/get-history.dto";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {
    HistoryCampaignActionStatus,
    HistoryCampaignActionStatusLabel
} from "../../common/types/influencer/influencer.types";
import {formatDate} from "../../common/utils/formatters";
import {CampaignRepository} from "../../database/repositories/campaigns/campaign.repository";
import {CompletedCampaignRepository} from "../../database/repositories/campaigns/completed-campaign.repository";

@Injectable()
export class InfluencerActionsHistoryService {
    private readonly logger = new Logger();

    constructor(
        private readonly influencerRepo: InfluencerRepository,
        private readonly influencerHistoryRepo: InfluencerHistoryRepository,
        private readonly campaignRepo: CampaignRepository,
        private readonly completedCampaignRepo: CompletedCampaignRepository,
    ) {
    }

    // Upserts new campaign action to influencer's history
    async upsertInfluencerCampaignActionsHistory(data: UpsertCampaignActionDto, session?: ClientSession): Promise<void> {
        const {influencerId, campaignId, campaignName, updatedCampaignAction} = data;

        if (!updatedCampaignAction) throw new BadRequestException("Missing campaign action");

        const influencer = await this.influencerRepo.findById(influencerId, {session}).select('email balance');

        if (!influencer) throw new NotFoundException(`Influencer ${influencerId} not found`);

        const {email, balance} = influencer;

        const {actionNumber, networkUsername, rewardForInfluencer, socialMedia, socialAccountId, addedAccountsId} = updatedCampaignAction;

        const action: CampaignAction = {
            addedAccountsId,
            socialAccountId,
            actionNumber,
            networkUsername,
            rewardForInfluencer,
            socialMedia: socialMedia as SocialMediaEnum,
            currentBalance: actionNumber === 3 ? balance + rewardForInfluencer : balance,
            date: new Date()
        };

        const updateResult = await this.influencerHistoryRepo.findOneAndUpdate(
            {
                influencerId: new mongoose.Types.ObjectId(influencerId),
                'campaigns.campaignId': new Types.ObjectId(campaignId),
            },
            {
                $push: {
                    'campaigns.$.actions': action,
                },
            },
            {
                new: true,
                session: session
            },
        );

        if (!updateResult) {
            await this.influencerHistoryRepo.findOneAndUpdate(
                {
                    influencerId: new mongoose.Types.ObjectId(influencerId),
                },
                {
                    $push: {
                        campaigns: {
                            campaignId: new Types.ObjectId(campaignId),
                            campaignName,
                            actions: [action],
                        },
                    },
                    $setOnInsert: {
                        influencerEmail: email,
                    },
                },
                {
                    new: true,
                    upsert: true,
                    session
                },
            );
        }
    };

    async upsertInfluencerCampaignActionsHistoryMany(
        data: UpsertCampaignActionsDto,
        session?: ClientSession,
    ): Promise<void> {
        const { influencerId, updatedCampaignActions } = data;

        if (!updatedCampaignActions?.length) {
            throw new BadRequestException('Missing campaign actions');
        }

        const influencer = await this.influencerRepo
            .findById(influencerId, { session })
            .select('email balance');

        if (!influencer) {
            throw new NotFoundException(`Influencer ${influencerId} not found`);
        }

        const { email, balance } = influencer;
        const influencerObjectId = new Types.ObjectId(influencerId);

        const groupedActions = new Map<
            string,
            {
                campaignId: string;
                campaignName: string;
                actions: CampaignAction[];
            }
        >();

        for (const updatedCampaignAction of updatedCampaignActions) {
            const {
                campaignId,
                campaignName,
                actionNumber,
                networkUsername,
                rewardForInfluencer,
                socialMedia,
                socialAccountId,
                addedAccountsId,
            } = updatedCampaignAction;

            const action: CampaignAction = {
                addedAccountsId,
                socialAccountId,
                actionNumber,
                networkUsername,
                rewardForInfluencer,
                socialMedia: socialMedia as SocialMediaEnum,
                currentBalance: 0,
                date: new Date(),
            };

            const key = campaignId;

            if (!groupedActions.has(key)) {
                groupedActions.set(key, {
                    campaignId,
                    campaignName,
                    actions: [action],
                });
            } else {
                groupedActions.get(key)!.actions.push(action);
            }
        }

        for (const group of groupedActions.values()) {
            const updateResult = await this.influencerHistoryRepo.findOneAndUpdate(
                {
                    influencerId: influencerObjectId,
                    'campaigns.campaignId': new Types.ObjectId(group.campaignId),
                },
                {
                    $push: {
                        'campaigns.$.actions': {
                            $each: group.actions,
                        },
                    },
                },
                {
                    new: true,
                    session: session ?? undefined,
                },
            );

            if (!updateResult) {
                await this.influencerHistoryRepo.findOneAndUpdate(
                    {
                        influencerId: influencerObjectId,
                    },
                    {
                        $push: {
                            campaigns: {
                                campaignId: new Types.ObjectId(group.campaignId),
                                campaignName: group.campaignName,
                                actions: group.actions,
                            },
                        },
                        $setOnInsert: {
                            influencerId: influencerObjectId,
                            influencerEmail: email,
                        },
                    },
                    {
                        new: true,
                        upsert: true,
                        session: session ?? undefined,
                    },
                );
            }
        }
    }

    // Upserts new invoice action to influencer's history
    async upsertInfluencerInvoiceHistory(
        data: UpsertInvoiceActionDto,
        session?: ClientSession,
    ): Promise<void> {
        const { influencerId, invoiceId, paymentMethod, currentBalance, amount } = data;

        if (!influencerId || !invoiceId || !paymentMethod || amount === undefined || amount === null) {
            throw new BadRequestException('Not enough arguments');
        }

        const action: InvoiceAction = {
            invoiceId: new Types.ObjectId(invoiceId),
            amount,
            paymentMethod,
            currentBalance,
            date: new Date(),
        };

        const updateResult = await this.influencerHistoryRepo.findOneAndUpdate(
            { influencerId: new mongoose.Types.ObjectId(influencerId) },
            { $push: { invoices: action } },
            { new: true, session: session ?? undefined },
        );

        if (!updateResult) {
            const influencer = await this.influencerRepo
                .findById(influencerId)
                .select('email')
                .lean();

            if (!influencer?.email) {
                throw new NotFoundException(`Influencer ${influencerId} not found`);
            }

            await this.influencerHistoryRepo.findOneAndUpdate(
                { influencerId: new mongoose.Types.ObjectId(influencerId) },
                {
                    $setOnInsert: {
                        influencerEmail: influencer.email,
                        influencerId: new mongoose.Types.ObjectId(influencerId),
                    },
                    $push: { invoices: action },
                },
                {
                    new: true,
                    upsert: true,
                    session: session ?? undefined,
                },
            );
        }
    }

    // Returns current influencer's campaigns history
    async getCurrentUserCampaignHistory(
        data: GetCurrentUserCampaignsHistoryQueryDto,
    ): Promise<HistoryCampaignItemForProcessedHistory[]> {
        const page = Math.max((data.page ?? 1), 1);
        const limit = Math.max((data.limit ?? 20), 1);
        const skip = (page - 1) * limit;

        const influencerIdObj = new Types.ObjectId(data.influencerId);

        const rawLatestByPromo = await this.influencerHistoryRepo.aggregate([
            { $match: { influencerId: influencerIdObj } },

            { $unwind: { path: '$campaigns', preserveNullAndEmptyArrays: false } },
            { $unwind: { path: '$campaigns.actions', preserveNullAndEmptyArrays: false } },

            {
                $addFields: {
                    campaignIdObj: {
                        $cond: [
                            { $eq: [{ $type: '$campaigns.campaignId' }, 'objectId'] },
                            '$campaigns.campaignId',
                            { $toObjectId: '$campaigns.campaignId' },
                        ],
                    },

                    socialAccountIdObj: {
                        $cond: [
                            { $eq: [{ $type: '$campaigns.actions.socialAccountId' }, 'objectId'] },
                            '$campaigns.actions.socialAccountId',
                            {
                                $cond: [
                                    { $eq: [{ $type: '$campaigns.actions.socialAccountId' }, 'string'] },
                                    { $toObjectId: '$campaigns.actions.socialAccountId' },
                                    null,
                                ],
                            },
                        ],
                    },
                },
            },

            {
                $lookup: {
                    from: 'campaigns',
                    localField: 'campaignIdObj',
                    foreignField: '_id',
                    as: 'openCampaign',
                },
            },
            { $unwind: { path: '$openCampaign', preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: 'completedcampaigns',
                    localField: 'campaignIdObj',
                    foreignField: '_id',
                    as: 'closedCampaign',
                },
            },
            { $unwind: { path: '$closedCampaign', preserveNullAndEmptyArrays: true } },

            {
                $addFields: {
                    accountsFromCampaign: {
                        $ifNull: ['$openCampaign.addedAccounts', { $ifNull: ['$closedCampaign.addedAccounts', []] }],
                    },
                },
            },

            {
                $addFields: {
                    promoFromCampaign: {
                        $let: {
                            vars: {
                                byAccountId: {
                                    $first: {
                                        $filter: {
                                            input: '$accountsFromCampaign',
                                            as: 'acc',
                                            cond: {
                                                $and: [
                                                    { $ne: ['$$acc.accountId', null] },
                                                    { $ne: ['$socialAccountIdObj', null] },
                                                    { $eq: ['$$acc.accountId', '$socialAccountIdObj'] },
                                                ],
                                            },
                                        },
                                    },
                                },
                                byUsername: {
                                    $first: {
                                        $filter: {
                                            input: '$accountsFromCampaign',
                                            as: 'acc',
                                            cond: {
                                                $and: [
                                                    { $eq: ['$$acc.username', '$campaigns.actions.networkUsername'] },
                                                    { $eq: ['$$acc.socialMedia', '$campaigns.actions.socialMedia'] },
                                                ],
                                            },
                                        },
                                    },
                                },
                            },
                            in: { $ifNull: ['$$byAccountId', '$$byUsername'] },
                        },
                    },
                },
            },

            {
                $addFields: {
                    actionPromoIdObj: {
                        $cond: [
                            { $eq: [{ $type: '$campaigns.actions.addedAccountsId' }, 'objectId'] },
                            '$campaigns.actions.addedAccountsId',
                            {
                                $cond: [
                                    { $eq: [{ $type: '$campaigns.actions.addedAccountsId' }, 'string'] },
                                    { $toObjectId: '$campaigns.actions.addedAccountsId' },
                                    null,
                                ],
                            },
                        ],
                    },
                    resolvedAddedAccountsId: {
                        $let: {
                            vars: {
                                actionPromoId: '$actionPromoIdObj',
                                campaignPromoId: '$promoFromCampaign._id',
                            },
                            in: {
                                $cond: [
                                    {
                                        $and: [
                                            { $ne: ['$$campaignPromoId', null] },
                                            { $ne: ['$$actionPromoId', null] },
                                            { $eq: ['$$actionPromoId', '$$campaignPromoId'] },
                                        ],
                                    },
                                    '$$actionPromoId',
                                    '$$campaignPromoId',
                                ],
                            },
                        },
                    },
                },
            },

            { $match: { resolvedAddedAccountsId: { $ne: null } } },

            { $sort: { 'campaigns.actions.date': -1 } },

            {
                $group: {
                    _id: '$resolvedAddedAccountsId',
                    lastAction: { $first: '$campaigns.actions' },

                    campaignIdObj: { $first: '$campaignIdObj' },
                    campaignId: { $first: '$campaigns.campaignId' },
                    campaignName: { $first: '$campaigns.campaignName' },

                    campaignSocialMediaFromHistory: { $first: '$campaigns.actions.socialMedia' },
                    networkUsername: { $first: '$campaigns.actions.networkUsername' },
                    socialAccountId: { $first: '$campaigns.actions.socialAccountId' },
                    socialAccountIdObj: { $first: '$socialAccountIdObj' },
                },
            },

            {
                $sort: { 'lastAction.date': -1, _id: 1 }
            },

            { $skip: skip },
            { $limit: limit },

            {
                $project: {
                    _id: 0,
                    addedAccountsId: '$_id',
                    campaignIdObj: 1,
                    campaignId: 1,
                    campaignName: 1,
                    campaignSocialMediaFromHistory: 1,
                    networkUsername: 1,
                    socialAccountId: 1,
                    socialAccountIdObj: 1,

                    price: '$lastAction.rewardForInfluencer',
                    status: '$lastAction.actionNumber',
                    date: '$lastAction.date',
                    currentBalance: '$lastAction.currentBalance',

                    isStillInCampaignFromHistory: '$lastAction.isStillInCampaign',
                },
            },
        ]);

        if (!rawLatestByPromo.length) return [];

        const campaignIds: Types.ObjectId[] = rawLatestByPromo
            .map((x: any) => x.campaignIdObj)
            .filter(Boolean);

        const campaignIdStrSet = new Set(campaignIds.map(id => String(id)));
        const uniqueCampaignIds = Array.from(campaignIdStrSet).map(id => new Types.ObjectId(id));

        const [openCampaigns, closedCampaigns] = await Promise.all([
            this.campaignRepo.findMany(
                { _id: { $in: uniqueCampaignIds } },
                {
                    lean: true,
                    select: ['_id', 'socialMedia', 'addedAccounts'],
                },
            ),

            this.completedCampaignRepo.findMany(
                { _id: { $in: uniqueCampaignIds } },
                {
                    lean: true,
                    select: ['_id', 'socialMedia', 'addedAccounts'],
                },
            ),
        ]);

        const openMap = new Map<string, any>(openCampaigns.map(c => [String(c._id), c]));
        const closedMap = new Map<string, any>(closedCampaigns.map(c => [String(c._id), c]));

        const history: HistoryCampaignItemForProcessedHistory[] = rawLatestByPromo.map((item: any) => {
            const campaignIdKey = String(item.campaignIdObj);

            const campaignDoc = openMap.get(campaignIdKey) ?? closedMap.get(campaignIdKey) ?? null;

            console.log("INFLUENCER CAMPAIGNS HISTORY STATUS", item.status, HistoryCampaignActionStatusLabel[item.status as HistoryCampaignActionStatus])

            const processed: any = {
                addedAccountsId: item.addedAccountsId,
                campaignId: item.campaignId,
                campaignName: item.campaignName,

                campaignSocialMedia: campaignDoc?.socialMedia ?? item.campaignSocialMediaFromHistory,

                socialAccountId: item.socialAccountId,
                price: item.price,
                status: item.status,
                date: formatDate(item.date),
                currentBalance: item.currentBalance,

                statusLabel: HistoryCampaignActionStatusLabel[item.status as HistoryCampaignActionStatus],
            };

            return processed as HistoryCampaignItemForProcessedHistory;
        });

        return history;
    }

    // Moves social account's actions history to new owner's history
    async moveSocialAccountHistory(
        context: SocialAccountMigrationContext,
        session: ClientSession,
    ): Promise<void> {
        const {
            targetInfluencerId,
            sourceInfluencerId,
            socialMedia,
            socialAccountUsername,
            targetInfluencerEmail,
        } = context;

        // Getting actions from old owner's history
        const actionsToMigrate: CampaignActionWithCampaignMeta[] =
            await this.influencerHistoryRepo.findCampaignActionsForSocialAccount(
                {
                    influencerId: sourceInfluencerId.toString(),
                    socialAccountUsername,
                    socialMedia,
                },
                {session},
            );

        if (!actionsToMigrate.length) {
            this.logger.log(`Didn't find any actions for social account ${socialAccountUsername}`);
            return;
        }

        // Deleting actions from old owner
        await this.influencerHistoryRepo.updateOne(
            {influencerId: sourceInfluencerId},
            {
                $pull: {
                    "campaigns.$[].actions": {
                        networkUsername: socialAccountUsername,
                        socialMedia,
                    },
                },
            },
            {session},
        );

        // Removing empty campaigns actions
        await this.influencerHistoryRepo.updateOne(
            {influencerId: sourceInfluencerId},
            {
                $pull: {
                    campaigns: {actions: {$size: 0}},
                },
            },
            {session},
        );

        // Copying actions to new owner's history
        for (const action of actionsToMigrate) {

            // Adding actions for existing campaigns
            const result = await this.influencerHistoryRepo.updateOne(
                {influencerId: targetInfluencerId, "campaigns.campaignId": action.campaignId},
                {
                    $push: {
                        "campaigns.$.actions": {
                            actionNumber: action.actionNumber,
                            rewardForInfluencer: action.rewardForInfluencer,
                            networkUsername: action.networkUsername,
                            socialMedia: action.socialMedia,
                            currentBalance: action.currentBalance,
                            date: action.date,
                            isStillInCampaign: action.isStillInCampaign ?? true,
                        },
                    },
                },
                {session},
            );

            // If there's no campaign - create
            if (result.matchedCount === 0) {
                await this.influencerHistoryRepo.updateOne(
                    {influencerId: targetInfluencerId},
                    {
                        $setOnInsert: {
                            influencerEmail: targetInfluencerEmail,
                        },
                        $push: {
                            campaigns: {
                                campaignId: action.campaignId,
                                campaignName: action.campaignName,
                                actions: [
                                    {
                                        actionNumber: action.actionNumber,
                                        rewardForInfluencer: action.rewardForInfluencer,
                                        networkUsername: action.networkUsername,
                                        socialMedia: action.socialMedia,
                                        currentBalance: action.currentBalance,
                                        date: action.date,
                                        isStillInCampaign: action.isStillInCampaign ?? true,
                                    },
                                ],
                            },
                        },
                    },
                    {upsert: true, session},
                );
            }
        }
    }
}
