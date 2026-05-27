import {
  BespokeCampaignRequestDetails,
  CampaignRequestDetails,
  IAdminRequest,
  NewClientRequestDetails,
  NewInfluencerRequestDetails,
  PriceUpdateRequestDetails,
  RequestForAdminType,
} from '../types/request-for-admin/request-for-admin.types';
import {
  AdminRequestForListDto,
  BespokeCampaignRequestDetailsDto,
  CampaignRequestDetailsDto,
  NewClientRequestDetailsDto,
  NewInfluencerRequestDetailsDto,
  PriceUpdateRequestDetailsDto,
} from '../../modules/admin/dto/requests/admin-requests.dto';
import { formatDate } from '../utils/formatters';

export class AdminRequestMapper {
  static toLabel(type: RequestForAdminType): string {
    switch (type) {
      case RequestForAdminType.NEW_CLIENT_REQUEST:
        return 'Client Registration Request';
      case RequestForAdminType.CAMPAIGN_REQUEST:
        return 'Campaign Request';
      case RequestForAdminType.BESPOKE_CAMPAIGN_REQUEST:
        return 'Bespoke Campaign Request';
      case RequestForAdminType.NEW_INFLUENCER_REQUEST:
        return 'Influencer Registration Request';
      case RequestForAdminType.PRICE_UPDATE_REQUEST:
        return 'Price Update Request';
      default:
        return 'Unknown Request';
    }
  }

  static toDto(request: IAdminRequest): AdminRequestForListDto {
    return {
      requestId: request._id.toString(),
      label: this.toLabel(request.type),
      submittedBy: request.userFirstName,
      date: formatDate(request.createdAt),
      group: request.group,
      type: request.type,
      lifecycleStatus: request.lifecycleStatus,
      specifiedStatus: request.specifiedStatus,
    };
  }

  static toNewClientRequestDetailsDto(
    details: NewClientRequestDetails,
  ): NewClientRequestDetailsDto {
    return {
      requestId: details._id.toString(),
      group: details.group,
      type: details.type,
      date: formatDate(details.createdAt),
      clientId: details.clientId.toString(),
      firstName: details.userFirstName,
      lastName: details.lastName,
      email: details.email,
      phone: details.phone,
      companyName: details.company,
      companyType: details.companyType,
      referralCode: details.referralCode,
    };
  }

  static toCampaignRequestDetailsDto(details: CampaignRequestDetails): CampaignRequestDetailsDto {
    return {
      requestId: details._id.toString(),
      group: details.group,
      type: details.type,
      date: formatDate(details.createdAt),
      clientId: details.clientId.toString(),
      firstName: details.firstName,
      lastName: details.lastName,
      email: details.email,
      campaignName: details.campaignName,
      paymentMethod: details.paymentMethod as any,
      items: details.items as any,
    };
  }

  static toBespokeCampaignRequestDetailsDto(
    details: BespokeCampaignRequestDetails,
  ): BespokeCampaignRequestDetailsDto {
    return {
      requestId: details._id.toString(),
      group: details.group,
      type: details.type,
      date: formatDate(details.createdAt),
      clientId: details.clientId.toString(),
      firstName: details.firstName,
      lastName: details.lastName,
      email: details.email,
      phoneNumber: details.phoneNumber,
      category: details.category as any,
      campaignGoal: details.campaignGoal,
      contentLink: details.contentLink,
      budget: details.budget,
      targetTerritories: details.targetTerritories,
      extraBriefs: details.extraBriefs,
      trackLink: details.trackLink,
      releaseDate: details.releaseDate,
      smartLink: details.smartLink,
      ticketLink: details.ticketLink,
    };
  }

  static toPriceUpdateRequestDetailsDto(
    details: PriceUpdateRequestDetails,
  ): PriceUpdateRequestDetailsDto {
    return {
      requestId: details._id.toString(),
      group: details.group,
      type: details.type,
      date: formatDate(details.createdAt),
      influencerId: details.influencerId.toString(),
      firstName: details.firstName,
      lastName: details.lastName,
      email: details.email,
      phoneNumber: details.phone,
      accountId: details.socialAccountId.toString(),
      username: details.username,
      socialMedia: details.socialMedia as any,
      currentPrice: details.currentPrice,
      currentCurrency: details.currentCurrency,
      newPrice: details.newPrice,
      newCurrency: details.currency,
    };
  }

  static toNewInfluencerRequestDetailsDto(
    details: NewInfluencerRequestDetails,
  ): NewInfluencerRequestDetailsDto {
    return {
      requestId: details._id.toString(),
      group: details.group,
      type: details.type,
      date: formatDate(details.createdAt),
      influencerId: details.influencerId.toString(),
      firstName: details.firstName,
      lastName: details.lastName,
      email: details.email,
      phoneNumber: details.phone,
      accounts: details.accounts.map((acc) => ({
        accountId: acc.accountId.toString(),
        username: acc.username,
        profileLink: acc.profileLink,
        followers: acc.followers,
        logoUrl: acc.logoUrl,
        profileCategory: acc.profileCategory as any,
        price: acc.price,
        initialPrice: acc.initialPrice,
        currency: acc.currency as any,
        musicGenres: acc.musicGenres ?? [],
        creatorCategories: acc.creatorCategories ?? [],
        countries: acc.countries ?? [],
        categories: acc.categories ?? [],
        engagementRate: acc.engagementRate,
        averageViews: acc.averageViews,
      })),
    };
  }
}
