import {
    BadRequestException,
    Injectable, InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import {ClientSession, Types} from 'mongoose';
import {
    PaymentHistoryAdminOverrideStatusEnum,
    PaymentHistoryEffectiveStatusEnum, PaymentHistoryProjection,
    PaymentHistorySystemStatusEnum
} from "../../common/types/history.types";
import {PaymentHistoryCampaignSource} from "../../database/schemas/histories/payment-history-cell.schema";
import {CampaignRepository} from "../../database/repositories/campaigns/campaign.repository";
import {CompletedCampaignRepository} from "../../database/repositories/campaigns/completed-campaign.repository";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {PaymentHistoryCellRepository} from "../../database/repositories/histories/payment-history-cell.repository";
import {ObjId} from "../../common/types/base.types";
import {Campaign, CampaignAccount} from "../../database/schemas/campaign/campaign.schema";
import {CompletedCampaign} from "../../database/schemas/campaign/completed-campaign.schema";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../../common/types/influencer/promo.types";
import {InvoiceStatusEnum} from "../../common/types/invoice.types";

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
        session?: ClientSession
    ): Promise<void>;

    // Manually sets admin override for one cell.
    setAdminOverride(
        dto: SetPaymentHistoryAdminOverrideDto,
        adminId: string,
        session?: ClientSession
    ): Promise<void>;

    // Clears admin override for one cell.
    clearAdminOverride(
        campaignId: string,
        accountId: string,
        session?: ClientSession
    ): Promise<void>;

    // Delete all cells that are connected to campaign
    deleteManyByCampaignId(campaignId: string, session?: ClientSession): Promise<void>;

    // Useful if you want to rebuild only one specific cell or some of them
    // instead of rebuilding the whole campaign.
    rebuildSpecifiedCells(params: {
        cellsInfo: {
            campaignId: string;
            accountId: string;
            source: PaymentHistoryCampaignSource;
            newAdminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;
            adminId?: string;
            newSystemStatus?: PaymentHistorySystemStatusEnum;
        }[];
        session?: ClientSession;
    }): Promise<void>
}

@Injectable()
export class PaymentsHistoryService implements IPaymentsHistoryService {
    constructor(
        // Reads source campaign data
        private readonly campaignsRepository: CampaignRepository,
        private readonly completedCampaignsRepository: CompletedCampaignRepository,
        // Reads influencer data if needed for snapshot fields
        private readonly influencersRepository: InfluencerRepository,
        // Writes / reads projection documents
        private readonly paymentHistoryCellRepository: PaymentHistoryCellRepository,
    ) {
    }

    // Main rebuild method.
    // Recommended strategy:
    // - load campaign from a source collection
    // - remove old cells for this campaign
    // - build fresh cells from current addedAccounts
    // - upsert or insert new documents
    async rebuildForCampaign(
        campaignId: string,
        source: PaymentHistoryCampaignSource,
        session?: ClientSession
    ): Promise<void> {
        // 1. Load campaign from campaigns or completed campaigns
        const campaign = await this.loadCampaignSource(campaignId, source, session);

        if (!campaign) {
            throw new NotFoundException('Campaign not found');
        }

        // 2. Remove old projection cells for this campaign
        await this.deleteManyByCampaignId(campaignId, session);

        // 3. Iterate all addedAccounts from the campaign
        // Each addedAccount becomes one projection cell
        for (const addedAccount of campaign.addedAccounts ?? []) {
            // 3.1 Load influencer snapshot if needed
            const influencerSnapshot = await this.extractInfluencerSnapshot(
                addedAccount.influencerId,
                session
            );

            // 3.2 Build one projection cell document
            const cellDocument: PaymentHistoryProjection = this.buildCellDocument({
                campaign,
                campaignSource: source,
                addedAccount,
                influencerSnapshot,
            });

            // 3.3 Upsert / create projection cell
            await this.paymentHistoryCellRepository.upsertOneByBusinessKey(cellDocument, session);
        }
    }

    async deleteManyByCampaignId(campaignId: string, session?: ClientSession): Promise<void> {
        await this.paymentHistoryCellRepository.deleteManyByCampaignId(campaignId, session);
    }

