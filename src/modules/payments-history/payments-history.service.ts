import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
    PaymentHistoryAdminOverrideStatusEnum,
    PaymentHistoryEffectiveStatusEnum,
    PaymentHistorySystemStatusEnum
} from "../../common/types/history.types";
import {PaymentHistoryCampaignSource} from "../../database/schemas/histories/payment-history-cell.schema";

// Payload for manual status update.
// Replace with your real dto.
export interface SetPaymentHistoryAdminOverrideDto {
    campaignId: string;
    accountId: string;
    status: PaymentHistoryAdminOverrideStatusEnum;
}

// Interface for projection cell lifecycle service.
// This service is responsible for WRITING / REBUILDING / MAINTAINING
// PaymentHistoryCell documents.
interface IPaymentsHistoryService {
    // Full rebuild of all projection cells for one campaign.
    rebuildForCampaign(
        campaignId: string,
        source: PaymentHistoryCampaignSource,
    ): Promise<void>;

    // Removes all projection cells for one campaign.
    deleteByCampaign(
        campaignId: string,
        source?: PaymentHistoryCampaignSource,
    ): Promise<void>;

    // Manually sets admin override for one cell.
    setAdminOverride(
        dto: SetPaymentHistoryAdminOverrideDto,
        adminId: string,
    ): Promise<void>;

    // Clears admin override for one cell.
    clearAdminOverride(
        campaignId: string,
        accountId: string,
    ): Promise<void>;
}

@Injectable()
export class PaymentsHistoryService implements IPaymentsHistoryService {
    constructor(
        // Reads source campaign data
        // private readonly campaignsRepository: CampaignsRepository,
        // private readonly completedCampaignsRepository: CompletedCampaignsRepository,

        // Reads influencer data if needed for snapshot fields
        // private readonly influencersRepository: InfluencersRepository,

        // Writes / reads projection documents
        // private readonly paymentHistoryCellRepository: PaymentHistoryCellRepository,
    ) {}

    // Main rebuild method.
    // Recommended strategy:
    // - load campaign from source collection
    // - remove old cells for this campaign
    // - build fresh cells from current addedAccounts
    // - upsert or insert new documents
    async rebuildForCampaign(
        campaignId: string,
        source: PaymentHistoryCampaignSource,
    ): Promise<void> {
        // 1. Load campaign from campaigns or completedcampaigns
        const campaign = await this.loadCampaignSource(campaignId, source);

        if (!campaign) {
            throw new NotFoundException('Campaign not found');
        }

        // 2. Remove old projection cells for this campaign
        await this.deleteByCampaign(campaignId, source);

        // 3. Iterate all addedAccounts from campaign
        // Each addedAccount becomes one projection cell
        for (const addedAccount of campaign.addedAccounts ?? []) {
            // 3.1 Load influencer snapshot if needed
            const influencerSnapshot = await this.extractInfluencerSnapshot(
                addedAccount.influencerId,
            );

            // 3.2 Build one projection cell document
            const cellDocument = this.buildCellDocument({
                campaign,
                campaignSource: source,
                addedAccount,
                influencerSnapshot,
            });

            // 3.3 Upsert / create projection cell
            await this.upsertCell(cellDocument);
        }
    }

    // Deletes all projection cells for one campaign.
    // Useful before full rebuild or when campaign is removed.
    async deleteByCampaign(
        campaignId: string,
        source?: PaymentHistoryCampaignSource,
    ): Promise<void> {
        // Example:
        // if source provided -> delete by campaignId + source
        // else -> delete by campaignId only

        void campaignId;
        void source;
    }

    // Sets manual admin override status for one projection cell.
    // Blue status should always win over automatic status.
    async setAdminOverride(
        dto: SetPaymentHistoryAdminOverrideDto,
        adminId: string,
    ): Promise<void> {
        // 1. Find existing cell by campaignId + accountId
        const cell = await this.findCellOrThrow(dto.campaignId, dto.accountId);

        // 2. Apply override fields
        cell.adminOverrideStatus = dto.status;
        cell.adminOverrideBy = new Types.ObjectId(adminId);
        cell.adminOverrideAt = new Date();

        // 3. Recalculate effective status
        cell.effectiveStatus = this.resolveEffectiveStatus({
            systemStatus: cell.systemStatus,
            adminOverrideStatus: cell.adminOverrideStatus,
        });

        // 4. Save updated cell
        await this.saveCell(cell);
    }

    // Clears manual admin override and falls back to automatic status.
    async clearAdminOverride(
        campaignId: string,
        accountId: string,
    ): Promise<void> {
        // 1. Find existing cell
        const cell = await this.findCellOrThrow(campaignId, accountId);

        // 2. Remove override fields
        cell.adminOverrideStatus = undefined;
        cell.adminOverrideBy = undefined;
        cell.adminOverrideAt = undefined;

        // 3. Recalculate effective status from pure system status
        cell.effectiveStatus = this.resolveEffectiveStatus({
            systemStatus: cell.systemStatus,
            adminOverrideStatus: undefined,
        });

        // 4. Save updated cell
        await this.saveCell(cell);
    }

    // Optional method.
    // Can be useful later if you want to rebuild only one specific cell
    // instead of rebuilding the whole campaign.
    async rebuildSingleCell(params: {
        campaignId: string;
        accountId: string;
        source: PaymentHistoryCampaignSource;
    }): Promise<void> {
        const { campaignId, accountId, source } = params;

        // Example flow:
        // 1. load source campaign
        // 2. find matching addedAccount inside campaign
        // 3. if account no longer exists in campaign -> delete projection cell
        // 4. else rebuild only this one cell

        void campaignId;
        void accountId;
        void source;
    }

