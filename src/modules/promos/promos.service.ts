import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import mongoose, { ClientSession, PipelineStage, Types } from 'mongoose';
import { SocialMediaEnum, SocialMediaType } from '../../common/types/social-media.types';
import {
  InfluencerDetailedPromo,
  InfluencerGetDashboardPromosQueryDto,
  InfluencerGetDetailedPromoParamsDto,
  InfluencerGetDetailedPromosQueryDto,
  InfluencerNewPromoRequestDto,
  InfluencerUpdatePromoReqBodyDto,
  InfluencerUpdatePromoResponseUpdateDto,
} from './dto/influencer-get-promos.dto';
import {
  InfluencerCompletedPromo,
  InfluencerConfirmationStatusEnum,
  InfluencerConfirmationStatusType,
  InfluencerDashboardPromo,
  InfluencerDashboardPromoStatusRequest,
  InfluencerDetailedPromoStatusRequest,
  InfluencerNewPromoRequest,
  InfluencerOngoingPromo,
  InfluencerPromoClosedStatusEnum,
  InfluencerPromoClosedStatusType,
} from '../../common/types/influencer/promo.types';
import { SocialAccountMigrationContext } from '../migrations/types/migrations.types';
import { CampaignRepository } from '../../database/repositories/campaigns/campaign.repository';
import { CompletedCampaignRepository } from '../../database/repositories/campaigns/completed-campaign.repository';
import { formatDate } from '../../common/utils/formatters';
import { SocialMediaValidationStrategyFactory } from './strategies/social-media-validation.factory';
import { InfluencerActionsHistoryService } from '../influencer-actions-history/influencer-actions-history.service';
import { ClientRepository } from '../../database/repositories/users/client.repository';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import {
  CampaignConfirmationEnum,
  CampaignStatusEnum,
} from '../../common/types/client/campaign.types';
import { ObjId } from '../../common/types/base.types';
import { Campaign } from '../../database/schemas/campaign/campaign.schema';
import { CompletedCampaign } from '../../database/schemas/campaign/completed-campaign.schema';
import { InvoiceStatusEnum } from '../../common/types/invoice.types';

mongoose.Promise = global.Promise;

@Injectable()
export class PromosService {
  constructor(
    private readonly clientRepo: ClientRepository,
    private readonly influencerRepo: InfluencerRepository,
    private readonly campaignRepo: CampaignRepository,
    private readonly completedCampaignRepo: CompletedCampaignRepository,
    private readonly validationStrategyFactory: SocialMediaValidationStrategyFactory,
    private readonly influencerActionsHistoryService: InfluencerActionsHistoryService,
  ) {}

  /// -------------- ORCHESTRATORS ----------------

  // orchestrator for getting one detailed promo with specific type (ongoing, completed, etc.)
  async getDetailedPromoByType(
    data: InfluencerGetDetailedPromoParamsDto,
  ): Promise<InfluencerDetailedPromo> {
    const { status, campaignId, addedAccountsId, influencerId } = data;

    const handlers = {
      [InfluencerDetailedPromoStatusRequest.new]: () =>
        this.getNewPromo(influencerId, campaignId, addedAccountsId),
      [InfluencerDetailedPromoStatusRequest.ongoing]: () =>
        this.getOngoingPromo(influencerId, campaignId, addedAccountsId),
      [InfluencerDetailedPromoStatusRequest.close]: () =>
        this.getCompletedPromo(influencerId, campaignId, addedAccountsId),
    };

    const handler = handlers[status];
    if (!handler) throw new Error('Unsupported promo status');
    return handler();
  }

  // orchestrator for getting array of detailed promos with specific type (ongoing, completed, etc.)
  async getDetailedPromosByType(
    data: InfluencerGetDetailedPromosQueryDto,
  ): Promise<InfluencerDetailedPromo[]> {
    const status = data.status ?? InfluencerDetailedPromoStatusRequest.ongoing;

    const handlers = {
      [InfluencerDetailedPromoStatusRequest.new]: () =>
        this.getNewPromos({
          limit: data.limit,
          page: data.page,
          influencerId: data.influencerId,
        }),
      [InfluencerDetailedPromoStatusRequest.ongoing]: () =>
        this.getOngoingPromos({
          limit: data.limit,
          page: data.page,
          influencerId: data.influencerId,
        }),
      [InfluencerDetailedPromoStatusRequest.close]: () =>
        this.getCompletedPromos({
          limit: data.limit,
          page: data.page,
          influencerId: data.influencerId,
        }),
    };

    const handler = handlers[status];
    if (!handler) throw new Error('Unsupported promo status');

    // If user selected promo on dashboard we need to show him this promo as first element of list
    if (data.addedAccountsId && data.campaignId) {
      let promos: InfluencerDetailedPromo[] = await handler();
      const selectedPromo: InfluencerDetailedPromo = await this.getDetailedPromoByType({
        status: status,
        campaignId: data.campaignId,
        addedAccountsId: data.addedAccountsId,
        influencerId: data.influencerId,
      });

      if (!selectedPromo) {
        throw new NotFoundException('Selected promo not found');
      }

      promos = promos.filter(
        (promo: InfluencerDetailedPromo): boolean => promo.addedAccountsId !== data.addedAccountsId,
      );
      promos.unshift(selectedPromo);

      return promos;
    }

    return handler();
  }

