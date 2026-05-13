import {BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException} from "@nestjs/common";
import {RequestForAdminRepository} from "../../../../database/repositories/requests/request-for-admin.repository";
import {
    AdminRequestResponseAction, IAdminRequest,
    RequestForAdminType,
} from "../../../../common/types/request-for-admin/request-for-admin.types";
import {NEW_CLIENT_REQUEST_HANDLER, NewClientRequestHandler} from "./new-client-request/new-client-request.handler";
import {
    NewClientAdminRequestDocument
} from "../../../../database/schemas/requests/new-client-request.schema";
import {
    AdminRequestForListDto,
    AdminRequestsListResponseDto,
    AdminRequestsSearchResponseDto
} from "../../dto/requests/admin-requests.dto";
import {SearchQueryDto} from "../../../../common/dto/requests/search-query.dto";
import {PaginationQueryDto} from "../../../../common/dto/requests/pagination-query.dto";
import {formatDate} from "../../../../common/utils/formatters";

// Interface for AdminRequestsService
interface IAdminRequestsService {
    // Get paginated list of admin requests
    getRequestsList(query: PaginationQueryDto): Promise<AdminRequestsListResponseDto>;

    // Search for admin requests
    searchRequests(query: SearchQueryDto): Promise<AdminRequestsSearchResponseDto>;

    // Respond to request
    respond(requestId: string, response: string): Promise<any>;
}

@Injectable()
export class AdminRequestsService implements IAdminRequestsService {
    constructor(
        private readonly requestRepository: RequestForAdminRepository,
        @Inject(NEW_CLIENT_REQUEST_HANDLER)
        private readonly newClientRequestHandler: NewClientRequestHandler,
    ) {
    }

    // Get paginated list of admin requests
    async getRequestsList(query: PaginationQueryDto): Promise<AdminRequestsListResponseDto> {
        const list = await this.requestRepository.getPaginatedList(query);
        return {
            ...list,
            items: list.items.map((i: IAdminRequest): AdminRequestForListDto => ({
                requestId: i._id.toString(),
                requestType: i.type.toString(),
                date: formatDate(i.createdAt),
                firstName: i.userFirstName,
                userType: i.userRole
            }))
        }
    }

    // Search for admin requests
    async searchRequests(query: SearchQueryDto): Promise<AdminRequestsSearchResponseDto> {
        const list = await this.requestRepository.search(query);
        return {
            ...list,
            page: 1,
            totalPages: 1,
            items: list.items.map((i: IAdminRequest): AdminRequestForListDto => ({
                requestId: i._id.toString(),
                requestType: i.type.toString(),
                date: formatDate(i.createdAt),
                firstName: i.userFirstName,
                userType: i.userRole
            }))
        }
    }

    // Respond to request
    async respond(requestId: string, response: AdminRequestResponseAction): Promise<void> {
        const request = await this.requestRepository.findById(requestId);

        if (!request) {
            throw new NotFoundException('Request not found');
        }

        const responseValidation = this.validateResponse(response, request.type);

        if (!responseValidation) {
            throw new BadRequestException('Invalid response');
        }

        switch (request.type) {
            case RequestForAdminType.NEW_CLIENT_REQUEST:
                const result = await this.handleNewClientRequest(requestId, response, (request as NewClientAdminRequestDocument).clientId.toString());

                if (result.success !== true) {
                    throw new InternalServerErrorException("Something went wrong during request handling. Please try again later.")
                }
                break;

            default:
                throw new InternalServerErrorException(
                    `Request type ${request.type} is not supported yet.`,
                );
        }

    }

    // Validate request type and response
    private validateResponse(response: AdminRequestResponseAction, requestType: RequestForAdminType): boolean {
        switch (requestType) {
            case RequestForAdminType.NEW_CLIENT_REQUEST:
                if (response !== AdminRequestResponseAction.ACCEPT && response !== AdminRequestResponseAction.DECLINE) {
                    return false;
                }
                return true;
            default:
                return false;
        }
    }

    private handleNewClientRequest(
        requestId: string,
        response: AdminRequestResponseAction,
        clientId: string
    ): Promise<{success: boolean, action: AdminRequestResponseAction}> {
        return this.newClientRequestHandler.exec({
            requestId,
            response,
            clientId,
        })
    }
}