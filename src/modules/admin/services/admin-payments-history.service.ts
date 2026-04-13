import {Injectable} from "@nestjs/common";

// Example query dto for page data.
// Replace with your real dto.
export interface GetAdminPaymentsHistoryMatrixQuery {
    // Horizontal pagination for campaigns
    campaignsCursor?: string;
    campaignsTake?: number;

    // Vertical pagination for account rows
    accountsCursor?: string;
    accountsTake?: number;

    // Shared filters / search
    search?: string;
    socialMedia?: string;
    effectiveStatus?: string;
}

// Example response dto shape.
// Replace with your real dto.
export interface AdminPaymentsHistoryMatrixResponse {
    campaigns: any[];
    accounts: any[];
    cells: any[];
    meta: {
        campaignsNextCursor?: string | null;
        accountsNextCursor?: string | null;
        campaignsCount?: number;
        accountsCount?: number;
    };
}

// Interface for admin payment history page service.
// This service is responsible only for READING projection data
// and assembling the final response for the admin page.
interface IAdminPaymentsHistoryService {
    // Returns paginated matrix data for the admin payment history page.
    getMatrix(
        query: GetAdminPaymentsHistoryMatrixQuery,
    ): Promise<AdminPaymentsHistoryMatrixResponse>;
}

@Injectable()
export class AdminPaymentsHistoryService implements IAdminPaymentsHistoryService {
    constructor(
        // Inject only projection read repository / service here.
        // This service should NOT know how cells are rebuilt from campaigns.
        // private readonly paymentHistoryCellRepository: PaymentHistoryCellRepository,
    ) {}

    // Main page method.
    // Flow should be:
    // 1. get campaigns page (columns)
    // 2. get accounts page (rows)
    // 3. get cells for intersection
    // 4. map everything into final response dto
    async getMatrix(
        query: GetAdminPaymentsHistoryMatrixQuery,
    ): Promise<AdminPaymentsHistoryMatrixResponse> {
        // 1. Load paginated campaign headers from projection collection
        const campaignsPage = await this.getCampaignHeadersPage(query);

        // 2. Load paginated account rows from projection collection
        // Usually based on selected / current campaign ids
        const accountsPage = await this.getAccountRowsPage({
            query,
            campaignIds: campaignsPage.items.map((item) => item.campaignId),
        });

        // 3. Load only existing cells for current viewport
        const cells = await this.getViewportCells({
            campaignIds: campaignsPage.items.map((item) => item.campaignId),
            accountIds: accountsPage.items.map((item) => item.accountId),
        });

        // 4. Build final response for frontend
        return this.buildMatrixResponse({
            campaignsPage,
            accountsPage,
            cells,
        });
    }

    // Returns current horizontal page of campaigns.
    // Should read projection collection and build distinct campaign headers.
    // Sorting is usually by campaignCreatedAt desc + campaignId.
    private async getCampaignHeadersPage(query: GetAdminPaymentsHistoryMatrixQuery): Promise<{
        items: any[];
        nextCursor?: string | null;
        total?: number;
    }> {
        // Example responsibilities:
        // - apply search/filter if needed
        // - group/distinct by campaignId
        // - sort by campaignCreatedAt desc
        // - apply cursor pagination
        // - return minimal campaign header info for UI

        return {
            items: [],
            nextCursor: null,
            total: 0,
        };
    }

    // Returns current vertical page of account rows.
    // These rows should match current campaign page,
    // otherwise there will be too many empty rows.
    private async getAccountRowsPage(params: {
        query: GetAdminPaymentsHistoryMatrixQuery;
        campaignIds: string[];
    }): Promise<{
        items: any[];
        nextCursor?: string | null;
        total?: number;
    }> {
        const { query, campaignIds } = params;

        // Example responsibilities:
        // - find distinct account rows only among current campaignIds
        // - apply search/filter if needed
        // - sort rows (usually by username, or maybe by influencerName + username)
        // - apply cursor pagination
        // - return only fields needed for row rendering

        void query;
        void campaignIds;

        return {
            items: [],
            nextCursor: null,
            total: 0,
        };
    }

    // Returns existing projection cells only for current viewport intersection.
    // Frontend can render white cells where no record exists.
    private async getViewportCells(params: {
        campaignIds: string[];
        accountIds: string[];
    }): Promise<any[]> {
        const { campaignIds, accountIds } = params;

        // Example responsibilities:
        // - query projection collection by campaignId IN [] and accountId IN []
        // - return only existing cells
        // - frontend will treat absent cell as white

        void campaignIds;
        void accountIds;

        return [];
    }

    // Final mapping for frontend.
    // This is the right place for small UI-oriented transformations,
    // but not for heavy domain logic.
    private buildMatrixResponse(params: {
        campaignsPage: { items: any[]; nextCursor?: string | null; total?: number };
        accountsPage: { items: any[]; nextCursor?: string | null; total?: number };
        cells: any[];
    }): AdminPaymentsHistoryMatrixResponse {
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
}