  /// -------------- UTILS ------------------

  // for DESC sorting promos
  private buildPromoSortPage(skip: number, limit: number) {
    return [
      { $sort: { 'addedAccounts.updatedAt': -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];
  }

  // for DESC sorting campaigns
  private buildCampaignSortPage(skip: number, limit: number) {
    return [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }];
  }

  // for searching campaign creator (clientId || userId)
  private buildClientJoin() {
    return [
      { $addFields: { _effectiveClientId: { $ifNull: ['$clientId', '$userId'] } } },
      {
        $lookup: {
          from: 'clients',
          localField: '_effectiveClientId',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
    ];
  }

  // for getting campaign content
  private buildCampaignContentComputed() {
    return [
      {
        $set: {
          _contentItem: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ['$campaignContent', []] },
                  as: 'c',
                  cond: {
                    $eq: ['$$c._id', '$addedAccounts.selectedContent.campaignContentItemId'],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $set: {
          _descObj: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ['$_contentItem.descriptions', []] },
                  as: 'd',
                  cond: { $eq: ['$$d._id', '$addedAccounts.selectedContent.descriptionId'] },
                },
              },
              0,
            ],
          },
        },
      },
    ];
  }

  // for getting client company / firstName
  private buildClientNameProjection(defaultValue: string) {
    return {
      $ifNull: [
        {
          $cond: {
            if: {
              $and: [{ $ne: ['$client.company', null] }, { $ne: ['$client.company', ''] }],
            },
            then: '$client.company',
            else: '$client.firstName',
          },
        },
        defaultValue,
      ],
    };
  }

  // for getting social account id from promo
  private buildSocialAccountIdProjection() {
    return {
      $cond: [
        { $ifNull: ['$addedAccounts.accountId', false] },
        { $toString: '$addedAccounts.accountId' },
        null,
      ],
    };
  }

  // for searching promos with filters
  private buildPromoBase(influencerId: Types.ObjectId) {
    return [
      { $match: { 'addedAccounts.influencerId': influencerId } },
      { $unwind: '$addedAccounts' },
      { $match: { 'addedAccounts.influencerId': influencerId } },
    ];
  }

  // formatting createdAt field (DD.MM.YYYY)
  private buildCreatedAtProjection() {
    return {
      $concat: [
        { $dateToString: { date: '$createdAt', format: '%d.%m.' } },
        { $substr: [{ $dateToString: { date: '$createdAt', format: '%Y' } }, 2, 2] },
      ],
    };
  }

  private buildStatusStages(status: InfluencerDashboardPromoStatusRequest): PipelineStage[] {
    switch (status) {
      case InfluencerDashboardPromoStatusRequest.new:
        return [{ $match: { 'addedAccounts.confirmation': 'wait' } }];

      case InfluencerDashboardPromoStatusRequest.ongoing:
        return [
          {
            $match: {
              'addedAccounts.confirmation': 'accept',
              'addedAccounts.closePromo': 'wait',
            },
          },
        ];

      case InfluencerDashboardPromoStatusRequest.close:
        return [{ $match: { 'addedAccounts.closePromo': 'close' } }];

      case InfluencerDashboardPromoStatusRequest.all:
      default:
        return [];
    }
  }

  // Replace influencerId in each ongoing promo (for migrate social account to another owner)
  async replaceInfluencerIdInOngoingPromos(
    context: SocialAccountMigrationContext,
    session: ClientSession,
  ): Promise<void> {
    const { targetInfluencerId, sourceInfluencerId } = context;

    if (!targetInfluencerId || !sourceInfluencerId)
      throw new BadRequestException('Not enough arguments');

    await this.campaignRepo.replaceInfluencerId(
      sourceInfluencerId.toString(),
      targetInfluencerId.toString(),
      { session },
    );
  }

  // For adding logoUrl to each promo
  private enrichPromosWithLogos(
    influencer: any,
    promos: InfluencerNewPromoRequest[] | InfluencerCompletedPromo[] | InfluencerOngoingPromo[],
  ) {
    const platforms: SocialMediaEnum[] = Object.values(SocialMediaEnum);

    const byId = new Map<string, string>(); // `${platform}:${id}` -> logoUrl
    const byUsername = new Map<string, string>(); // `${platform}:u:${username}` -> logoUrl

    // creating keys and setting logos
    for (const platform of platforms) {
      const arr = (influencer as any)[platform] as
        | Array<{
            _id?: any;
            username?: string;
            logoUrl?: string;
          }>
        | undefined;
      if (!arr?.length) continue;

      for (const acc of arr) {
        const logo = acc.logoUrl ?? '';
        if (!logo) continue;

        if (acc._id) byId.set(`${platform}:${acc._id.toString()}`, logo);
        if (acc.username) byUsername.set(`${platform}:u:${acc.username.toLowerCase()}`, logo);
      }
    }

    // adding logo to each promo
    return promos.map((p) => {
      const platform = p.accountSocialMedia as SocialMediaEnum;

      let logo = '';

      if (p.socialAccountId) {
        logo = byId.get(`${platform}:${p.socialAccountId}`) ?? '';
      }

      if (!logo && p.username) {
        logo = byUsername.get(`${platform}:u:${p.username.toLowerCase()}`) ?? '';
      }

      return {
        ...p,
        logoUrl: logo,
      };
    });
  }

  /// -------------- SERVICES ------------------

  // [NEW REQUEST] Gets new promo requests for influencer (find by influencerId) [GET MANY]
  async getNewPromos(data: {
    limit: number;
    page: number;
    influencerId: string;
  }): Promise<InfluencerNewPromoRequest[]> {
    const influencerId = data.influencerId;

    const limit = Number(data.limit ?? 12);
    const page = Number(data.page ?? 1);

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new BadRequestException('Invalid limit');
    }
    if (!Number.isInteger(page) || page <= 0) {
      throw new BadRequestException('Invalid page');
    }

    const skip = (page - 1) * limit;

    if (!influencerId) throw new BadRequestException('Not enough arguments');

    const influencer = await this.influencerRepo.findById(influencerId).select({
      'instagram._id': 1,
      'instagram.username': 1,
      'instagram.logoUrl': 1,
      'tiktok._id': 1,
      'tiktok.username': 1,
      'tiktok.logoUrl': 1,
      'facebook._id': 1,
      'facebook.username': 1,
      'facebook.logoUrl': 1,
      'youtube._id': 1,
      'youtube.username': 1,
      'youtube.logoUrl': 1,
      'spotify._id': 1,
      'spotify.username': 1,
      'spotify.logoUrl': 1,
      'soundcloud._id': 1,
      'soundcloud.username': 1,
      'soundcloud.logoUrl': 1,
      'press._id': 1,
      'press.username': 1,
      'press.logoUrl': 1,
    });
    if (!influencer) throw new NotFoundException('Influencer not found');

    const influencerObjectId = new Types.ObjectId(influencerId);

    const pipeline: PipelineStage[] = [
      ...this.buildPromoBase(influencerObjectId),

      {
        $match: {
          verifyCampaign: CampaignConfirmationEnum.accept,
          'addedAccounts.confirmation': InfluencerConfirmationStatusEnum.wait,
          'addedAccounts.selectedContent.campaignContentItemId': { $exists: true, $ne: null },
        },
      },

      ...this.buildClientJoin(),

      ...this.buildCampaignContentComputed(),

      ...this.buildPromoSortPage(skip, limit),

      {
        $project: {
          _id: 0,

          campaignId: { $toString: '$_id' },
          influencerId: { $toString: '$addedAccounts.influencerId' },
          addedAccountsId: { $toString: '$addedAccounts._id' },

          socialAccountId: this.buildSocialAccountIdProjection(),

          campaignName: '$campaignName',

          username: {
            $ifNull: [
              '$addedAccounts.username',
              {
                $ifNull: ['$addedAccounts.socialMediaUsername', '$addedAccounts.instagramUsername'],
              },
            ],
          },

          accountSocialMedia: '$addedAccounts.socialMedia',

          dateRequest: { $ifNull: ['$addedAccounts.dateRequest', null] },

          createdAt: this.buildCreatedAtProjection(),

          mainLink: { $ifNull: ['$_contentItem.mainLink', ''] },
          description: { $ifNull: ['$_descObj.description', ''] },

          taggedUser: { $ifNull: ['$_contentItem.taggedUser', null] },
          taggedLink: { $ifNull: ['$_contentItem.taggedLink', null] },
          additionalBrief: { $ifNull: ['$_contentItem.additionalBrief', null] },

          userId: { $toString: { $ifNull: ['$clientId', '$userId'] } },

          clientName: this.buildClientNameProjection('No information'),
        },
      },
    ] as PipelineStage[];

    const promos: InfluencerNewPromoRequest[] = await this.campaignRepo
      .aggregate<InfluencerNewPromoRequest>(pipeline, { allowDiskUse: true })
      .exec();

    if (!promos || promos.length === 0) {
      return [];
    }

    return this.enrichPromosWithLogos(influencer, promos);
  }

  // [NEW REQUEST] Gets new promo requests fo influencer (find by id, addedAccountsId) [GET ONE]
  async getNewPromo(
    influencerId: string,
    campaignId: string,
    addedAccountsId: string,
  ): Promise<InfluencerNewPromoRequestDto> {
    if (!campaignId || !addedAccountsId) {
      throw new BadRequestException('Not enough arguments');
    }

    const influencer = await this.influencerRepo.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    const elem = {
      _id: new Types.ObjectId(addedAccountsId),
      confirmation: InfluencerConfirmationStatusEnum.wait,
      closePromo: InfluencerPromoClosedStatusEnum.wait,
    };

    const campaign = await this.campaignRepo.findOne(
      {
        _id: new ObjId(campaignId),
        addedAccounts: { $elemMatch: elem },
      },
      { lean: true },
    );
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const client = await this.clientRepo.findById(campaign.clientId.toString());
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const selectedInfluencer = campaign.addedAccounts.find(
      (item) => item._id.toString() === addedAccountsId,
    );

    const accountSocialMedia = selectedInfluencer.socialMedia ?? undefined;

    if (!accountSocialMedia) {
      console.error(
        `Campaign ${campaignId} doesn't provide social media for promo ${addedAccountsId}`,
      );
      throw new InternalServerErrorException('Social media for this account was not provided');
    }

    const accountLogo =
      influencer[accountSocialMedia].find(
        (acc) => acc._id.toString() === selectedInfluencer?.accountId?.toString(),
      )?.logoUrl ?? null;

    if (!selectedInfluencer) {
      throw new NotFoundException('Social account not found');
    }

    if (!campaign.campaignContent || !selectedInfluencer.selectedContent) {
      throw new BadRequestException('Campaign content not found');
    }

    const selectedCampaignContentItem = campaign.campaignContent.find(
      (item) =>
        item._id.toString() === selectedInfluencer.selectedContent.campaignContentItemId.toString(),
    );

    if (!selectedCampaignContentItem) {
      throw new NotFoundException('Campaign content item not found');
    }

    const postDescription =
      selectedCampaignContentItem.descriptions?.find(
        (pd) => pd._id.toString() === selectedInfluencer.selectedContent.descriptionId?.toString(),
      )?.description ?? '';

    return {
      campaignId: campaign._id.toString(),
      influencerId: selectedInfluencer.influencerId.toString(),
      addedAccountsId: addedAccountsId,
      socialAccountId: selectedInfluencer?.accountId?.toString() ?? undefined,
      campaignName: campaign.campaignName,
      username: selectedInfluencer.username,
      logoUrl: accountLogo ?? null,
      accountSocialMedia: selectedInfluencer.socialMedia as SocialMediaType,
      dateRequest: selectedInfluencer.dateRequest,
      createdAt: formatDate(campaign.createdAt),
      mainLink: selectedCampaignContentItem.mainLink,
      description: postDescription,
      taggedUser: selectedCampaignContentItem.taggedUser,
      taggedLink: selectedCampaignContentItem.taggedLink,
      additionalBrief: selectedCampaignContentItem.additionalBrief,
      clientName: client.company ?? client.firstName ?? 'Unknown',
    } satisfies InfluencerNewPromoRequestDto;
  }

  // [NEW REQUEST] Updates confirmation status for new promo request [UPDATE ONE]
  async updateResponseNewCampaign(
    data: InfluencerUpdatePromoResponseUpdateDto & { influencerId: string },
  ): Promise<void> {
    const { influencerId, username, campaignId, campaignResponse, addedAccountsId } = data;

    if (!username || !campaignId || !campaignResponse || !addedAccountsId) {
      throw new BadRequestException('Not enough arguments');
    }

    const campaign = await this.campaignRepo.findById(campaignId).lean().exec();
    if (!campaign) throw new NotFoundException('Promo not found');

    const selectedAcc = campaign.addedAccounts.find(
      (acc) => acc._id.toString() === addedAccountsId,
    );
    if (!selectedAcc) throw new NotFoundException('Selected influencer not found');

    const session = await this.campaignRepo.startSession();
    session.startTransaction();

    try {
      const isAccept = campaignResponse === InfluencerConfirmationStatusEnum.accept;

      await this.influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory(
        {
          influencerId,
          campaignId: campaign._id.toString(),
          campaignName: campaign.campaignName,
          updatedCampaignAction: {
            addedAccountsId: selectedAcc._id,
            socialAccountId: selectedAcc.accountId,
            actionNumber: isAccept ? 1 : 5,
            networkUsername: selectedAcc.username,
            socialMedia: selectedAcc.socialMedia,
            rewardForInfluencer: selectedAcc.price,
          },
        },
        session,
      );

      const updated = await this.campaignRepo.findOneAndUpdate(
        {
          _id: new Types.ObjectId(campaignId),
          addedAccounts: {
            $elemMatch: { _id: new Types.ObjectId(addedAccountsId) },
          },
        },
        {
          $set: {
            ...(isAccept ? { statusCampaign: CampaignStatusEnum.distributing } : {}),

            'addedAccounts.$.confirmation': campaignResponse,
          },
          ...(isAccept
            ? {}
            : {
                $inc: {
                  partialRefund: selectedAcc.price,
                },
              }),
        },
        { session, new: true },
      );

      if (!updated) {
        throw new NotFoundException('Campaign or account not found');
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    try {
      const influencer = await this.influencerRepo.findById(influencerId);
      const client = await this.clientRepo.findById(campaign.clientId || (campaign as any).userId);

      switch (campaignResponse) {
        case InfluencerConfirmationStatusEnum.accept: {
          const contentItem = campaign.campaignContent?.find(
            (item) =>
              item._id.toString() ===
              selectedAcc.selectedContent?.campaignContentItemId?.toString(),
          );

          const postDescription =
            contentItem?.descriptions?.find(
              (pd) => pd._id.toString() === selectedAcc.selectedContent?.descriptionId?.toString(),
            )?.description ?? '';

          // todo: rework

          //            await sendMail(
          //                'admin@soundinfluencers.com',
          //                'SoundInfluencers',
          //                `<p>${influencer.email} accepted the offer for ${client.email}'s campaign</p>
          // <p><b>Campaign:</b> ${campaign.campaignName}</p>
          // ${
          //                    contentItem
          //                        ? `
          //   <a href="${contentItem.mainLink}">${contentItem.mainLink}</a>
          //   ${postDescription ? `<p><b>Description:</b> ${postDescription}</p>` : ''}
          //   ${contentItem.taggedUser ? `<p><b>Story Tag:</b> ${contentItem.taggedUser}</p>` : ''}
          //   ${contentItem.taggedLink ? `<p><b>Swipe Up Link:</b> ${contentItem.taggedLink}</p>` : ''}
          //   ${contentItem.additionalBrief ? `<p><b>Special Wishes:</b> ${contentItem.additionalBrief}</p>` : ''}
          // `
          //                        : ''
          //                }`,
          //                'html',
          //            );
          break;
        }

        case InfluencerConfirmationStatusEnum.decline: {
          //            await sendMail(
          //                'admin@soundinfluencers.com',
          //                'SoundInfluencers',
          //                `<p>${influencer.email} declined the offer for ${client.email}'s campaign</p>
          // <p><b>Campaign:</b> ${campaign.campaignName}</p>`,
          //                'html',
          //            );
          break;
        }

        case InfluencerConfirmationStatusEnum.wait:
        default:
          break;
      }
    } catch (err) {
      throw new Error(
        `${data.addedAccountsId} ${data.username} response to ${data.campaignId} updated, but email failed, ${err}`,
      );
    }
  }

  // [DASHBOARD] Returns influencer's promos for dashboard [GET MANY]
  async getDashboardPromos(
    data: InfluencerGetDashboardPromosQueryDto,
  ): Promise<InfluencerDashboardPromo[]> {
    const influencerId = data.influencerId;
    const status = data.status ?? InfluencerDashboardPromoStatusRequest.all;
    const limit = Number(data.limit ?? 12);
    const page = Number(data.page ?? 1);

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new BadRequestException('Invalid limit');
    }
    if (!Number.isInteger(page) || page <= 0) {
      throw new BadRequestException('Invalid page');
    }

    const skip = (page - 1) * limit;

    const influencerExists = await this.influencerRepo.exists({
      _id: new Types.ObjectId(influencerId),
    });
    if (!influencerExists) {
      throw new NotFoundException('Influencer not found');
    }

    const influencerObjectId = new Types.ObjectId(influencerId);

    const base = [
      { $match: { verifyCampaign: 'accept' } },

      { $match: { 'addedAccounts.influencerId': influencerObjectId } },

      { $unwind: '$addedAccounts' },

      { $match: { 'addedAccounts.influencerId': influencerObjectId } },

      { $match: { 'addedAccounts.isDeleted': { $ne: true } } },

      {
        $match: { 'addedAccounts.confirmation': { $ne: InfluencerConfirmationStatusEnum.decline } },
      },
    ];

    const includeCompleted =
      status === InfluencerDashboardPromoStatusRequest.close ||
      status === InfluencerDashboardPromoStatusRequest.all;

    const statusStages = this.buildStatusStages(status);

    const completedCollName = 'completedcampaigns';

    const pipeline: any[] = [
      ...base,
      { $addFields: { source: 'campaigns' } },

      ...(includeCompleted
        ? [
            {
              $unionWith: {
                coll: completedCollName,
                pipeline: [...base, { $addFields: { source: 'completedCampaigns' } }],
              },
            },
          ]
        : []),

      ...statusStages,

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      {
        $project: {
          _id: 0,
          campaignId: '$_id',
          addedAccountsId: '$addedAccounts._id',
          campaignName: 1,
          socialMedia: '$addedAccounts.socialMedia',
          reward: '$addedAccounts.price',
          statusCampaign: 1,
          closedStatus: '$addedAccounts.closePromo',
          confirmation: '$addedAccounts.confirmation',
          createdAt: 1,
          source: 1,
        },
      },

      {
        $addFields: {
          createdAt: {
            $concat: [
              { $dateToString: { date: '$createdAt', format: '%d.%m.' } },
              {
                $substr: [{ $dateToString: { date: '$createdAt', format: '%Y' } }, 2, 2],
              },
            ],
          },
        },
      },
    ];

    return this.campaignRepo
      .aggregate<InfluencerDashboardPromo>(pipeline, { allowDiskUse: true })
      .exec();
  }

  // [COMPLETED] Returns influencer's detailed completed promos [GET MANY]
  async getCompletedPromos(data: {
    limit: number;
    page: number;
    influencerId: string;
  }): Promise<InfluencerCompletedPromo[]> {
    const influencerId = data.influencerId;

    const limit = Number(data.limit ?? 12);
    const page = Number(data.page ?? 1);

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new BadRequestException('Invalid limit');
    }
    if (!Number.isInteger(page) || page <= 0) {
      throw new BadRequestException('Invalid page');
    }

    const skip = (page - 1) * limit;

    const influencer = await this.influencerRepo.findById(influencerId).select({
      'instagram._id': 1,
      'instagram.username': 1,
      'instagram.logoUrl': 1,
      'tiktok._id': 1,
      'tiktok.username': 1,
      'tiktok.logoUrl': 1,
      'facebook._id': 1,
      'facebook.username': 1,
      'facebook.logoUrl': 1,
      'youtube._id': 1,
      'youtube.username': 1,
      'youtube.logoUrl': 1,
      'spotify._id': 1,
      'spotify.username': 1,
      'spotify.logoUrl': 1,
      'soundcloud._id': 1,
      'soundcloud.username': 1,
      'soundcloud.logoUrl': 1,
      'press._id': 1,
      'press.username': 1,
      'press.logoUrl': 1,
    });
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    const influencerObjectId = new Types.ObjectId(influencerId);

    const base: any[] = [
      ...this.buildPromoBase(influencerObjectId),
      {
        $match: {
          'addedAccounts.closePromo': 'close',
        },
      },
      ...this.buildClientJoin(),
    ];

    const completedCollName =
      (this.completedCampaignRepo as any)?.collectionName ??
      (this.completedCampaignRepo as any)?.model?.collection?.name ??
      'completedcampaigns';

    const pipeline: PipelineStage[] = [
      ...base,
      { $unionWith: { coll: completedCollName, pipeline: base } },

      ...this.buildCampaignSortPage(skip, limit),

      {
        $project: {
          _id: 0,
          campaignId: { $toString: '$_id' },
          addedAccountsId: { $toString: '$addedAccounts._id' },

          socialAccountId: this.buildSocialAccountIdProjection(),

          campaignName: '$campaignName',
          username: '$addedAccounts.username',
          accountSocialMedia: '$addedAccounts.socialMedia',

          reward: { $toDouble: '$addedAccounts.price' },
          postLink: '$addedAccounts.postLink',

          clientName: this.buildClientNameProjection('Unknown'),

          createdAt: this.buildCreatedAtProjection(),
        },
      },
    ] as PipelineStage[];

    const promos: InfluencerCompletedPromo[] = await this.campaignRepo
      .aggregate<InfluencerCompletedPromo>(pipeline, { allowDiskUse: true })
      .exec();

    return this.enrichPromosWithLogos(influencer, promos);
  }

  // [COMPLETED] Returns influencer past promo (find by id, addedAccountsId) [GET ONE]
  async getCompletedPromo(
    influencerId: string,
    campaignId: string,
    addedAccountsId: string,
  ): Promise<InfluencerCompletedPromo> {
    if (!influencerId || !campaignId || !addedAccountsId)
      throw new BadRequestException('Not enough arguments');

    const influencer = await this.influencerRepo.findById(influencerId);
    if (!influencer) throw new NotFoundException('Influencer not found');

    const elem = {
      _id: new Types.ObjectId(addedAccountsId),
      confirmation: {
        $in: [InfluencerConfirmationStatusEnum.accept, InfluencerConfirmationStatusEnum.wait],
      },
      closePromo: InfluencerPromoClosedStatusEnum.close,
    };

    let campaign: Campaign | CompletedCampaign = await this.completedCampaignRepo.findOne(
      {
        _id: new Types.ObjectId(campaignId),
        addedAccounts: { $elemMatch: elem },
      },
      { lean: true },
    );

    if (!campaign) {
      campaign = await this.campaignRepo.findOne(
        {
          _id: new Types.ObjectId(campaignId),
          addedAccounts: { $elemMatch: elem },
        },
        { lean: true },
      );
    }

    if (!campaign) throw new NotFoundException('Campaign not found');

    const client = await this.clientRepo.findById(campaign.clientId || (campaign as any).userId);

    if (!client) throw new NotFoundException('Client not found');

    const selectedAccount = campaign.addedAccounts.find(
      (influencerItem) => influencerItem._id.toString() === addedAccountsId,
    );

    if (!selectedAccount)
      throw new NotFoundException(`Influencer's social account not found in this campaign`);

    const accountSocialMedia = selectedAccount.socialMedia ?? undefined;

    if (!accountSocialMedia) {
      console.error(
        `Campaign ${campaignId} doesn't provide social media for promo ${addedAccountsId}`,
      );
      throw new InternalServerErrorException('Social media for this account was not provided');
    }

    const accountLogo =
      influencer[accountSocialMedia].find(
        (acc) => acc._id.toString() === selectedAccount?.accountId?.toString(),
      )?.logoUrl ?? null;

    let contentItem: {
      _id: string;
      mainLink: string;
      description: string;
      taggedUser: string;
      taggedLink: string;
      additionalBrief: string;
    } | null = null;

    if (
      selectedAccount.selectedContent?.campaignContentItemId ||
      (selectedAccount as any).selectedCampaignContentItem
    ) {
      const foundContent = campaign.campaignContent.find(
        (item) =>
          item._id.toString() ===
            selectedAccount.selectedContent?.campaignContentItemId?.toString() ||
          item._id.toString() === (selectedAccount as any).selectedCampaignContentItem,
      );

      if (foundContent) {
        const foundPostDescription =
          foundContent.descriptions?.find(
            (pd) => pd._id.toString() === selectedAccount.selectedContent?.descriptionId.toString(),
          )?.description ??
          (foundContent as any).postDescription ??
          '';

        contentItem = {
          _id: foundContent._id.toString(),
          mainLink: foundContent.mainLink,
          description: foundPostDescription || null,
          taggedUser: foundContent.taggedUser || null,
          taggedLink: foundContent.taggedLink || null,
          additionalBrief: foundContent.additionalBrief,
        };
      }
    }

    if (!contentItem) throw new NotFoundException(`Content item not found`);

    return {
      campaignId: campaignId,
      influencerId: influencerId,
      addedAccountsId: addedAccountsId,
      socialAccountId: selectedAccount?.accountId?.toString() ?? undefined,
      campaignName: campaign.campaignName,
      username:
        selectedAccount.username ??
        (selectedAccount as any).socialMediaUsernamea ??
        (selectedAccount as any).instagramUsername,
      logoUrl: accountLogo ?? null,
      createdAt: formatDate(campaign.createdAt),
      postLink: selectedAccount.postLink,
      reward: selectedAccount.price,
      clientName: client?.company || client?.firstName || 'No information',
      accountSocialMedia: selectedAccount.socialMedia as SocialMediaType,
    };
  }

  // [ONGOING] Returns influencer's detailed completed promos [GET MANY]
  async getOngoingPromos(data: {
    limit: number;
    page: number;
    influencerId: string;
  }): Promise<InfluencerOngoingPromo[]> {
    const influencerId = data.influencerId;

    const limit = Number(data.limit ?? 12);
    const page = Number(data.page ?? 1);

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new BadRequestException('Invalid limit');
    }
    if (!Number.isInteger(page) || page <= 0) {
      throw new BadRequestException('Invalid page');
    }

    const skip = (page - 1) * limit;

    const influencer = await this.influencerRepo.findById(influencerId).select({
      'instagram._id': 1,
      'instagram.username': 1,
      'instagram.logoUrl': 1,
      'tiktok._id': 1,
      'tiktok.username': 1,
      'tiktok.logoUrl': 1,
      'facebook._id': 1,
      'facebook.username': 1,
      'facebook.logoUrl': 1,
      'youtube._id': 1,
      'youtube.username': 1,
      'youtube.logoUrl': 1,
      'spotify._id': 1,
      'spotify.username': 1,
      'spotify.logoUrl': 1,
      'soundcloud._id': 1,
      'soundcloud.username': 1,
      'soundcloud.logoUrl': 1,
      'press._id': 1,
      'press.username': 1,
      'press.logoUrl': 1,
    });
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    const influencerObjectId = new Types.ObjectId(influencerId);

    const pipeline: PipelineStage[] = [
      ...this.buildPromoBase(influencerObjectId),

      {
        $match: {
          'addedAccounts.confirmation': 'accept',
          'addedAccounts.closePromo': 'wait',
        },
      },

      ...this.buildClientJoin(),

      ...this.buildCampaignContentComputed(),

      ...this.buildPromoSortPage(skip, limit),

      {
        $project: {
          _id: 0,
          campaignId: { $toString: '$_id' },
          addedAccountsId: { $toString: '$addedAccounts._id' },

          socialAccountId: this.buildSocialAccountIdProjection(),

          campaignName: '$campaignName',
          username: '$addedAccounts.username',

          accountSocialMedia: '$addedAccounts.socialMedia',

          reward: '$addedAccounts.price',
          postLink: { $ifNull: ['$addedAccounts.postLink', null] },
          dateRequest: { $ifNull: ['$addedAccounts.dateRequest', null] },

          mainLink: { $ifNull: ['$_contentItem.mainLink', null] },
          description: { $ifNull: ['$_descObj.description', null] },
          taggedUser: { $ifNull: ['$_contentItem.taggedUser', null] },
          taggedLink: { $ifNull: ['$_contentItem.taggedLink', null] },
          additionalBrief: { $ifNull: ['$_contentItem.additionalBrief', null] },

          clientName: this.buildClientNameProjection('Unknown'),

          createdAt: this.buildCreatedAtProjection(),
        },
      },
    ] as PipelineStage[];

    const promos: InfluencerOngoingPromo[] = await this.campaignRepo
      .aggregate<InfluencerOngoingPromo>(pipeline, { allowDiskUse: true })
      .exec();

    return this.enrichPromosWithLogos(influencer, promos);
  }

  // [ONGOING] Return's influencer's detailed ongoing promo [GET ONE]
  async getOngoingPromo(
    influencerId: string,
    campaignId: string,
    addedAccountsId: string,
  ): Promise<InfluencerOngoingPromo> {
    if (!campaignId || !addedAccountsId) {
      throw new BadRequestException('Not enough arguments');
    }

    const influencer = await this.influencerRepo.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    const elem = {
      _id: new Types.ObjectId(addedAccountsId),
      confirmation: InfluencerConfirmationStatusEnum.accept,
      closePromo: InfluencerPromoClosedStatusEnum.wait,
    };

    const campaign = await this.campaignRepo.findOne(
      {
        _id: new ObjId(campaignId),
        addedAccounts: { $elemMatch: elem },
      },
      { lean: true },
    );
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const client = await this.clientRepo.findById(campaign.clientId.toString());
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const selectedInfluencer = campaign.addedAccounts.find(
      (item) => item._id.toString() === addedAccountsId,
    );

    if (!selectedInfluencer) {
      throw new NotFoundException('Social account not found');
    }

    const accountSocialMedia = selectedInfluencer.socialMedia ?? undefined;

    if (!accountSocialMedia) {
      console.error(
        `Campaign ${campaignId} doesn't provide social media for promo ${addedAccountsId}`,
      );
      throw new InternalServerErrorException('Social media for this account was not provided');
    }

    const accountLogo =
      influencer[accountSocialMedia].find(
        (acc) => acc._id.toString() === selectedInfluencer?.accountId?.toString(),
      )?.logoUrl ?? null;

    if (!campaign.campaignContent || !selectedInfluencer.selectedContent) {
      throw new BadRequestException('Campaign content not found');
    }

    const selectedCampaignContentItem = campaign.campaignContent.find(
      (item) =>
        item._id.toString() === selectedInfluencer.selectedContent.campaignContentItemId.toString(),
    );

    if (!selectedCampaignContentItem) {
      throw new NotFoundException('Campaign content item not found');
    }

    const postDescription =
      selectedCampaignContentItem.descriptions?.find(
        (pd) => pd._id.toString() === selectedInfluencer.selectedContent.descriptionId?.toString(),
      )?.description ?? '';

    return {
      campaignId: campaign._id.toString(),
      influencerId: selectedInfluencer.influencerId.toString(),
      addedAccountsId: addedAccountsId,
      socialAccountId: selectedInfluencer?.accountId?.toString() ?? undefined,
      campaignName: campaign.campaignName,
      username: selectedInfluencer.username,
      logoUrl: accountLogo ?? null,
      accountSocialMedia: selectedInfluencer.socialMedia as SocialMediaType,
      dateRequest: selectedInfluencer.dateRequest,
      createdAt: formatDate(campaign.createdAt),
      reward: selectedInfluencer.price,
      mainLink: selectedCampaignContentItem.mainLink,
      description: postDescription,
      taggedUser: selectedCampaignContentItem.taggedUser,
      taggedLink: selectedCampaignContentItem.taggedLink,
      additionalBrief: selectedCampaignContentItem.additionalBrief,
      clientName: client.company,
      statusCampaign: campaign.statusCampaign,
      closedStatus: selectedInfluencer.closePromo as InfluencerPromoClosedStatusType,
      confirmation: selectedInfluencer.confirmation as InfluencerConfirmationStatusType,
    } satisfies InfluencerOngoingPromo;
  }

  // [ONGOING] Closing influencer's promo [UPDATE ONE]
  async updateOngoingCampaign(data: InfluencerUpdatePromoReqBodyDto): Promise<{ balance: number }> {
    const { influencerId, campaignId, username, addedAccountsId, data: postDetails } = data;

    if (!influencerId || !campaignId || !username || !addedAccountsId || !postDetails) {
      throw new BadRequestException('Not enough arguments');
    }

    const campaign = await this.campaignRepo.findOne(
      {
        _id: new Types.ObjectId(campaignId),
        addedAccounts: {
          $elemMatch: {
            influencerId: new Types.ObjectId(influencerId),
            _id: new Types.ObjectId(addedAccountsId),
          },
        },
      },
      { lean: true },
    );

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const socialAccount = campaign.addedAccounts.find(
      (item) => item._id.toString() === addedAccountsId,
    );

    if (!socialAccount) {
      throw new NotFoundException(`Social account not found in campaign ${campaign.campaignName}`);
    }

    const validationStrategy = this.validationStrategyFactory.get(socialAccount.socialMedia);
    validationStrategy.validate(postDetails);

    const session = await this.campaignRepo.startSession();
    session.startTransaction();

    try {
      const updatePayload = Object.fromEntries(
        Object.entries({
          ...postDetails,
          closePromo: InfluencerPromoClosedStatusEnum.close,
          invoiceStatus: InvoiceStatusEnum.wait,
          screenshot: postDetails?.screenshotUrl ?? null,
        }).map(([key, value]) => [`addedAccounts.$.${key}`, value]),
      );

      const updateResult = await this.campaignRepo.updateOne(
        {
          _id: new Types.ObjectId(campaignId),
          'addedAccounts._id': new Types.ObjectId(addedAccountsId),
        },
        { $set: updatePayload },
        { session },
      );

      if (updateResult.modifiedCount === 0) {
        throw new ConflictException('Promo was closed by another request');
      }

      const reward = socialAccount.price;
      if (typeof reward !== 'number' || Number.isNaN(reward)) {
        throw new InternalServerErrorException('Invalid influencer reward in database');
      }

      const updatedInfluencer = await this.influencerRepo.findOneAndUpdate(
        { _id: new Types.ObjectId(influencerId) },
        { $inc: { balance: reward } },
        { session, new: true },
      );

      if (!updatedInfluencer) {
        throw new InternalServerErrorException("Can't update influencer's balance");
      }

      await this.influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory(
        {
          influencerId,
          campaignId,
          campaignName: campaign.campaignName,
          updatedCampaignAction: {
            addedAccountsId: new ObjId(addedAccountsId),
            socialAccountId: socialAccount._id,
            actionNumber: 2,
            networkUsername: username,
            rewardForInfluencer: socialAccount.price,
            socialMedia: socialAccount.socialMedia,
          },
        },
        session,
      );

      await session.commitTransaction();

      return { balance: updatedInfluencer.balance };
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      await session.endSession();
    }
  }
}
