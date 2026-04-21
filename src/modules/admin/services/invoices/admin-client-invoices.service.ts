import {Injectable} from "@nestjs/common";
import {UserInvoiceRepository} from "../../../../database/repositories/invoices/user-invoice.repository";
import {PaginationQueryDto} from "../../../../common/dto/requests/pagination-query.dto";
import {SearchQueryDto} from "../../../../common/dto/requests/search-query.dto";
import {
    AdminClientInvoiceRow,
    AdminClientInvoicesListResponseDto,
    AdminClientInvoicesSearchResponseDto
} from "../../dto/invoices/admin-invoices.dto";
import {IAdminClientInvoice} from "../../../../common/types/invoice.types";
import {Role} from "../../../../common/types/user.types";
import {formatDate} from "../../../../common/utils/formatters";

// Interface for AdminClientInvoicesService
interface IAdminClientInvoicesService {
    getList(data: PaginationQueryDto): Promise<AdminClientInvoicesListResponseDto>;
    search(data: SearchQueryDto): Promise<AdminClientInvoicesSearchResponseDto>;
}

@Injectable()
export class AdminClientInvoicesService implements IAdminClientInvoicesService {
    constructor(
        private readonly invoiceRepository: UserInvoiceRepository,
    ) {
    }

    async getList(data: PaginationQueryDto): Promise<AdminClientInvoicesListResponseDto> {
        const list = await this.invoiceRepository.findPaginated(data, Role.client);
        return {
            ...list,
            items: list.items.map((i: IAdminClientInvoice): AdminClientInvoiceRow => ({
                invoiceId: i._id.toString(),
                company: i.company,
                campaignName: i.campaignName,
                date: formatDate(i.createdAt),
                amount: i.amount,
                status: i.status,
            }))
        };
    }

    async search(data: SearchQueryDto): Promise<AdminClientInvoicesSearchResponseDto> {
        const searchResult = await this.invoiceRepository.findBySearch(data, Role.client);
        return {
            ...searchResult,
            items: searchResult.items.map((i: IAdminClientInvoice): AdminClientInvoiceRow => ({
                invoiceId: i._id.toString(),
                company: i.company,
                campaignName: i.campaignName,
                date: formatDate(i.createdAt),
                amount: i.amount,
                status: i.status,
            }))
        }
    }
}