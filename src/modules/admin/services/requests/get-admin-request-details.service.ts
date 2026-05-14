import {Injectable, Logger} from "@nestjs/common";
import {RequestForAdminRepository} from "../../../../database/repositories/requests/request-for-admin.repository";
import {NewClientRequestDetailsDto} from "../../dto/requests/admin-requests.dto";
import {
    AdminRequestResponseAction,
    NewClientRequestDetails,
    RequestForAdminType,
} from "../../../../common/types/request-for-admin/request-for-admin.types";

export const GET_ADMIN_REQUEST_DETAILS_SERVICE = Symbol('GET_ADMIN_REQUEST_DETAILS_SERVICE');

@Injectable()
export class GetAdminRequestDetailsService {
    private readonly logger = new Logger(GetAdminRequestDetailsService.name);

    constructor(
        private readonly requestRepository: RequestForAdminRepository,
    ) {
    }

    async exec(requestId: string, requestType: RequestForAdminType): Promise<any> {
        let requestDetails = null;
        let mappedDetails = null;

        switch (requestType) {
            case RequestForAdminType.NEW_CLIENT_REQUEST: {
                requestDetails = await this.requestRepository.getNewClientRequestDetails(requestId);
                mappedDetails = this.mapToNewClientRequest(
                    requestDetails
                )
            }
        }

        if (!requestDetails || !mappedDetails) {
            return null;
        }

        return mappedDetails;
    }

    private mapToNewClientRequest(request: NewClientRequestDetails): NewClientRequestDetailsDto {
        return {
            requestId: request._id.toString(),
            clientId: request.clientId.toString(),
            firstName: request.userFirstName,
            lastName: request.lastName,
            email: request.email,
            phone: request.phone,
            companyName: request.company,
            companyType: request.companyType,
            referralCode: request.referralCode,
            availableActions: [AdminRequestResponseAction.ACCEPT, AdminRequestResponseAction.DECLINE],
        }
    }
}