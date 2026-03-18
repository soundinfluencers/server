import {Client} from "../../database/schemas/users/client.schema";
import {ClientAccountDetailsDto} from "../../modules/profile/dto/influencer/get-profile.dto";
import {AdminClientListItem} from "../types/client/client.types";
import {AdminClientResponseDto} from "../../modules/admin/dto/clients/admin-clients.dto";

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

// Maps AdminClientListItem to AdminClientResponseDto
export const mapReadModelToAdminClientResponseDto = (client: AdminClientListItem): AdminClientResponseDto => {
    return {
        company: client.company,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        companyType: client.companyType,
        id: client._id.toString(),
        proposalAccess: client.isProposal,
        campaignsCompleted: client.campaignsCompleted,
        campaignsActive: client.campaignsActive,
        ...(client.latestCampaign ? {
            campaignName: client.latestCampaign.campaignName,
            campaignId: client.latestCampaign._id.toString(),
        } : {}),
        ...(client.internalNote ? { internalNote: client.internalNote } : {}),
    }
}