import {Injectable} from "@nestjs/common";
import {UserInvoiceRepository} from "../../../../database/repositories/invoices/user-invoice.repository";
import {PaginationQueryDto} from "../../../../common/dto/requests/pagination-query.dto";
import {SearchQueryDto} from "../../../../common/dto/requests/search-query.dto";
import {
    AdminInfluencerInvoiceRow,
    AdminInfluencerInvoicesListResponseDto,
    AdminInfluencerInvoicesSearchResponseDto
} from "../../dto/invoices/admin-invoices.dto";
import {IAdminInfluencerInvoice, InvoiceStatusEnum} from "../../../../common/types/invoice.types";
import {Role} from "../../../../common/types/user.types";
import {formatDate} from "../../../../common/utils/formatters";

// Interface for AdminInfluencerInvoicesService
interface IAdminInfluencerInvoicesService {
    getList(data: PaginationQueryDto): Promise<AdminInfluencerInvoicesListResponseDto>;
    search(data: SearchQueryDto): Promise<AdminInfluencerInvoicesSearchResponseDto>;
}

@Injectable()
export class AdminInfluencerInvoicesService implements IAdminInfluencerInvoicesService {
    constructor(
        private readonly invoiceRepository: UserInvoiceRepository,
    ) {
    }

    async getList(data: PaginationQueryDto): Promise<AdminInfluencerInvoicesListResponseDto> {
        const list = await this.invoiceRepository.findPaginatedInfluencerInvoices(data);
        return {
            ...list,
            items: list.items.map((i: IAdminInfluencerInvoice): AdminInfluencerInvoiceRow => ({
                invoiceId: i._id.toString(),
                firstName: i.firstName,
                lastName: i.lastName !== "" ? i.lastName : null,
                socialMedia: i.socialMedia,
                username: i.username,
                date: formatDate(i.createdAt),
                influencerAmount: i.amount,
                amountInEur: i.amount,
                paymentMethod: i.paymentMethod,
                paymentDetails: i.paymentDetails,
                status: i.status,
                isPaid: i.status === InvoiceStatusEnum.paid
            }))
        };
    }

    async search(data: SearchQueryDto): Promise<AdminInfluencerInvoicesSearchResponseDto> {
        const searchResult = await this.invoiceRepository.findBySearchInfluencerInvoices(data);
        return {
            ...searchResult,
            items: searchResult.items.map((i: IAdminInfluencerInvoice): AdminInfluencerInvoiceRow => ({
                invoiceId: i._id.toString(),
                firstName: i.firstName,
                lastName: i.lastName !== "" ? i.lastName : null,
                socialMedia: i.socialMedia,
                username: i.username,
                date: formatDate(i.createdAt),
                influencerAmount: i.amount,
                amountInEur: i.amount,
                paymentMethod: i.paymentMethod,
                paymentDetails: i.paymentDetails,
                status: i.status,
                isPaid: i.status === InvoiceStatusEnum.paid
            }))
        }
    }
}