    // Sets manual admin override status for one projection cell.
    // Blue status should always win over automatic status.
    async setAdminOverride(
        dto: SetPaymentHistoryAdminOverrideDto,
        adminId: string,
        session?: ClientSession
    ): Promise<void> {
        // 1. Find an existing cell by campaignId + accountId
        const cell = await this.findCellOrThrow(dto.campaignId, dto.accountId, session);

        // 2. Apply override fields
        cell.adminOverrideStatus = dto.status;
        cell.adminOverrideBy = new Types.ObjectId(adminId);
        cell.adminOverrideAt = new Date();

        // 3. Recalculate effective status
        cell.effectiveStatus = this.resolveEffectiveStatus({
            systemStatus: cell.systemStatus,
            adminOverrideStatus: cell.adminOverrideStatus,
        });

        // 4. Save an updated cell
        const updateResult = await this.paymentHistoryCellRepository.updateCellStatuses([cell], session);

        if (updateResult.matchedCount === 0) {
            throw new NotFoundException(`Payment history cell not found for id ${cell.cellId} while saving new admin override status`);
        }
    }

    // Clears manual admin override and falls back to automatic status.
    async clearAdminOverride(
        campaignId: string,
        accountId: string,
        session?: ClientSession
    ): Promise<void> {
        // 1. Find existing cell
        const cell = await this.findCellOrThrow(campaignId, accountId, session);

        // 3. Recalculate effective status from pure system status
        const newEffectiveStatus = this.resolveEffectiveStatus({
            systemStatus: cell.systemStatus,
            adminOverrideStatus: undefined,
        });

        // 4. Save an updated cell
        const res = await this.paymentHistoryCellRepository.clearAdminOverrideById(
            cell.cellId,
            newEffectiveStatus,
            session
        );

        if (res.matchedCount === 0) {
            throw new NotFoundException(`Can't clear admin override for cell ${cell.cellId} while saving new effective status`);
        }
    }