    // Optional bulk method for repair jobs, migration scripts, cron backfill, etc.
    async rebuildForCampaigns(
        items: Array<{ campaignId: string; source: PaymentHistoryCampaignSource }>,
    ): Promise<void> {
        for (const item of items) {
            await this.rebuildForCampaign(item.campaignId, item.source);
        }
    }

    // Loads source campaign from one of two collections:
    // campaigns or completedcampaigns.
    private async loadCampaignSource(
        campaignId: string,
        source: PaymentHistoryCampaignSource,
    ): Promise<any | null> {
        // Example:
        // if (source === 'campaign') return campaignsRepository.findById(campaignId)
        // if (source === 'completed') return completedCampaignsRepository.findById(campaignId)

        void campaignId;
        void source;

        return null;
    }

    // Reads minimum influencer data needed for projection snapshot.
    private async extractInfluencerSnapshot(influencerId: string): Promise<{
        influencerId: string;
        influencerName: string;
        influencerEmail?: string;
        influencerLogoUrl?: string;
    } | null> {
        // Example:
        // load influencer
        // map minimal display fields

        void influencerId;

        return null;
    }

    // Builds one PaymentHistoryCell document from:
    // - source campaign
    // - one account participation inside campaign.addedAccounts
    // - optional influencer snapshot
    private buildCellDocument(params: {
        campaign: any;
        campaignSource: PaymentHistoryCampaignSource;
        addedAccount: any;
        influencerSnapshot: {
            influencerId: string;
            influencerName: string;
            influencerEmail?: string;
            influencerLogoUrl?: string;
        } | null;
    }): any {
        const { campaign, campaignSource, addedAccount, influencerSnapshot } = params;

        // 1. Resolve automatic system status
        const systemStatus = this.resolveSystemStatus({
            confirmation: addedAccount.confirmation,
            closePromo: addedAccount.closePromo,
            invoiceStatus: addedAccount.invoiceStatus,
        });

        // 2. Resolve final effective status
        const effectiveStatus = this.resolveEffectiveStatus({
            systemStatus,
            adminOverrideStatus: undefined,
        });

        // 3. Return full projection document
        return {
            campaignSource,
            campaignId: campaign._id,
            accountId: addedAccount.accountId,
            influencerId: addedAccount.influencerId,

            campaignName: campaign.campaignName,
            campaignCreatedAt: campaign.createdAt,
            campaignStatus: campaign.statusCampaign,

            socialMedia: addedAccount.socialMedia,
            username: addedAccount.username,
            price: addedAccount.price,
            followers: addedAccount.followers,
            invoiceStatus: addedAccount.invoiceStatus,

            influencerName: influencerSnapshot?.influencerName ?? 'Unknown influencer',
            influencerEmail: influencerSnapshot?.influencerEmail,
            influencerLogoUrl: influencerSnapshot?.influencerLogoUrl,

            systemStatus,
            adminOverrideStatus: undefined,
            effectiveStatus,
        };
    }

    // Automatic status resolver.
    // Your current rule from UI:
    // - white = no cell
    // - yellow = account in campaign but not fully finished with invoice
    // - green = completed + invoice sent
    // - blue = manual admin override
    private resolveSystemStatus(params: {
        confirmation?: string;
        closePromo?: string;
        invoiceStatus?: string;
    }): PaymentHistorySystemStatusEnum {
        const { confirmation, closePromo, invoiceStatus } = params;

        // Important:
        // if invoice was NOT sent, the status must still be "in_process",
        // even if the work itself was completed.

        // Replace with your real enum checks.
        const isCompleted = closePromo === 'close';
        const hasInvoice = Boolean(invoiceStatus);

        void confirmation;

        if (isCompleted && hasInvoice) {
            return PaymentHistorySystemStatusEnum.done;
        }

        return PaymentHistorySystemStatusEnum.in_process;
    }

    // Final status resolver.
    // Manual admin override always has priority over automatic system status.
    private resolveEffectiveStatus(params: {
        systemStatus: PaymentHistorySystemStatusEnum;
        adminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;
    }): PaymentHistoryEffectiveStatusEnum {
        const { systemStatus, adminOverrideStatus } = params;

        if (adminOverrideStatus === PaymentHistoryAdminOverrideStatusEnum.paid) {
            return PaymentHistoryEffectiveStatusEnum.paid;
        }

        if (systemStatus === PaymentHistorySystemStatusEnum.done) {
            return PaymentHistoryEffectiveStatusEnum.done;
        }

        return PaymentHistoryEffectiveStatusEnum.in_process;
    }

    // Upserts one projection cell.
    // Usually by business key: campaignId + accountId
    private async upsertCell(cellDocument: any): Promise<void> {
        // Example:
        // repository.upsert(
        //   { campaignId: cellDocument.campaignId, accountId: cellDocument.accountId },
        //   cellDocument,
        // )

        void cellDocument;
    }

    // Reads one projection cell or throws if not found.
    private async findCellOrThrow(
        campaignId: string,
        accountId: string,
    ): Promise<any> {
        // Example:
        // const cell = await repository.findOneByCampaignIdAndAccountId(campaignId, accountId)
        // if (!cell) throw new NotFoundException('Payment history cell not found')

        void campaignId;
        void accountId;

        return {
            systemStatus: PaymentHistorySystemStatusEnum.in_process,
            adminOverrideStatus: undefined,
            effectiveStatus: PaymentHistoryEffectiveStatusEnum.in_process,
            adminOverrideBy: undefined,
            adminOverrideAt: undefined,
        };
    }

    // Persists updated projection cell.
    private async saveCell(cell: any): Promise<void> {
        // Example:
        // await repository.save(cell)

        void cell;
    }
}