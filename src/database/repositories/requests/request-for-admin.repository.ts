import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../base.repository';
import {
  RequestForAdmin,
  RequestForAdminDocument,
} from '../../schemas/requests/request-for-admin.schema';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { SearchQueryDto } from '../../../common/dto/requests/search-query.dto';
import { PaginationQueryDto } from '../../../common/dto/requests/pagination-query.dto';
import {
  BespokeCampaignRequestDetails,
  CampaignRequestDetails,
  IAdminRequest,
  NewClientRequestDetails,
  NewInfluencerRequestDetails,
  PriceUpdateRequestDetails,
  RequestForAdminType,
  RequestLifecycleState,
} from '../../../common/types/request-for-admin/request-for-admin.types';
import { AdminRequestsQueryDto } from '../../../modules/admin/dto/requests/admin-requests.dto';

// Interface for admin requests repository
interface IRequestForAdminRepository {
  // Search for admin requests
  search(query: SearchQueryDto): Promise<{
    items: IAdminRequest[];
    total: number;
    limit: number;
  }>;

  // Get paginated list of admin requests
  getPaginatedList(query: PaginationQueryDto): Promise<{
    items: IAdminRequest[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  // Get details of NEW_CLIENT_REQUEST request
  getNewClientRequestDetails(requestId: string): Promise<NewClientRequestDetails | null>;

  // Get details of CAMPAIGN_REQUEST request
  getCampaignRequestDetails(requestId: string): Promise<CampaignRequestDetails | null>;

  // Get details of BESPOKE_CAMPAIGN_REQUEST request
  getBespokeCampaignRequestDetails(
    requestId: string,
  ): Promise<BespokeCampaignRequestDetails | null>;

  // Get details of NEW_INFLUENCER_REQUEST request
  getNewInfluencerRequestDetails(requestId: string): Promise<NewInfluencerRequestDetails | null>;

  // Get details of PRICE_UPDATE_REQUEST request
  getPriceUpdateRequestDetails(requestId: string): Promise<PriceUpdateRequestDetails | null>;
}

@Injectable()
export class RequestForAdminRepository
  extends BaseRepository<RequestForAdmin>
  implements IRequestForAdminRepository
{
  constructor(
    @InjectModel(RequestForAdmin.name)
    private readonly requestForAdmin: Model<RequestForAdmin>,
  ) {
    super(requestForAdmin);
  }

  // Search for admin requests
  async search(
    query: SearchQueryDto,
  ): Promise<{ items: IAdminRequest[]; total: number; limit: number }> {
    const limit = query.limit ?? 10;
    const rawSearch = query.search?.trim();

    const escapedSearch = rawSearch ? rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;

    const matchStage = escapedSearch
      ? {
          $match: {
            $or: [
              { userFirstName: { $regex: escapedSearch, $options: 'i' } },
              { userRole: { $regex: escapedSearch, $options: 'i' } },
            ],
          },
        }
      : null;

    const basePipeline: PipelineStage[] = [
      ...(matchStage ? [matchStage] : []),

      { $sort: { createdAt: -1 } },
      { $limit: limit },

      {
        $project: {
          _id: 1,
          group: 1,
          type: 1,
          lifecycleStatus: 1,
          userFirstName: 1,
          userRole: 1,
          createdAt: 1,
          state: 1,
          specifiedStatus: 1,
        },
      },
    ];

    const totalPipeline: PipelineStage[] = [
      ...(matchStage ? [matchStage] : []),
      { $count: 'total' },
    ];

    const [items, totalResult] = await Promise.all([
      this.requestForAdmin.aggregate<IAdminRequest>(basePipeline),
      this.requestForAdmin.aggregate(totalPipeline),
    ]);

    const total = totalResult[0]?.total ?? 0;

    return {
      items,
      total,
      limit,
    };
  }

  // Get paginated list of admin requests
  async getPaginatedList(query: AdminRequestsQueryDto): Promise<{
    items: IAdminRequest[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<RequestForAdminDocument> = {};

    filter.lifecycleStatus = query.state ?? RequestLifecycleState.OPEN;

    if (query.group) {
      filter.group = query.group;
    }

    const [items, total] = await Promise.all([
      this.requestForAdmin.aggregate<IAdminRequest>([
        {
          $match: filter,
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },

        {
          $project: {
            _id: 1,
            group: 1,
            type: 1,
            lifecycleStatus: 1,
            userFirstName: 1,
            userRole: 1,
            createdAt: 1,
            state: 1,
            specifiedStatus: 1,
          },
        },
      ]),
      this.requestForAdmin.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get details of NEW_CLIENT_REQUEST request
  async getNewClientRequestDetails(requestId: string): Promise<NewClientRequestDetails | null> {
    if (!Types.ObjectId.isValid(requestId)) {
      return null;
    }

    const [result] = await this.requestForAdmin.aggregate<NewClientRequestDetails>([
      {
        $match: {
          _id: new Types.ObjectId(requestId),
          type: RequestForAdminType.NEW_CLIENT_REQUEST,
        },
      },
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'clientInfo',
          pipeline: [
            {
              $project: {
                _id: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                company: 1,
                companyType: 1,
                referalCode: 1,
                instagramUsername: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$clientInfo',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: 1,
          group: 1,
          type: 1,
          lifecycleStatus: 1,
          specifiedStatus: 1,
          userFirstName: 1,
          userRole: 1,
          reviewedAt: 1,
          adminNote: 1,
          createdAt: 1,
          updatedAt: 1,

          clientId: 1,
          rejectionReason: 1,

          lastName: {
            $ifNull: ['$clientInfo.lastName', ''],
          },
          phone: {
            $ifNull: ['$clientInfo.phone', ''],
          },
          email: {
            $ifNull: ['$clientInfo.email', ''],
          },
          company: {
            $ifNull: ['$clientInfo.company', ''],
          },
          companyType: {
            $ifNull: ['$clientInfo.companyType', ''],
          },
          referralCode: {
            $ifNull: ['$clientInfo.referalCode', ''],
          },
          instagramUsername: {
            $ifNull: ['$clientInfo.instagramUsername', ''],
          },
        },
      },
    ]);

    return result ?? null;
  }

  // Get details of CAMPAIGN_REQUEST request
  async getCampaignRequestDetails(requestId: string): Promise<CampaignRequestDetails | null> {
    if (!Types.ObjectId.isValid(requestId)) {
      return null;
    }

    const [result] = await this.requestForAdmin.aggregate<CampaignRequestDetails>([
      {
        $match: {
          _id: new Types.ObjectId(requestId),
          type: RequestForAdminType.CAMPAIGN_REQUEST,
        },
      },
      {
        $lookup: {
          from: 'campaigns',
          localField: 'campaignId',
          foreignField: '_id',
          as: 'campaign',
          pipeline: [
            {
              $project: {
                _id: 1,
                campaignName: 1,
                paymentType: 1,
                campaignContent: 1,
                addedAccounts: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$campaign',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'clientInfo',
          pipeline: [
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$clientInfo',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: 1,
          group: 1,
          type: 1,
          lifecycleStatus: 1,
          specifiedStatus: 1,
          clientId: 1,
          createdAt: 1,

          firstName: { $ifNull: ['$clientInfo.firstName', ''] },
          lastName: { $ifNull: ['$clientInfo.lastName', ''] },
          email: { $ifNull: ['$clientInfo.email', ''] },

          campaignName: '$campaign.campaignName',
          paymentMethod: '$campaign.paymentType',

          items: {
            $map: {
              input: { $ifNull: ['$campaign.campaignContent', []] },
              as: 'item',
              in: {
                socialMedia: '$$item.socialMedia',
                mainLink: '$$item.mainLink',
                additionalBrief: { $ifNull: ['$$item.additionalBrief', null] },
                descriptions: {
                  $map: {
                    input: { $ifNull: ['$$item.descriptions', []] },
                    as: 'desc',
                    in: '$$desc.description',
                  },
                },
                accounts: {
                  $map: {
                    input: {
                      $filter: {
                        input: { $ifNull: ['$campaign.addedAccounts', []] },
                        as: 'acc',
                        cond: {
                          $eq: ['$$acc.selectedContent.campaignContentItemId', '$$item._id'],
                        },
                      },
                    },
                    as: 'acc',
                    in: '$$acc.username',
                  },
                },
              },
            },
          },
        },
      },
    ]);

    return result ?? null;
  }

  // Get details of BESPOKE_CAMPAIGN_REQUEST request
  async getBespokeCampaignRequestDetails(
    requestId: string,
  ): Promise<BespokeCampaignRequestDetails | null> {
    if (!Types.ObjectId.isValid(requestId)) {
      return null;
    }

    const [result] = await this.requestForAdmin.aggregate<BespokeCampaignRequestDetails>([
      {
        $match: {
          _id: new Types.ObjectId(requestId),
          type: RequestForAdminType.BESPOKE_CAMPAIGN_REQUEST,
        },
      },
      {
        $lookup: {
          from: 'bespokecampaignrequests',
          localField: 'bespokeCampaignRequestId',
          foreignField: '_id',
          as: 'bespokeRequest',
          pipeline: [
            {
              $project: {
                _id: 1,
                category: 1,
                campaignGoal: 1,
                contentLink: 1,
                budget: 1,
                targetTerritories: 1,
                extraBriefs: 1,
                trackLink: 1,
                releaseDate: 1,
                smartLink: 1,
                ticketLink: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$bespokeRequest',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'clientInfo',
          pipeline: [
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$clientInfo',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: 1,
          group: 1,
          type: 1,
          lifecycleStatus: 1,
          specifiedStatus: 1,
          clientId: 1,
          createdAt: 1,

          firstName: { $ifNull: ['$clientInfo.firstName', ''] },
          lastName: { $ifNull: ['$clientInfo.lastName', ''] },
          email: { $ifNull: ['$clientInfo.email', ''] },
          phoneNumber: { $ifNull: ['$clientInfo.phone', ''] },

          category: '$bespokeRequest.category',
          campaignGoal: '$bespokeRequest.campaignGoal',
          contentLink: '$bespokeRequest.contentLink',
          budget: '$bespokeRequest.budget',
          targetTerritories: '$bespokeRequest.targetTerritories',
          extraBriefs: '$bespokeRequest.extraBriefs',
          trackLink: '$bespokeRequest.trackLink',
          releaseDate: '$bespokeRequest.releaseDate',
          smartLink: '$bespokeRequest.smartLink',
          ticketLink: '$bespokeRequest.ticketLink',
        },
      },
    ]);

    return result ?? null;
  }

  // Get details of NEW_INFLUENCER_REQUEST request
  async getNewInfluencerRequestDetails(
    requestId: string,
  ): Promise<NewInfluencerRequestDetails | null> {
    if (!Types.ObjectId.isValid(requestId)) {
      return null;
    }

    const socialMediaFields = [
      'instagram',
      'tiktok',
      'spotify',
      'soundcloud',
      'facebook',
      'youtube',
      'press',
    ];

    const accountMap = (field: string) => ({
      $map: {
        input: { $ifNull: [`$influencer.${field}`, []] },
        as: 'acc',
        in: {
          accountId: '$$acc._id',
          username: '$$acc.username',
          profileLink: '$$acc.profileLink',
          followers: '$$acc.followers',
          logoUrl: '$$acc.logoUrl',
          profileCategory: '$$acc.profileCategory',
          price: '$$acc.price',
          initialPrice: '$$acc.initialPrice',
          currency: '$$acc.currency',
          musicGenres: { $ifNull: ['$$acc.musicGenres', []] },
          creatorCategories: { $ifNull: ['$$acc.creatorCategories', []] },
          countries: { $ifNull: ['$$acc.countries', []] },
          categories: { $ifNull: ['$$acc.categories', []] },
          engagementRate: { $ifNull: ['$$acc.engagementRate', null] },
          averageViews: { $ifNull: ['$$acc.averageViews', null] },
        },
      },
    });

    const [result] = await this.requestForAdmin.aggregate<NewInfluencerRequestDetails>([
      {
        $match: {
          _id: new Types.ObjectId(requestId),
          type: RequestForAdminType.NEW_INFLUENCER_REQUEST,
        },
      },
      {
        $lookup: {
          from: 'influencers',
          localField: 'influencerId',
          foreignField: '_id',
          as: 'influencer',
          pipeline: [
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                instagram: 1,
                tiktok: 1,
                spotify: 1,
                soundcloud: 1,
                facebook: 1,
                youtube: 1,
                press: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$influencer',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: 1,
          group: 1,
          type: 1,
          lifecycleStatus: 1,
          specifiedStatus: 1,
          influencerId: 1,
          createdAt: 1,

          firstName: { $ifNull: ['$influencer.firstName', ''] },
          lastName: { $ifNull: ['$influencer.lastName', ''] },
          email: { $ifNull: ['$influencer.email', ''] },
          phone: { $ifNull: ['$influencer.phone', ''] },

          accounts: {
            $concatArrays: socialMediaFields.map((f) => accountMap(f)),
          },
        },
      },
    ]);

    return result ?? null;
  }

  // Get details of PRICE_UPDATE_REQUEST request
  async getPriceUpdateRequestDetails(requestId: string): Promise<PriceUpdateRequestDetails | null> {
    if (!Types.ObjectId.isValid(requestId)) {
      return null;
    }

    const socialMediaFields = [
      'instagram',
      'tiktok',
      'spotify',
      'soundcloud',
      'facebook',
      'youtube',
      'press',
    ];

    const [result] = await this.requestForAdmin.aggregate<PriceUpdateRequestDetails>([
      {
        $match: {
          _id: new Types.ObjectId(requestId),
          type: RequestForAdminType.PRICE_UPDATE_REQUEST,
        },
      },
      {
        $lookup: {
          from: 'influencers',
          localField: 'influencerId',
          foreignField: '_id',
          as: 'influencer',
          pipeline: [
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                ...Object.fromEntries(socialMediaFields.map((f) => [f, 1])),
              },
            },
          ],
        },
      },
      {
        $unwind: { path: '$influencer', preserveNullAndEmptyArrays: false },
      },
      {
        $addFields: {
          accountInfo: {
            $arrayElemAt: [
              {
                $filter: {
                  input: {
                    $switch: {
                      branches: socialMediaFields.map((f) => ({
                        case: { $eq: ['$socialMedia', f] },
                        then: { $ifNull: [`$influencer.${f}`, []] },
                      })),
                      default: [],
                    },
                  },
                  as: 'acc',
                  cond: { $eq: ['$$acc._id', '$socialAccountId'] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          _id: 1,
          group: 1,
          type: 1,
          lifecycleStatus: 1,
          specifiedStatus: 1,
          influencerId: 1,
          socialAccountId: 1,
          socialMedia: 1,
          newPrice: 1,
          currency: 1,
          createdAt: 1,

          firstName: { $ifNull: ['$influencer.firstName', ''] },
          lastName: { $ifNull: ['$influencer.lastName', ''] },
          email: { $ifNull: ['$influencer.email', ''] },
          phone: { $ifNull: ['$influencer.phone', ''] },

          username: { $ifNull: ['$accountInfo.username', ''] },
          currentPrice: { $ifNull: ['$accountInfo.price', 0] },
          currentCurrency: { $ifNull: ['$accountInfo.currency', ''] },
        },
      },
    ]);

    return result ?? null;
  }
}
