import {Injectable, NotFoundException} from "@nestjs/common";
import {UserInvoiceRepository} from "../../../../database/repositories/invoices/user-invoice.repository";
import {PaginationQueryDto} from "../../../../common/dto/requests/pagination-query.dto";
import {SearchQueryDto} from "../../../../common/dto/requests/search-query.dto";
import {
    AdminInfluencerInvoiceRow,
    AdminInfluencerInvoicesListResponseDto,
    AdminInfluencerInvoicesSearchResponseDto
} from "../../dto/invoices/admin-invoices.dto";
import {IAdminInfluencerInvoice, InvoiceStatusEnum} from "../../../../common/types/invoice.types";
import {formatDate} from "../../../../common/utils/formatters";
import {ObjId} from "../../../../common/types/base.types";
import {CampaignRepository} from "../../../../database/repositories/campaigns/campaign.repository";
import {CompletedCampaignRepository} from "../../../../database/repositories/campaigns/completed-campaign.repository";
import {InfluencerInvoice} from "../../../../database/schemas/invoices/user-invoice.schema";

// Interface for AdminInfluencerInvoicesService
interface IAdminInfluencerInvoicesService {
    getList(data: PaginationQueryDto): Promise<AdminInfluencerInvoicesListResponseDto>;

    search(data: SearchQueryDto): Promise<AdminInfluencerInvoicesSearchResponseDto>;

    markPaid(invoiceId: string): Promise<void>; // marks invoice as paid
}

@Injectable()
export class AdminInfluencerInvoicesService implements IAdminInfluencerInvoicesService {
    constructor(
        private readonly invoiceRepository: UserInvoiceRepository,
        private readonly campaignRepository: CampaignRepository,
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

    async markPaid(invoiceId: string): Promise<void> {
        const invoice = await this.invoiceRepository.findById(invoiceId);

        if (!invoice) {
            throw new NotFoundException('Invoice not found');
        }

        const session = await this.invoiceRepository.startSession();
        session.startTransaction();

        try {
            await this.invoiceRepository.findOneAndUpdate(
                {
                    _id: new ObjId(invoiceId)
                },
                {
                    status: InvoiceStatusEnum.paid
                },
                {session}
            );

            await this.campaignRepository.updateManyInvoiceStatusesByPromoIds({
                campaignIds: (invoice as any)?.linkedPromos?.map(i => i.campaignId),
                promoIds: (invoice as any)?.linkedPromos?.map(i => i.promoId),
                newInvoiceStatus: InvoiceStatusEnum.paid,
                session,
            });

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    }
}