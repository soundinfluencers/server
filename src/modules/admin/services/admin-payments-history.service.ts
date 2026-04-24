import {Injectable} from "@nestjs/common";
import {
    AdminPaymentsHistoryAccountDto,
    AdminPaymentsHistoryCampaignDto, AdminPaymentsHistoryCellDto,
    AdminPaymentsHistoryMatrixDto,
    GetAdminPaymentsHistoryMatrixQuery
} from "../dto/payments-history/admin-payments-history.dto";
import {
    PaymentHistoryCampaignHeaderRow,
    PaymentHistoryCellRepository, PaymentHistoryViewportCellRow
} from "../../../database/repositories/histories/payment-history-cell.repository";
import {ObjId} from "../../../common/types/base.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {
    PaymentHistoryAdminOverrideStatusEnum,
    PaymentHistoryEffectiveStatusEnum,
    PaymentHistorySystemStatusEnum
} from "../../../common/types/history.types";

// Interface for admin payment history page service.
// This service is responsible only for READING projection data
// and assembling the final response for the admin page.
interface IAdminPaymentsHistoryService {
    // Returns paginated matrix data for the admin payment history page.
    getMatrix(
        query: GetAdminPaymentsHistoryMatrixQuery,
    ): Promise<AdminPaymentsHistoryMatrixDto>;
}

// Type for campaign cursor pagination.
// This is a simple JSON object with two fields:
// campaignCreatedAt - campaign creation date
// campaignId - campaign id
export interface PaymentHistoryCampaignCursor {
    campaignCreatedAt: Date;
    campaignId: ObjId;
}

export interface PaymentHistoryAccountCursor {
    accountId: ObjId;
}

@Injectable()
export class AdminPaymentsHistoryService implements IAdminPaymentsHistoryService {
    constructor(
        // Inject only projection-read repository / service here.
        // This service should NOT know how cells are rebuilt from campaigns.
        private readonly paymentHistoryCellRepository: PaymentHistoryCellRepository,
    ) {}

    // Main page method.
    // Flow should be:
    // 1. get campaign page (columns)
    // 2. get account page (rows)
    // 3. get cells for intersection
    // 4. map everything into a final response dto
    async getMatrix(
        query: GetAdminPaymentsHistoryMatrixQuery,
    ): Promise<AdminPaymentsHistoryMatrixDto> {
        // 1. Load paginated campaign headers from the projection collection
        const campaignsPage = await this.getCampaignHeadersPage(query);

        // 2. Load paginated account rows from a projection collection
        // Usually based on selected / current campaign ids
        const accountsPage = await this.getAccountRowsPage({
            query,
            campaignIds: campaignsPage.items.map((item) => new ObjId(item.campaignId)),
        });

        // 3. Load only existing cells for the current viewport
        const cells: PaymentHistoryViewportCellRow[] = await this.paymentHistoryCellRepository.findViewportCells({
            campaignIds: campaignsPage.items.map((item) => new ObjId(item.campaignId)),
            accountIds: accountsPage.items.map((item) => new ObjId(item.accountId)),
        });

        // 4. Map cells to a final response format
        const mappedCells: AdminPaymentsHistoryCellDto[] = cells.map((cell: PaymentHistoryViewportCellRow): AdminPaymentsHistoryCellDto => ({
            campaignId: cell.campaignId.toString(),
            accountId: cell.accountId.toString(),
            effectiveStatus: cell.effectiveStatus,
            systemStatus: cell.systemStatus,
            adminOverrideStatus: cell.adminOverrideStatus,
        }))

        // 5. Build final response for frontend
        return this.buildMatrixResponse({
            campaignsPage,
            accountsPage,
            cells: mappedCells,
        });
    }

    private async getCampaignHeadersPage(
        query: GetAdminPaymentsHistoryMatrixQuery,
    ): Promise<{
        items: AdminPaymentsHistoryCampaignDto[];
        nextCursor?: string | null;
        total?: number;
    }> {
        // Responsibilities:
        // - apply search/filter if needed
        // - group/distinct by campaignId
        // - sort by campaignCreatedAt desc
        // - apply cursor pagination
        // - return minimal campaign header info for UI

        const take = query.campaignsTake && query.campaignsTake > 0
            ? query.campaignsTake
            : 10;

        const decodedCursor: PaymentHistoryCampaignCursor | null =
            this.decodeCampaignCursor(query.campaignsCursor);

        const rows: PaymentHistoryCampaignHeaderRow[] =
            await this.paymentHistoryCellRepository.getCampaignHeadersPage({
                take,
                cursor: decodedCursor ?? null,
                search: query.search,
                socialMedia: query.socialMedia,
                effectiveStatus: query.effectiveStatus,
            });

        const hasNextPage = rows.length > take;
        const pageRows: PaymentHistoryCampaignHeaderRow[] = hasNextPage
            ? rows.slice(0, take)
            : rows;

        const lastItem = pageRows[pageRows.length - 1];

        const items: AdminPaymentsHistoryCampaignDto[] = pageRows.map((row) => ({
            campaignId: row.campaignId.toString(),
            campaignName: row.campaignName,
            campaignCreatedAt: row.campaignCreatedAt.toISOString(),
            campaignStatus: row.campaignStatus,
        }));

        return {
            items,
            nextCursor: hasNextPage && lastItem
                ? this.encodeCampaignCursor({
                    campaignCreatedAt: new Date(lastItem.campaignCreatedAt),
                    campaignId: lastItem.campaignId.toString(),
                })
                : null,
            total: undefined,
        };
    }

