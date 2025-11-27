import {Injectable, Logger} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import mongoose, {Model} from 'mongoose';
import {InfluencerActionsHistory} from "./schemas/influencer-actions-history.schema";
import {Promos} from "../promos/schemas/promo.schema";
import {PromosCopies} from "../admin/schemas/promos-copies.schema";
import {UpsertCampaignHistoryDto} from "./dto/upsert-campaign-history.dto";
import {UpsertInvoiceHistoryDto} from "./dto/upsert-invoice-history.dto";
import {CheckIfInCampaignDto} from "./dto/check-if-in-campaign.dto";
import {Influencer} from "../../database/schemas/users/influencer.schema";

@Injectable()
export class InfluencerActionsHistoryService {
    private readonly logger = new Logger();

    constructor(
        @InjectModel(InfluencerActionsHistory.name)
        private influencerActionsHistoryModel: Model<InfluencerActionsHistory>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
        @InjectModel(Promos.name)
        private promoModel: mongoose.Model<Promos>,
        @InjectModel(PromosCopies.name)
        private promoCopiesModel: mongoose.Model<PromosCopies>
    ) {
    }

    async upsertInfluencerCampaignActionsHistory(data: UpsertCampaignHistoryDto) {
        const {influencerId, campaignId, campaignName, updatedCampaignAction} = data;

        const influencer = await this.influencerModel
            .findById(new mongoose.Types.ObjectId(influencerId))
            .select('email balance');

        if (!influencer) {
            return {
                code: 400,
                message: 'Influencer not found',
            };
        }

        const {email, balance} = influencer;

        if (!updatedCampaignAction) {
            return {
                code: 400,
                message: 'Invalid request',
            };
        }

        const {actionNumber, networkUsername, rewardForInfluencer, socialMedia} =
            updatedCampaignAction;

        if (
            !campaignId ||
            !campaignName ||
            actionNumber === null ||
            actionNumber === undefined ||
            !networkUsername ||
            rewardForInfluencer === null ||
            rewardForInfluencer === undefined
        ) {
            this.logger.error(
                `SAVING INFLUENCER HISTORY INVALID REQ:
       \ncampaignId: ${campaignId}
       \ncampaignName: ${campaignName}
       \nactionNumber: ${actionNumber}
       \nnetworkUsername: ${networkUsername}
       \nrewardForInfluencer: ${rewardForInfluencer}`,
                new Error().stack,
            );
            return {
                code: 400,
                message: 'Invalid request',
            };
        }

        const action = {
            actionNumber,
            networkUsername,
            rewardForInfluencer,
            socialMedia,
            currentBalance:
                actionNumber === 3 ? parseInt(balance) + rewardForInfluencer : parseInt(balance),
            date: new Date(),
        };

        const updateResult = await this.influencerActionsHistoryModel.findOneAndUpdate(
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
            },
        );

        if (updateResult) {
            return {
                code: 200,
                message: 'Influencer actions history updated (existing campaign)',
            };
        }

