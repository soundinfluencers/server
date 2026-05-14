import {Client} from "../../database/schemas/users/client.schema";
import {ClientAccountDetailsDto} from "../../modules/profile/dto/influencer/get-profile.dto";
import {IAdminClientDetails, IAdminClientListItem, ICampaignForClientDetails} from "../types/client/client.types";
import {
    AdminClientForListDto,
    AdminDetailedClientDto,
    CampaignForClientDetailsDto
} from "../../modules/admin/dto/clients/admin-clients.dto";
import {formatDate} from "../utils/formatters";

// Maps client doc to client account details dto
export const mapClientToAccountDetailsDto = (client: Client): ClientAccountDetailsDto => {
    return {
        firstName: client.firstName,
        logoUrl: client.logoUrl ?? null,
        companyName: client.company,
        email: client.email,
        phone: client.phone,
        isProposal: client.isProposalClient ?? false,
    }
};

// Maps AdminClientListItem to AdminClientForListDto
export const mapReadModelToAdminClientForListDto = (client: IAdminClientListItem): AdminClientForListDto => {
    return {
        clientId: client._id.toString(),
        company: client.company,
        name: `${client.firstName} ${client.lastName ?? ""}`?.trim() ?? "No name",
        email: client.email,
        companyType: client.companyType,
        proposalAccess: client.isProposal,
        campaignsCompleted: client.campaignsCompleted,
        campaignsActive: client.campaignsActive,
    }
}

// Maps IAdminClientDetails to AdminDetailedClientDto
export const mapToAdminDetailedClientDto = (client: IAdminClientDetails): AdminDetailedClientDto => {
    const mapCampaign = (campaign: ICampaignForClientDetails): CampaignForClientDetailsDto => {
        return {
            campaignId: campaign._id.toString(),
            campaignName: campaign.campaignName,
            socialMedia: campaign.socialMedia,
            date: formatDate(campaign.createdAt),
            campaignPrice: campaign.campaignPrice,
        }
    }

    return {
        clientId: client._id.toString(),
        firstName: client.firstName ?? '',
        company: client.company ?? '',
        email: client.email,
        companyType: client.companyType,
        isProposal: client.isProposal,
        ...client.lastName ? {lastName: client.lastName} : undefined,
        ...client.latestCampaignName ? {latestCampaignName: client.latestCampaignName} : undefined,
        ...client.campaignsActive && client.campaignsActive.length > 0
            ? {campaignsActive: client.campaignsActive.map(i => mapCampaign(i))}
            : undefined,
        ...client.campaignsCompleted && client.campaignsCompleted.length > 0
            ? {campaignsCompleted: client.campaignsCompleted.map(i => mapCampaign(i))}
            : undefined,
        ...client.internalNote ? {internalNote: client.internalNote} : undefined,
    }
}