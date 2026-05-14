import {ApiProperty} from "@nestjs/swagger";
import {Role} from "../../../../common/types/user.types";
import {PaginatedListResponseDto} from "../../../../common/dto/responses/paginated-list-response.dto";
import {AdminRequestResponseAction} from "../../../../common/types/request-for-admin/request-for-admin.types";

// Admin request DTO for admin requests list
export class AdminRequestForListDto {
    @ApiProperty({type: String})
    requestId: string;

    @ApiProperty({type: String})
    requestType: string; // enum RequestForAdminType mapped to string

    @ApiProperty({type: String, example: '12.08.2026'})
    date: string;

    @ApiProperty({type: String})
    firstName: string;

    @ApiProperty({type: String, enum: Role})
    userType: Role;
}

// DTO for request list
export class AdminRequestsListResponseDto extends PaginatedListResponseDto<AdminRequestForListDto> {
    @ApiProperty({
        type: [AdminRequestForListDto],
        description: 'List of requests',
    })
    items: AdminRequestForListDto[];
}

// DTO for request search result
export class AdminRequestsSearchResponseDto extends PaginatedListResponseDto<AdminRequestForListDto> {
    @ApiProperty({
        type: [AdminRequestForListDto],
        description: 'List of requests',
    })
    items: AdminRequestForListDto[];
}

// DTO for new client request details
export class NewClientRequestDetailsDto {
    @ApiProperty({type: String})
    requestId: string;

    @ApiProperty({type: String})
    clientId: string;

    @ApiProperty({type: String})
    firstName: string;

    @ApiProperty({type: String})
    lastName: string;

    @ApiProperty({type: String})
    email: string;

    @ApiProperty({type: String})
    phone: string;

    @ApiProperty({type: String})
    companyName: string;

    @ApiProperty({type: String})
    companyType: string;

    @ApiProperty({type: String})
    referralCode: string;

    @ApiProperty({type: String, isArray: true})
    availableActions: AdminRequestResponseAction[];
}