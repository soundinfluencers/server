import {BadRequestException, Injectable, InternalServerErrorException, Logger} from "@nestjs/common";
import {CampaignRepository} from "../../../database/repositories/campaigns/campaign.repository";
import {ClientSession} from "mongoose";
import {CampaignContentItemDto, CreateCampaignDto, SelectInfluencerDto} from "../dto/create-campaign.dto";
import {MediaService} from "../../media/media.service";
import {CampaignAccountsBuilderService} from "./campaign-accounts-builder.service";
import {Campaign, CampaignAccount, CampaignContentItem} from "../../../database/schemas/campaign/campaign.schema";
import {mapContentItemDtoToModel} from "../../../common/mappers/campaign.mapper";
import {ObjId} from "../../../common/types/base.types";
import {
    CampaignConfirmationEnum,
    CampaignPaymentStatusEnum,
    CampaignStatusEnum
} from "../../../common/types/client/campaign.types";

export const CAMPAIGN_CREATE_SERVICE = Symbol('CAMPAIGN_CREATE_SERVICE');

@Injectable()
export class CampaignCreateService {
    private readonly logger = new Logger(CampaignCreateService.name);

    constructor(
        private readonly campaignRepository: CampaignRepository,
        private readonly mediaService: MediaService,
        private readonly campaignAccountsBuilderService: CampaignAccountsBuilderService,
    ) {
    }

    async exec(data: CreateCampaignDto, session?: ClientSession): Promise<Campaign> {
        // Validating basic data
        this.validate(data);

        // Processing accounts
        const processedAccounts = await this.processAccounts(data.addedAccounts);

        // Processing campaign content and trying to cache videos in it
        const processedCampaignContent = await this.processCampaignContent(data.campaignContent);

        // Saving campaign
        return await this.saveCampaign(data, processedAccounts, processedCampaignContent, session);
    }

    private validate(data: CreateCampaignDto): void {
        if (!data) {
            throw new BadRequestException('Data is empty')
        }

        if (!data.addedAccounts || !data.addedAccounts.length) {
            throw new BadRequestException('No accounts added')
        }

        if (!data.campaignName) {
            throw new BadRequestException('Campaign name is empty')
        }

        if (!data.campaignContent || !data.campaignContent.length) {
            throw new BadRequestException('No campaign content added')
        }
    }

    private async processAccounts(accounts: SelectInfluencerDto[]): Promise<CampaignAccount[]> {
        let processedAccounts: CampaignAccount[] = [];

        try {
            processedAccounts = await this.campaignAccountsBuilderService.buildCampaignAccountsBatch(accounts);
        } catch (err) {
            this.logger.error(`Error while creating campaign. Error was occurred in processing accounts block: ${err.message}`)
            throw new InternalServerErrorException("Something went wrong while processing accounts. Please try again later.");
        }

        if (processedAccounts.length === 0) {
            throw new BadRequestException('No valid accounts added')
        }

        return processedAccounts;
    }

    private async processCampaignContent(campaignContent: CampaignContentItemDto[]): Promise<CampaignContentItem[]> {
        let processedCampaignContent: CampaignContentItem[] = [];

        try {
            processedCampaignContent = await this.mediaService.applyMediaCacheForCreate(
                campaignContent.map(
                    (campaignContentItem) => mapContentItemDtoToModel(campaignContentItem),
                )
            );
        } catch (err) {
            this.logger.error(`Error while creating campaign. Error was occurred in processing campaign content block: ${err.message}`)
            throw new InternalServerErrorException("Something went wrong while saving your campaign content. Please try again later.");
        }

        if (processedCampaignContent.length === 0) {
            throw new BadRequestException('No valid accounts added')
        }

        return processedCampaignContent;
    }

    private async saveCampaign(
        data: CreateCampaignDto,
        accounts: CampaignAccount[],
        campaignContent: CampaignContentItem[],
        session?: ClientSession
    ): Promise<Campaign> {
        try {
            const campaignId = new ObjId();

            const campaign = await this.campaignRepository.create(
                {
                    ...data,
                    _id: campaignId,
                    clientId: new ObjId(data.clientId),
                    campaignName: data.campaignName.trim(),
                    addedAccounts: accounts,
                    paymentType: data.paymentDetails.selectedPaymentMethod,
                    paymentStatus: CampaignPaymentStatusEnum.confirmed,
                    statusCampaign: CampaignStatusEnum.underReview,
                    verifyCampaign: CampaignConfirmationEnum.wait,
                    shareLink: `${process.env.SERVER_CLIENT}/promo-share/${campaignId}/${data.socialMedia}`,
                    campaignContent: campaignContent,
                    schemaVersion: 2,
                } as Campaign,
                {session},
            );

            return campaign;
        } catch (err) {
            this.logger.error(`Error while creating campaign. Error was occurred in saving campaign block: ${err.message}`)
            throw new InternalServerErrorException("Something went wrong while saving your campaign. Please try again later.");
        }
    }
}