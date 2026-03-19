import {BaseRepository} from "../base.repository";
import {Campaign, CampaignAccount} from "../../schemas/campaign/campaign.schema";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {ClientSession, Model, PipelineStage, Types} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {CompletedCampaign} from "../../schemas/campaign/completed-campaign.schema";
import {ObjId} from "../../../common/types/base.types";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../../../common/types/influencer/promo.types";
import {InvoiceStatusEnum} from "../../../common/types/invoice.types";
import {
    CampaignConfirmationEnum,
    CampaignStatusEnum, ICampaignDetails,
    IDashboardCampaign
} from "../../../common/types/client/campaign.types";
import {mapSchemaToICampaignDetails} from "../../../common/mappers/campaign.mapper";

// Interface for campaign repository
export interface ICampaignRepository {
    // Get paginated list of dashboard campaigns
    getDashboardCampaigns(
        clientId: string,
        limit: number,
        skip: number,
        statusCampaign: CampaignStatusEnum[],
        verifyCampaign: CampaignConfirmationEnum,
    ): Promise<IDashboardCampaign[]>;

    // Get detailed campaign information
    getDetailedCampaign(
        clientId: string,
        campaignId: string,
    ): Promise<ICampaignDetails>;

    // Replace influencer id in each influencer's promo
    replaceInfluencerId(oldInfluencerId: string, newInfluencerId: string, options?: RepoOptions): Promise<any>;

    // Find all influencer's promos that were closed and waiting for payment
    findAllWaitingForPayment(influencerId: string, invoiceStatus: InvoiceStatusEnum, session?: ClientSession): Promise<CampaignAccount[]>;

    // Find influencer's promos by invoice status and update this status
    updateManyInvoiceStatuses(influencerId: string, oldInvoiceStatus: InvoiceStatusEnum, newInvoiceStatus: InvoiceStatusEnum, session?: ClientSession): Promise<any>;
}

@Injectable()
export class CampaignRepository extends BaseRepository<Campaign> implements ICampaignRepository {
    constructor(
        @InjectModel(Campaign.name)
        private readonly campaignModel: Model<Campaign>,
        @InjectModel(CompletedCampaign.name)
        private readonly completedCampaignModel: Model<CompletedCampaign>,
    ) {
        super(campaignModel);
    }

    async getDashboardCampaigns(
        clientId: string,
        limit: number = 10,
        skip: number = 0,
        statusCampaign: CampaignStatusEnum[],
        verifyCampaign: CampaignConfirmationEnum,
    ): Promise<IDashboardCampaign[]> {
        const campaigns: Campaign[] = await this.campaignModel
            .find({
                clientId: new Types.ObjectId(clientId),
                statusCampaign: {$in: statusCampaign},
                verifyCampaign,
            })
            .lean()
            .limit(limit)
            .skip(skip)
            .exec();

        return campaigns.map((campaign: Campaign): IDashboardCampaign => ({
            _id: campaign._id,
            campaignName: campaign.campaignName,
            socialMedia: campaign.socialMedia,
            createdAt: campaign.createdAt,
            price: campaign.campaignPrice,
            clientStatus: verifyCampaign === CampaignConfirmationEnum.accept
                ? "distributing" : verifyCampaign === CampaignConfirmationEnum.wait
                    ? "under_review" : "declined"
        }));
    }

    async getDetailedCampaign(
        clientId: string,
        campaignId: string
    ): Promise<ICampaignDetails> {
        const campaign = await this.campaignModel.findOne({
            _id: new Types.ObjectId(campaignId),
            clientId: new Types.ObjectId(clientId),
        })

        return mapSchemaToICampaignDetails(campaign);
    }

    async replaceInfluencerId(
        oldInfluencerId: string,
        newInfluencerId: string,
        options?: RepoOptions,
    ) {
        return this.campaignModel.updateMany(
            {
                'selectInfluencers.influencerId': new Types.ObjectId(oldInfluencerId),
            },
            {
                $set: {
                    'selectInfluencers.$[elem].influencerId':
                        new Types.ObjectId(newInfluencerId),
                },
            },
            {
                arrayFilters: [
                    {'elem.influencerId': new Types.ObjectId(oldInfluencerId)},
                ],
            },
        );
    }

    async findAllWaitingForPayment(
        influencerId: string,
        invoiceStatus: InvoiceStatusEnum,
        session?: ClientSession
    ): Promise<(CampaignAccount & { campaignId: Types.ObjectId })[]> {
        const _id = new ObjId(influencerId);

        const pipeline = [
            {
                $match: {
                    addedAccounts: {
                        $elemMatch: {
                            influencerId: _id,
                            confirmation: InfluencerConfirmationStatusEnum.accept,
                            closePromo: InfluencerPromoClosedStatusEnum.close,
                            invoiceStatus: invoiceStatus,
                        },
                    },
                },
            },
            {
                $project: {
                    campaignId: "$_id",
                    addedAccounts: {
                        $filter: {
                            input: "$addedAccounts",
                            as: "account",
                            cond: {
                                $and: [
                                    {$eq: ["$$account.influencerId", _id]},
                                    {$eq: ["$$account.confirmation", InfluencerConfirmationStatusEnum.accept]},
                                    {$eq: ["$$account.closePromo", InfluencerPromoClosedStatusEnum.close]},
                                    {$eq: ["$$account.invoiceStatus", invoiceStatus]},
                                ],
                            },
                        },
                    },
                },
            },
            {$unwind: "$addedAccounts"},
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: [
                            "$addedAccounts",
                            {campaignId: "$campaignId"},
                        ],
                    },
                },
            },
        ] satisfies PipelineStage[];

        const [ongoingPromos, completedPromos] = await Promise.all([
            this.campaignModel
                .aggregate<CampaignAccount & { campaignId: Types.ObjectId }>(pipeline)
                .session(session ?? null),

            this.completedCampaignModel
                .aggregate<CampaignAccount & { campaignId: Types.ObjectId }>(pipeline)
                .session(session ?? null),
        ]);

        return [...ongoingPromos, ...completedPromos];
    }

    async updateManyInvoiceStatuses(
        influencerId: string,
        oldInvoiceStatus: InvoiceStatusEnum,
        newInvoiceStatus: InvoiceStatusEnum,
        session?: ClientSession
    ): Promise<void> {
        const _id = new ObjId(influencerId);

        const elemMatch = {
            influencerId: _id,
            confirmation: InfluencerConfirmationStatusEnum.accept,
            closePromo: InfluencerPromoClosedStatusEnum.close,
            invoiceStatus: oldInvoiceStatus,
        };

        const update = {
            $set: {
                'addedAccounts.$[elem].invoiceStatus': newInvoiceStatus,
            },
        };

        const options = {
            session,
            arrayFilters: [
                {
                    'elem.influencerId': _id,
                    'elem.confirmation': InfluencerConfirmationStatusEnum.accept,
                    'elem.closePromo': InfluencerPromoClosedStatusEnum.close,
                    'elem.invoiceStatus': oldInvoiceStatus,
                },
            ],
        };

        await Promise.all([
            this.campaignModel.updateMany(
                {addedAccounts: {$elemMatch: elemMatch}},
                update,
                options
            ),
            this.completedCampaignModel.updateMany(
                {addedAccounts: {$elemMatch: elemMatch}},
                update,
                options
            ),
        ]);
    }
}