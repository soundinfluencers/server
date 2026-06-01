import {Injectable, InternalServerErrorException, NotFoundException} from "@nestjs/common";
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
import {PaymentsHistoryService} from "../../../payments-history/payments-history.service";
import {
    PaymentHistoryAdminOverrideStatusEnum,
    PaymentHistorySystemStatusEnum
} from "../../../../common/types/history.types";
import {InfluencerActionsHistoryService} from "../../../influencer-actions-history/influencer-actions-history.service";
import {SocialMediaEnum} from "../../../../common/types/social-media.types";

// Interface for AdminInfluencerInvoicesService
interface IAdminInfluencerInvoicesService {
    getList(data: PaginationQueryDto): Promise<AdminInfluencerInvoicesListResponseDto>;

    search(data: SearchQueryDto): Promise<AdminInfluencerInvoicesSearchResponseDto>;

    markPaid(invoiceId: string, adminId: string): Promise<void>; // marks invoice as paid
}

@Injectable()
export class AdminInfluencerInvoicesService implements IAdminInfluencerInvoicesService {
    constructor(
        private readonly invoiceRepository: UserInvoiceRepository,
        private readonly campaignRepository: CampaignRepository,
        private readonly paymentsHistoryService: PaymentsHistoryService,
        private readonly influencerActionsHistoryService: InfluencerActionsHistoryService,
    ) {
    }

    async getList(data: PaginationQueryDto): Promise<AdminInfluencerInvoicesListResponseDto> {
        const list = await this.invoiceRepository.findPaginatedInfluencerInvoices(data);
        return {
            ...list,
            items: list.items.map((i: IAdminInfluencerInvoice): AdminInfluencerInvoiceRow => ({
                invoiceId: i._id.toString(),
                shortInvoiceId: i.shortInvoiceId,
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
                shortInvoiceId: i.shortInvoiceId,
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

    async markPaid(invoiceId: string, adminId: string): Promise<void> {
        const invoice = await this.invoiceRepository.findById(invoiceId);

        if (!invoice) {
            throw new NotFoundException('Invoice not found');
        }

        const session = await this.invoiceRepository.startSession();
        session.startTransaction();

        try {
            // 1. Updating invoice status to a paid in invoice collection
            await this.invoiceRepository.findOneAndUpdate(
                {
                    _id: new ObjId(invoiceId)
                },
                {
                    status: InvoiceStatusEnum.paid
                },
                {session}
            );

            // 2. Updating invoice statuses to a paid in campaign collection
            const campaignsUpdateResult: {
                campaignId: ObjId;
                promoId: ObjId;
                accountId: ObjId;
                influencerId: ObjId;
                campaignName: string;
                username: string;
                price: number;
                socialMedia: SocialMediaEnum;
            }[] = await this.campaignRepository.updateManyInvoiceStatusesByPromoIds({
                campaignIds: (invoice as any)?.linkedPromos?.map(i => i.campaignId),
                promoIds: (invoice as any)?.linkedPromos?.map(i => i.promoId),
                newInvoiceStatus: InvoiceStatusEnum.paid,
                session,
            });

            if (campaignsUpdateResult.length === 0) {
                throw new InternalServerErrorException('No campaigns found for the invoice');
            }

            // 3. Building cells info for updating in payments history cell collection
            const cellsInfo: {
                campaignId: string;
                accountId: string;
                newAdminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;
                newSystemStatus?: PaymentHistorySystemStatusEnum;
            }[] = campaignsUpdateResult.map(i => ({
                campaignId: i.campaignId.toString(),
                accountId: i.accountId.toString(),
                newAdminOverrideStatus: PaymentHistoryAdminOverrideStatusEnum.paid,
                newSystemStatus: PaymentHistorySystemStatusEnum.done
            }));

            // 4. Updating admin override status to paid in payments history cell
            // Update each payment history cell for each linked promo
            await this.paymentsHistoryService.rebuildSpecifiedCells({
                adminId: adminId,
                session: session,
                cellsInfo: cellsInfo
            })

            // 5. Updating influencer's actions history
            await this.influencerActionsHistoryService.upsertInfluencerCampaignActionsHistoryMany(
                {
                    influencerId: campaignsUpdateResult[0].influencerId.toString(),
                    updatedCampaignActions: campaignsUpdateResult.map(i => ({
                        campaignId: i.campaignId.toString(),
                        campaignName: i.campaignName,
                        addedAccountsId: i.promoId,
                        socialAccountId: i.accountId,
                        actionNumber: 4,
                        networkUsername: i.username,
                        rewardForInfluencer: i.price,
                        socialMedia: i.socialMedia,
                    }))
                },
                session
            );

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    }
}