        const campaignPushResult = await this.influencerActionsHistoryModel.findOneAndUpdate(
            {
                influencerId: new mongoose.Types.ObjectId(influencerId),
            },
            {
                $push: {
                    campaigns: {
                        campaignId,
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

        if (campaignPushResult) {
            return {
                code: 200,
                message: 'Influencer actions history updated (new campaign or document)',
            };
        }

        return {
            code: 500,
            message: 'Failed to update influencer actions history',
        };
    }

    async upsertInfluencerInvoiceHistory(data: UpsertInvoiceHistoryDto) {
        const {influencerId, invoiceId, paymentMethod, currentBalance, amount} = data;

        if (!influencerId || !amount || !paymentMethod || !invoiceId) {
            return {
                code: 400,
                message: 'Invalid request',
            };
        }

        let influencerActionsHistory = await this.influencerActionsHistoryModel.findOne({
            influencerId: new mongoose.Types.ObjectId(influencerId),
        });

        if (!influencerActionsHistory) {
            try {
                const {email} = await this.influencerModel
                    .findById(new mongoose.Types.ObjectId(influencerId))
                    .select('email');

                if (!email) {
                    return {
                        code: 400,
                        message: 'Influencer not found',
                    };
                }

                await this.influencerActionsHistoryModel.create({
                    influencerId: new mongoose.Types.ObjectId(influencerId),
                    influencerEmail: email,
                    invoices: [
                        {
                            invoiceId: invoiceId,
                            amount: amount,
                            paymentMethod: paymentMethod,
                            currentBalance: currentBalance,
                            date: new Date(),
                        },
                    ],
                });

                return {
                    code: 200,
                    message: 'Influencer invoice history created',
                };
            } catch (e) {
                console.log(e);
                return {
                    code: 500,
                    message: e.message,
                };
            }
        } else {
            influencerActionsHistory.invoices.push({
                invoiceId,
                amount,
                paymentMethod,
                currentBalance,
                date: new Date(),
            });

            try {
                await influencerActionsHistory.save();
                return {
                    code: 200,
                    message: 'Influencer invoice history updated',
                };
            } catch (e) {
                console.log(e);
                return {
                    code: 500,
                    message: e.message,
                };
            }
        }
    }

    async getActionsHistoryForAllOfInfluencers() {
        const influencerActionsHistory = await this.influencerActionsHistoryModel.find().lean().exec();

        if (!influencerActionsHistory) {
            return {
                code: 404,
                message: 'Influencers actions history not found',
            };
        }

        const processedInfluencerActionsHistory = await Promise.all(
            influencerActionsHistory
                .map(async (influencerActionsHistory) => {
                    const influencer = await this.influencerModel.findById(
                        influencerActionsHistory.influencerId,
                    );

                    if (!influencer) {
                        console.warn(
                            `Influencer not found for ID: ${influencerActionsHistory.influencerId} - INFLUENCER ACTIONS HISTORY SERVICE`,
                            new Date().toLocaleString(),
                        );
                        return null;
                    }

                    const socialMedias = [
                        'instagram',
                        'tiktok',
                        'youtube',
                        'spotify',
                        'soundcloud',
                        'facebook',
                        'press',
                    ];

                    const influencerNetworkUsernames = socialMedias
                        .flatMap((socialMedia) => {
                            const influencersSocialMediaAccounts = influencer[socialMedia];

                            if (influencersSocialMediaAccounts) {
                                return influencersSocialMediaAccounts
                                    .filter((account) => account && account.instagramUsername)
                                    .map((account) => ({
                                        socialMedia: socialMedia,
                                        networkUsername: account.instagramUsername,
                                        influencerId: influencer._id,
                                        publicPrice: account.publicPrice,
                                        ownerFirstName: influencer.firstName,
                                    }));
                            }
                            return [];
                        })
                        .filter(Boolean);

                    const actionsHistory = [
                        ...influencerActionsHistory.campaigns.flatMap((campaign) =>
                            campaign.actions.map((action) => ({
                                typeOfAction: 'campaign',
                                campaignId: campaign.campaignId,
                                campaignName: campaign.campaignName,
                                actionNumber: action.actionNumber,
                                socialMedia: action.socialMedia,
                                networkUsername: action.networkUsername,
                                rewardForInfluencer: action.rewardForInfluencer,
                                currentBalance: action.currentBalance,
                                date: action.date,
                            })),
                        ),
                        ...influencerActionsHistory.invoices.map((invoice) => ({
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

                    if (influencerNetworkUsernames?.length > 0) {
                        return {
                            influencerId: influencerActionsHistory.influencerId,
                            influencerNetworkUsernames: influencerNetworkUsernames,
                            influencerEmail: influencer.email,
                            history: actionsHistory,
                        };
                    }

                    if (influencerNetworkUsernames?.length > 0)
                        return {
                            influencerId: influencerActionsHistory.influencerId,
                            influencerNetworkUsernames: influencerNetworkUsernames,
                            influencerEmail: influencer.email,
                            history: actionsHistory,
                        };
                })
                .filter(Boolean),
        );

        if (!processedInfluencerActionsHistory) {
            return {
                code: 404,
                message: 'Influencers actions history not found',
            };
        }

        return {
            code: 200,
            influencerActionsHistory: processedInfluencerActionsHistory,
        };
    }

    async getActionsHistoryForInfluencer(influencerId: string) {
        const influencerActionsHistory = await this.influencerActionsHistoryModel
            .findOne({influencerId: new mongoose.Types.ObjectId(influencerId)})
            .lean()
            .exec();

        if (!influencerActionsHistory) {
            return {
                code: 404,
                message: `Influencer's actions history not found`,
            };
        }

        const influencer = await this.influencerModel.findById(influencerActionsHistory.influencerId);

        if (!influencer) {
            console.warn(
                `Influencer not found for ID: ${influencerActionsHistory.influencerId} - INFLUENCER ACTIONS HISTORY SERVICE`,
                new Date().toLocaleString(),
            );
            return {
                code: 404,
                message: 'Influencer not found',
            };
        }

        const socialMedias = [
            'instagram',
            'tiktok',
            'youtube',
            'spotify',
            'soundcloud',
            'facebook',
            'press',
        ];

        const processedName = influencer.firstName.trim()
            ? influencer.firstName.trim()
            : influencer.email.includes('@')
                ? influencer.email.split('@')[0]
                : influencer.email;

        const influencerNetworkUsernames = socialMedias.flatMap((socialMedia) => {
            const accounts = influencer[socialMedia];

            if (accounts) {
                return accounts
                    .filter((account) => account && account.instagramUsername)
                    .map((account) => ({
                        socialMedia: socialMedia,
                        networkUsername: account.instagramUsername,
                        influencerId: influencer._id,
                        publicPrice: account.publicPrice,
                        ownerFirstName: influencer.firstName.trim()
                            ? influencer.firstName.trim()
                            : influencer.email,
                        networkAccountId: account._id,
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
            code: 200,
            influencerActionsHistory: {
                influencerId: influencer._id,
                influencerNetworkUsernames,
                influencerEmail: influencer.email,
                influencerName: processedName,
                history: actionsHistory,
                currencyNote: influencer?.currencyNote ? influencer.currencyNote : '',
            },
        };
    }

    async getLastUpdates() {
        try {
            const results = await this.influencerActionsHistoryModel.aggregate([
                {$unwind: '$campaigns'},
                {$unwind: '$campaigns.actions'},
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                '$campaigns.actions',
                                {
                                    influencerId: '$influencerId',
                                    influencerEmail: '$influencerEmail',
                                    campaignName: '$campaigns.campaignName',
                                    campaignId: '$campaigns.campaignId',
                                },
                            ],
                        },
                    },
                },

                {$sort: {date: -1}},

                {$limit: 5},
            ]);

            return {
                code: 200,
                lastUpdates: results,
            };
        } catch (error) {
            console.error(error);
            return {
                code: 500,
                message: 'Something went wrong while retrieving last updates',
                lastUpdates: [],
            };
        }
    }

    async checkIfStillInCampaign(data: CheckIfInCampaignDto) {
        try {
            let promo = await this.promoModel.findOne(
                {
                    _id: new mongoose.Types.ObjectId(data.campaignId),
                    selectInfluencers: {
                        $elemMatch: {
                            influencerId: data.influencerId,
                            socialMediaUsername: data.networkUsername,
                        },
                    },
                },
                { _id: 1 }
            ).lean();

            if (!promo) {
                promo = await this.promoCopiesModel.findOne(
                    {
                        _id: new mongoose.Types.ObjectId(data.campaignId),
                        selectInfluencers: {
                            $elemMatch: {
                                influencerId: data.influencerId,
                                socialMediaUsername: data.networkUsername,
                            },
                        },
                    },
                    { _id: 1 }
                ).lean();
            }

            const isStillInCampaign = !!promo;

            // Обновление истории
            const filter = data.actionId
                ? { "campaigns.actions._id": new mongoose.Types.ObjectId(data.actionId) }
                : {
                    influencerId: new mongoose.Types.ObjectId(data.influencerId),
                    "campaigns.campaignId": data.campaignId,
                };

            const arrayFilters = data.actionId
                ? [
                    { "campaign.actions._id": new mongoose.Types.ObjectId(data.actionId) },
                    { "action._id": new mongoose.Types.ObjectId(data.actionId) },
                ]
                : [
                    { "campaign.campaignId": data.campaignId },
                    { "action.networkUsername": data.networkUsername },
                ];

            await this.influencerActionsHistoryModel.updateOne(
                filter,
                {
                    $set: {
                        "campaigns.$[campaign].actions.$[action].isStillInCampaign": isStillInCampaign,
                        updatedAt: new Date(),
                    },
                },
                { arrayFilters }
            );

            // Получение обновлённого action
            const historyDoc = await this.influencerActionsHistoryModel.findOne(filter, { "campaigns.$": 1 }).lean();
            const campaign = historyDoc.campaigns[0];
            const updatedAction = data.actionId
                ? campaign.actions.find(a => (a as any)._id.toString() === data.actionId)
                : campaign.actions.find(a => a.networkUsername === data.networkUsername);

            return {
                code: 200,
                isStillInCampaign,
                isError: false,
                updatedAction: {
                    actionId: (updatedAction as any)._id ?? null,
                    typeOfAction: 'campaign',
                    campaignId: campaign.campaignId,
                    campaignName: campaign.campaignName,
                    actionNumber: updatedAction.actionNumber,
                    socialMedia: updatedAction.socialMedia,
                    networkUsername: updatedAction.networkUsername,
                    rewardForInfluencer: updatedAction.rewardForInfluencer,
                    currentBalance: updatedAction.currentBalance,
                    date: updatedAction.date,
                    isStillInCampaign: updatedAction.isStillInCampaign ?? true
                },
            };
        } catch (e) {
            this.logger.error(
                `Error checking if ${data.socialMedia} account (${data.networkUsername}) still in campaign ${data.campaignId} (${data.campaignName}). \n${e.message}`,
                e instanceof Error ? e.stack : new Error().stack
            );
            return {
                code: 500,
                isStillInCampaign: true,
                isError: true,
                updatedAction: null,
            };
        }
    }


}
