import {IAdminRequest, RequestForAdminType} from "../types/request-for-admin/request-for-admin.types";
import {AdminRequestForListDto} from "../../modules/admin/dto/requests/admin-requests.dto";
import {formatDate} from "../utils/formatters";

export class AdminRequestMapper {
    static toLabel(type: RequestForAdminType): string {
        switch (type) {
            case RequestForAdminType.NEW_CLIENT_REQUEST:
                return "Client Registration Request";
            default:
                return "Unknown Request";
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
            specifiedStatus: request.specifiedStatus
        }
    }
}