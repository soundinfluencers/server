import {BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException} from '@nestjs/common';
import mongoose, {ClientSession, Types} from 'mongoose';
import {UpsertCampaignActionDto, UpsertInvoiceActionDto} from "./dto/upsert-actions.dto";
import {InfluencerHistoryRepository} from "../../database/repositories/histories/influencer-history.repository";
import {SocialAccountMigrationContext} from "../migrations/types/migrations.types";
import {
    CampaignActionWithCampaignMeta,
    ProcessedInfluencerHistory
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

        const influencer = await this.influencerRepo.findById(influencerId).select('email balance');

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
                'campaigns.campaignId': campaignId,
            },
            {
                $push: {
                    'campaigns.$.actions': action,
                },
            },
            {
                new: true,
                session: session ?? undefined
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
                },
            );
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

        // 1) Берём последнее действие по каждому промо
        // Важно: пагинация ПОСЛЕ group, иначе ты пагинируешь actions, а не promos.
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

                    // socialAccountId может быть string/objectId/null
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

            // Нам нужно уметь вычислить addedAccountsId, если в истории его нет.
            // Это можно сделать только через openCampaign (в completedcampaigns он тоже есть, но чаще нужнее open).
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

            // Если не смогли резолвнуть промо — выкидываем (иначе group по null склеит всё в один элемент)
            { $match: { resolvedAddedAccountsId: { $ne: null } } },

            // Сортируем по дате действия, чтобы $first в group был "последний"
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

            // теперь пагинация по промо
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

                    // если нужно — можно вернуть isStillInCampaign из истории, но "актуальность" будем брать из кампании
                    isStillInCampaignFromHistory: '$lastAction.isStillInCampaign',
                },
            },
        ]);

        if (!rawLatestByPromo.length) return [];

        // 2) Батчем подтягиваем кампании: сначала open, затем закрытые для тех, кого нет в open.
        const campaignIds: Types.ObjectId[] = rawLatestByPromo
            .map((x: any) => x.campaignIdObj)
            .filter(Boolean);

        // дедуп
        const campaignIdStrSet = new Set(campaignIds.map(id => String(id)));
        const uniqueCampaignIds = Array.from(campaignIdStrSet).map(id => new Types.ObjectId(id));

        // ВАЖНО: берём минимум полей, чтобы не тянуть тяжелый campaignContent и т.п.
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

        // 3) Мерджим: актуальный статус из кампании, даты/баланс/last action — из истории
        const history: HistoryCampaignItemForProcessedHistory[] = rawLatestByPromo.map((item: any) => {
            const campaignIdKey = String(item.campaignIdObj);

            // промо может быть завершено, но кампания ещё ongoing -> сначала open
            const campaignDoc = openMap.get(campaignIdKey) ?? closedMap.get(campaignIdKey) ?? null;

            // const promo =
            //     campaignDoc?.addedAccounts?.find((a: any) => String(a._id) === String(item.addedAccountsId)) ??
            //     null;

            // актуальный статус — из promo (если нашли)
            // Если promo не найден (редко, но возможно) — фолбэк на то, что есть в истории.
            const processed: any = {
                addedAccountsId: item.addedAccountsId,
                campaignId: item.campaignId,
                campaignName: item.campaignName,

                // social media: сперва то, что сейчас в кампании, если нет — из истории
                campaignSocialMedia: campaignDoc?.socialMedia ?? item.campaignSocialMediaFromHistory,

                socialAccountId: item.socialAccountId,
                price: item.price,
                status: item.status,
                date: formatDate(item.date),
                currentBalance: item.currentBalance,

                statusLabel: HistoryCampaignActionStatusLabel[item.status as HistoryCampaignActionStatus],
            };

            // сюда добавляй любые поля "актуального статуса промо", которые нужны фронту
            // (confirmation/closePromo/adminChecked/postLink/datePost/и т.д.)
            // if (promo) {
            //     processed.promo = {
            //         // пример:
            //         confirmation: promo.confirmation,
            //         closePromo: promo.closePromo,
            //         adminChecked: promo.adminChecked,
            //         rating: promo.rating,
            //
            //         dateRequest: promo.dateRequest,
            //         datePost: promo.datePost,
            //         postLink: promo.postLink,
            //         screenshot: promo.screenshot,
            //
            //         // если нужно:
            //         username: promo.username,
            //         socialMedia: promo.socialMedia,
            //         accountId: promo.accountId,
            //     };

                // если тебе нужно именно "актуальный isStillInCampaign" — бери из promo/кампании, если есть такое поле,
                // иначе оставь из истории.
                // processed.isStillInCampaign = promo.isStillInCampaign ?? item.isStillInCampaignFromHistory;
            // } else {
                // processed.promo = null;
                // processed.isStillInCampaign = item.isStillInCampaignFromHistory;
            // }

            return processed as HistoryCampaignItemForProcessedHistory;
        });

        return history;
    }

    // Return several histories (with limit and page)
    async getAllHistories(data: GetAllHistoriesQueryDto): Promise<InfluencerActionsHistory[]> {
        const limit = Number(data.limit ?? 10);
        const page = Number(data.page ?? 1);

        if (!Number.isInteger(limit) || limit <= 0) {
            throw new BadRequestException('Invalid limit');
        }

        if (!Number.isInteger(page) || page <= 0) {
            throw new BadRequestException('Invalid page');
        }

        const skip = (page - 1) * limit;

        return await this.influencerHistoryRepo.findMany({}, {lean: true, limit, skip})
    }

    // Return one processed history (found by influencerId)
    async getActionsHistoryForInfluencer(influencerId: string): Promise<ProcessedInfluencerHistory> {
        const influencerActionsHistory = await this.influencerHistoryRepo
            .findOne({influencerId: new mongoose.Types.ObjectId(influencerId)}, {lean: true})

        if (!influencerActionsHistory) {
            throw new NotFoundException(`History for influencer ${influencerId} was not found`);
        }

        const influencer = await this.influencerRepo.findById(influencerId);

        if (!influencer) {
            throw new NotFoundException(`Influencer ${influencerId} not found`);
        }

        const socialMedias = Object.values(SocialMediaEnum);

        const processedName = influencer.firstName.trim()
            ? influencer.firstName.trim()
            : influencer.email.includes('@')
                ? influencer.email.split('@')[0]
                : influencer.email;

        const accountsUsernames: {
            accountId: string;
            socialMedia: SocialMediaEnum;
            username: string;
            publicPrice: number;
        }[] = socialMedias.flatMap((socialMedia) => {
            const accounts = influencer[socialMedia];

            if (accounts) {
                return accounts
                    .filter((account) => account && account.username)
                    .map((account) => ({
                        accountId: account._id.toString(),
                        socialMedia: socialMedia as SocialMediaEnum,
                        username: account.username,
                        publicPrice: account.publicPrice,
                    }));
            }

            return [];
        });

        const actionsHistory = [
            ...(influencerActionsHistory.campaigns || []).flatMap((campaign) =>
                campaign.actions.map((action) => ({
                    actionId: (action as any)._id ?? null,
                    typeOfAction: 'campaign',
                    campaignId: campaign.campaignId,
                    campaignName: campaign.campaignName,
                    actionNumber: action.actionNumber,
                    socialMedia: action.socialMedia,
                    networkUsername: action.networkUsername,
                    rewardForInfluencer: action.rewardForInfluencer,
                    currentBalance: action.currentBalance,
                    date: action.date,
                    isStillInCampaign: action.isStillInCampaign ?? true
                })),
            ),
            ...(influencerActionsHistory.invoices || []).map((invoice) => ({
                typeOfAction: 'invoice',
                invoiceId: invoice.invoiceId,
                amount: invoice.amount,
                paymentMethod: invoice.paymentMethod,
                currentBalance: invoice.currentBalance,
                date: invoice.date,
            })),
        ];

        actionsHistory.sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date.getTime() : 0;
            const dateB = b.date instanceof Date ? b.date.getTime() : 0;
            return dateB - dateA;
        });

        return {
            influencerId: influencerId,
            accountsUsernames: accountsUsernames,
            influencerEmail: influencer.email,
            influencerName: processedName,
            history: actionsHistory,
            currencyNote: influencer?.currencyNote ? influencer.currencyNote : '',
        };
    }

    // // TODO
    // async getLastUpdates() {
    //     try {
    //         const results = await this.influencerHistoryRepo.aggregate([
    //             {$unwind: '$campaigns'},
    //             {$unwind: '$campaigns.actions'},
    //             {
    //                 $replaceRoot: {
    //                     newRoot: {
    //                         $mergeObjects: [
    //                             '$campaigns.actions',
    //                             {
    //                                 influencerId: '$influencerId',
    //                                 influencerEmail: '$influencerEmail',
    //                                 campaignName: '$campaigns.campaignName',
    //                                 campaignId: '$campaigns.campaignId',
    //                             },
    //                         ],
    //                     },
    //                 },
    //             },
    //
    //             {$sort: {date: -1}},
    //
    //             {$limit: 5},
    //         ]);
    //
    //         return {
    //             code: 200,
    //             lastUpdates: results,
    //         };
    //     } catch (error) {
    //         console.error(error);
    //         return {
    //             code: 500,
    //             message: 'Something went wrong while retrieving last updates',
    //             lastUpdates: [],
    //         };
    //     }
    // }
    //
    // // TODO
    // async checkIfStillInCampaign(data: CheckIfInCampaignDto) {
    //     try {
    //         let promo = await this.campaignRepository.findOne(
    //             {
    //                 _id: new mongoose.Types.ObjectId(data.campaignId),
    //                 selectInfluencers: {
    //                     $elemMatch: {
    //                         influencerId: data.influencerId,
    //                         socialMediaUsername: data.networkUsername,
    //                     },
    //                 },
    //             },
    //             {_id: 1}
    //         ).lean();
    //
    //         if (!promo) {
    //             promo = await this.completedCampaignRepo.findOne(
    //                 {
    //                     _id: new mongoose.Types.ObjectId(data.campaignId),
    //                     selectInfluencers: {
    //                         $elemMatch: {
    //                             influencerId: data.influencerId,
    //                             socialMediaUsername: data.networkUsername,
    //                         },
    //                     },
    //                 },
    //                 {_id: 1}
    //             ).lean();
    //         }
    //
    //         const isStillInCampaign = !!promo;
    //
    //         // Обновление истории
    //         const filter = data.actionId
    //             ? {"campaigns.actions._id": new mongoose.Types.ObjectId(data.actionId)}
    //             : {
    //                 influencerId: new mongoose.Types.ObjectId(data.influencerId),
    //                 "campaigns.campaignId": data.campaignId,
    //             };
    //
    //         const arrayFilters = data.actionId
    //             ? [
    //                 {"campaign.actions._id": new mongoose.Types.ObjectId(data.actionId)},
    //                 {"action._id": new mongoose.Types.ObjectId(data.actionId)},
    //             ]
    //             : [
    //                 {"campaign.campaignId": data.campaignId},
    //                 {"action.networkUsername": data.networkUsername},
    //             ];
    //
    //         await this.influencerHistoryRepo.updateOne(
    //             filter,
    //             {
    //                 $set: {
    //                     "campaigns.$[campaign].actions.$[action].isStillInCampaign": isStillInCampaign,
    //                     updatedAt: new Date(),
    //                 },
    //             },
    //             {arrayFilters}
    //         );
    //
    //         // Получение обновлённого action
    //         const historyDoc = await this.influencerHistoryRepo.findOne(filter, {"campaigns.$": 1}).lean();
    //         const campaign = historyDoc.campaigns[0];
    //         const updatedAction = data.actionId
    //             ? campaign.actions.find(a => (a as any)._id.toString() === data.actionId)
    //             : campaign.actions.find(a => a.networkUsername === data.networkUsername);
    //
    //         return {
    //             code: 200,
    //             isStillInCampaign,
    //             isError: false,
    //             updatedAction: {
    //                 actionId: (updatedAction as any)._id ?? null,
    //                 typeOfAction: 'campaign',
    //                 campaignId: campaign.campaignId,
    //                 campaignName: campaign.campaignName,
    //                 actionNumber: updatedAction.actionNumber,
    //                 socialMedia: updatedAction.socialMedia,
    //                 networkUsername: updatedAction.networkUsername,
    //                 rewardForInfluencer: updatedAction.rewardForInfluencer,
    //                 currentBalance: updatedAction.currentBalance,
    //                 date: updatedAction.date,
    //                 isStillInCampaign: updatedAction.isStillInCampaign ?? true
    //             },
    //         };
    //     } catch (e) {
    //         this.logger.error(
    //             `Error checking if ${data.socialMedia} account (${data.networkUsername}) still in campaign ${data.campaignId} (${data.campaignName}). \n${e.message}`,
    //             e instanceof Error ? e.stack : new Error().stack
    //         );
    //         return {
    //             code: 500,
    //             isStillInCampaign: true,
    //             isError: true,
    //             updatedAction: null,
    //         };
    //     }
    // }


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