    // Useful if you want to rebuild only one specific cell or some of them
    // instead of rebuilding the whole campaign.
    async rebuildSpecifiedCells(params: {
        cellsInfo: {
            campaignId: string;
            accountId: string;
            newAdminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;
            newSystemStatus?: PaymentHistorySystemStatusEnum;
        }[];
        adminId?: string;
        session?: ClientSession;
    }): Promise<void> {
        // Example flow:
        // 1. load source campaign
        // 2. find matching addedAccount inside the campaign
        // 3. if an account no longer exists in campaign -> delete projection cell
        // 4. else rebuild only this one cell

        const {cellsInfo, adminId, session} = params;

        if (!cellsInfo.length) {
            throw new BadRequestException(`Can't rebuild specified cells without any cells info`);
        }

        let cells = [];

        // Cycle for processing each of cells
        for (const cellInfo of cellsInfo) {
            if (!cellInfo.newSystemStatus && !cellInfo.newAdminOverrideStatus) {
                throw new BadRequestException(`Can't rebuild cell without any new status fields`);
            }

            // 1. Find existing cell
            let cell = await this.findCellOrThrow(cellInfo.campaignId, cellInfo.accountId, session);

            if (!cell) continue;

            // 2. Apply new status fields
            if (cellInfo.newAdminOverrideStatus && adminId) {
                cell.adminOverrideStatus = cellInfo.newAdminOverrideStatus;
                cell.adminOverrideBy = new ObjId(adminId);
                cell.adminOverrideAt = new Date();
            }

            cell.systemStatus = cellInfo.newSystemStatus;

            // 3. Recalculate effective status from pure system status
            cell.effectiveStatus = this.resolveEffectiveStatus({
                systemStatus: cell.systemStatus,
                adminOverrideStatus: cell.adminOverrideStatus,
            });

            // 4. Push in the cell array to save all of them later
            cells.push(cell);
        }

        const updateResult = await this.paymentHistoryCellRepository.updateCellStatuses(cells, session);

        // if (updateResult?.matchedCount === 0) {
        //     throw new NotFoundException(`Can't rebuild specified payment history cells: no cells found`);
        // }
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
    // campaigns or completed campaigns.
    private async loadCampaignSource(
        campaignId: string,
        source: PaymentHistoryCampaignSource,
        session?: ClientSession
    ): Promise<any | null> {
        if (source === 'campaign') return this.campaignsRepository.findById(campaignId, {session})
        if (source === 'completed') return this.completedCampaignsRepository.findById(campaignId, {session})

        throw new BadRequestException(`Unknown payment history source: ${source}. Must be one of: campaign, completed.`)
    }

    // Reads minimum influencer data needed for projection snapshot.
    private async extractInfluencerSnapshot(
        influencerId: string,
        session?: ClientSession
    ): Promise<{
        influencerId: string;
        influencerName: string;
        influencerEmail?: string;
        influencerLogoUrl?: string;
    } | null> {
        const influencerInfo = await this.influencersRepository.findById(
            influencerId,
            {
                session,
                select: ['firstName', 'email', 'logoUrl']
            }
        );

        return {
            influencerId,
            influencerName: influencerInfo?.firstName ?? 'Unknown',
            influencerEmail: influencerInfo?.email,
            influencerLogoUrl: influencerInfo?.logoUrl,
        };
    }

    // Builds one PaymentHistoryCell document from:
    // - source campaign
    // - one account participation inside campaign.addedAccounts
    // - optional influencer snapshot
    private buildCellDocument(params: {
        campaign: Campaign | CompletedCampaign;
        campaignSource: PaymentHistoryCampaignSource;
        addedAccount: CampaignAccount;
        influencerSnapshot: {
            influencerId: string;
            influencerName: string;
            influencerEmail?: string;
            influencerLogoUrl?: string;
        } | null;
    }): PaymentHistoryProjection {
        const {campaign, campaignSource, addedAccount, influencerSnapshot} = params;

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

        // 3. Return the full projection document
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
    // - yellow = account in a campaign but not fully finished with invoice
    // - green = completed + invoice sent
    // - blue = manual admin override
    private resolveSystemStatus(params: {
        confirmation?: InfluencerConfirmationStatusEnum;
        closePromo?: InfluencerPromoClosedStatusEnum;
        invoiceStatus?: InvoiceStatusEnum;
    }): PaymentHistorySystemStatusEnum {
        const {confirmation, closePromo, invoiceStatus} = params;

        // Important:
        // if invoice was NOT sent, the status must still be "in_process",
        // even if the work itself was completed.

        // Replace it with your real enum checks.
        const isAccepted = confirmation === InfluencerConfirmationStatusEnum.accept;
        const isCompleted = closePromo === InfluencerPromoClosedStatusEnum.close;
        const sentInvoice =
            invoiceStatus === InvoiceStatusEnum.submitted ||
            invoiceStatus === InvoiceStatusEnum.paid;

        if (isAccepted && isCompleted && sentInvoice) {
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
        const {systemStatus, adminOverrideStatus} = params;

        if (adminOverrideStatus === PaymentHistoryAdminOverrideStatusEnum.paid) {
            return PaymentHistoryEffectiveStatusEnum.paid;
        }

        if (systemStatus === PaymentHistorySystemStatusEnum.done) {
            return PaymentHistoryEffectiveStatusEnum.done;
        }

        return PaymentHistoryEffectiveStatusEnum.in_process;
    }

    // Reads one projection cell or throws if not found.
    private async findCellOrThrow(
        campaignId: string,
        accountId: string,
        session?: ClientSession
    ): Promise<{
        cellId: ObjId,
        systemStatus: PaymentHistorySystemStatusEnum,
        effectiveStatus: PaymentHistoryEffectiveStatusEnum,
        adminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum,
        adminOverrideBy?: ObjId,
        adminOverrideAt?: Date,
    }> {
        const cell = await this.paymentHistoryCellRepository.findOne({
            campaignId: new ObjId(campaignId),
            accountId: new ObjId(accountId),
        }, {session});
        
        if (!cell) {
            return null;
            // throw new NotFoundException(`Payment history cell not found for campaign ${campaignId} and account ${accountId}`);
        }

        return {
            cellId: cell._id,
            systemStatus: cell.systemStatus,
            adminOverrideStatus: cell.adminOverrideStatus,
            effectiveStatus: cell.effectiveStatus,
            adminOverrideBy: cell.adminOverrideBy,
            adminOverrideAt: cell.adminOverrideAt,
        };
    }
}