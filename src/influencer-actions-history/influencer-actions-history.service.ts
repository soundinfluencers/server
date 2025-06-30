import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { InfluencerActionsHistory } from './schemas/influencer-actions-history.schema';
import { UpsertCampaignHistoryDto } from './dto/upsert-campaign-history.dto';
import { Influencer } from '../auth/schemas/influencer.schema';
import { UpsertInvoiceHistoryDto } from './dto/upsert-invoice-history.dto';

@Injectable()
export class InfluencerActionsHistoryService {
  constructor(
    @InjectModel(InfluencerActionsHistory.name)
    private influencerActionsHistoryModel: Model<InfluencerActionsHistory>,
    @InjectModel(Influencer.name)
    private influencerModel: mongoose.Model<Influencer>,
  ) {}

  async upsertInfluencerCampaignActionsHistory(data: UpsertCampaignHistoryDto) {
    let { influencerId, campaignId, campaignName, updatedCampaignAction } = data;

    const { email, balance } = await this.influencerModel
      .findById(new mongoose.Types.ObjectId(influencerId))
      .select('email balance');

    if (!email || !balance) {
      return {
        code: 400,
        message: 'Influencer not found',
      };
    }

    if (updatedCampaignAction) {
      const { actionNumber, networkUsername, rewardForInfluencer, socialMedia } =
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
        console.error(`SAVING INFLUENCER HISTORY INVALID REQ:
                 \ncampaignId: ${campaignId}
                 \ncampaignName: ${campaignName}
                 \nactionNumber: ${actionNumber}
                 \nnetworkUsername: ${networkUsername}
                 \nrewardForInfluencer: ${rewardForInfluencer}`);
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
          await this.influencerActionsHistoryModel.create({
            influencerId,
            campaigns: [
              {
                campaignId: campaignId,
                campaignName: campaignName,
                actions: [
                  {
                    actionNumber,
                    networkUsername,
                    rewardForInfluencer,
                    socialMedia,
                    currentBalance: parseInt(balance),
                    date: new Date(),
                  },
                ],
              },
            ],
            influencerEmail: email,
          });

          return {
            code: 200,
            message: 'Influencer actions history created',
          };
        } catch (e) {
          return {
            code: 500,
            message: e,
          };
        }
      }

      const campaign = influencerActionsHistory.campaigns.find((c) => c.campaignId === campaignId);

      if (!campaign) {
        influencerActionsHistory.campaigns.push({
          campaignId,
          campaignName,
          actions: [
            {
              actionNumber,
              networkUsername,
              rewardForInfluencer,
              socialMedia,
              currentBalance: parseInt(balance),
              date: new Date(),
            },
          ],
        });
      } else {
        campaign.actions.push({
          actionNumber,
          networkUsername,
          rewardForInfluencer,
          socialMedia,
          currentBalance:
            actionNumber === 3 ? parseInt(balance) + rewardForInfluencer : parseInt(balance),
          date: new Date(),
        });
      }

      try {
        await influencerActionsHistory.save();
        return {
          code: 200,
          message: 'Influencer actions history updated',
        };
      } catch (e) {
        return {
          code: 500,
          message: e.message,
        };
      }
    } else {
      return {
        code: 400,
        message: 'Invalid request',
      };
    }
  }

  async upsertInfluencerInvoiceHistory(data: UpsertInvoiceHistoryDto) {
    const { influencerId, invoiceId, paymentMethod, currentBalance, amount } = data;

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
        const { email } = await this.influencerModel
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
      .findOne({ influencerId: new mongoose.Types.ObjectId(influencerId) })
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
        { $unwind: '$campaigns' },
        { $unwind: '$campaigns.actions' },
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

        { $sort: { date: -1 } },

        { $limit: 5 },
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
}