    // Returns the current vertical page of account rows.
    // These rows should match the current campaign page,
    // otherwise there will be too many empty rows.
    private async getAccountRowsPage(params: {
        query: GetAdminPaymentsHistoryMatrixQuery;
        campaignIds: ObjId[];
    }): Promise<{
        items: AdminPaymentsHistoryAccountDto[];
        nextCursor?: string | null;
        total?: number;
    }> {
        // Example responsibilities:
        // - find distinct account rows only among current campaignIds
        // - apply search/filter if needed
        // - sort rows (usually by username, or maybe by influencerName + username)
        // - apply cursor pagination
        // - return only fields needed for row rendering

        const { query, campaignIds } = params;

        if (!campaignIds.length) {
            return {
                items: [],
                nextCursor: null,
                total: 0,
            };
        }

        const take = query.accountsTake && query.accountsTake > 0
            ? query.accountsTake
            : 10;

        const decodedCursor = this.decodeAccountCursor(query.accountsCursor);

        const rows = await this.paymentHistoryCellRepository.getAccountRowsPage({
            campaignIds,
            take,
            cursor: decodedCursor,
            search: query.search,
            socialMedia: query.socialMedia as SocialMediaEnum,
            effectiveStatus: query.effectiveStatus,
        });

        const hasNextPage = rows.length > take;
        const pageRows = hasNextPage ? rows.slice(0, take) : rows;
        const lastItem = pageRows[pageRows.length - 1];

        const items: AdminPaymentsHistoryAccountDto[] = pageRows.map((row) => ({
            accountId: row.accountId.toString(),
            influencerId: row.influencerId.toString(),
            username: row.username,
            logoUrl: row.logoUrl,
        }));

        return {
            items,
            nextCursor: hasNextPage && lastItem
                ? this.encodeAccountCursor({
                    accountId: lastItem.accountId.toString(),
                })
                : null,
            total: undefined,
        };
    }

    // Final mapping for frontend.
    // This is the right place for small UI-oriented transformations,
    // but not for heavy domain logic.
    private buildMatrixResponse(params: {
        campaignsPage: {
            items: AdminPaymentsHistoryCampaignDto[];
            nextCursor?: string | null;
            total?: number;
        };
        accountsPage: {
            items: AdminPaymentsHistoryAccountDto[];
            nextCursor?: string | null;
            total?: number;
        };
        cells: AdminPaymentsHistoryCellDto[];
    }): AdminPaymentsHistoryMatrixDto {
        const { campaignsPage, accountsPage, cells } = params;

        return {
            campaigns: campaignsPage.items,
            accounts: accountsPage.items,
            cells,
            meta: {
                campaignsNextCursor: campaignsPage.nextCursor ?? null,
                accountsNextCursor: accountsPage.nextCursor ?? null,
                campaignsCount: campaignsPage.total,
                accountsCount: accountsPage.total,
            },
        };
    }

    // For encoding campaign cursor pagination.
    private encodeCampaignCursor(payload: {
        campaignCreatedAt: Date;
        campaignId: string;
    }): string {
        return Buffer.from(
            JSON.stringify({
                campaignCreatedAt: payload.campaignCreatedAt.toISOString(),
                campaignId: payload.campaignId,
            }),
        ).toString('base64');
    }

    // For decoding campaign cursor pagination.
    private decodeCampaignCursor(
        cursor?: string,
    ): PaymentHistoryCampaignCursor | null {
        if (!cursor) return null;

        const parsed = JSON.parse(
            Buffer.from(cursor, 'base64').toString('utf8'),
        );

        return {
            campaignCreatedAt: new Date(parsed.campaignCreatedAt),
            campaignId: new ObjId(parsed.campaignId),
        };
    }

    // For encoding account cursor pagination.
    private encodeAccountCursor(payload: { accountId: string }): string {
        return Buffer.from(
            JSON.stringify({
                accountId: payload.accountId,
            }),
        ).toString('base64');
    }

    // For decoding account cursor pagination.
    private decodeAccountCursor(
        cursor?: string,
    ): PaymentHistoryAccountCursor | null {
        if (!cursor) return null;

        const parsed = JSON.parse(
            Buffer.from(cursor, 'base64').toString('utf8'),
        );

        return {
            accountId: new ObjId(parsed.accountId),
        };
    }
}