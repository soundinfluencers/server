import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {Types} from 'mongoose';
import {CampaignRepository} from "../../database/repositories/campaigns/campaign.repository";
import {ProposalCampaignRepository} from "../../database/repositories/campaigns/proposal-campaign.repository";
import {ReportSizeRepository} from "../../database/repositories/report-size/report-size.repository";
import {UpdateReportSizeResponse} from "./types/report-size.types";
import {CompletedCampaignRepository} from "../../database/repositories/campaigns/completed-campaign.repository";
import {UpdateReportSizeRequestDto} from "./dto/update-report-size.dto";

@Injectable()
export class ReportsSizesService {
    constructor(
        private readonly reportSizeRepository: ReportSizeRepository,
        private readonly campaignRepository: CampaignRepository,
        private readonly proposalCampaignRepository: ProposalCampaignRepository,
        private readonly completedCampaignRepository: CompletedCampaignRepository,
    ) {
    }

    // Updates existing campaign report size or creates new
    async updateReportSize(
        data: UpdateReportSizeRequestDto,
    ): Promise<UpdateReportSizeResponse> {

        const {campaignId, userId, columnSizes} = data;

        if (!campaignId || !userId || !columnSizes) {
            throw new BadRequestException('Not enough arguments');
        }

        const allDefault = Object.values(columnSizes)
            .every(value => Number(value) === 150);

        if (allDefault) {
            return {
                message: 'Default sizes not saved',
            };
        }

        const campaignExists =
            await this.campaignRepository.exists({campaignId: new Types.ObjectId(campaignId)}) ||
            await this.proposalCampaignRepository.exists({campaignId: new Types.ObjectId(campaignId)}) ||
            await this.completedCampaignRepository.exists({campaignId: new Types.ObjectId(campaignId)});

        if (!campaignExists) {
            throw new NotFoundException('Campaign not found');
        }

        let reportSizes = await this.reportSizeRepository.findOne({
            campaignId: new Types.ObjectId(campaignId),
        });

        const session = await this.reportSizeRepository.startSession();

        try {
            session.startTransaction();

            if (!reportSizes) {
                // TODO: remove as any
                reportSizes = await this.reportSizeRepository.create({
                    campaignId: new Types.ObjectId(campaignId),
                    userSizes: [],
                }) as any;
            }

            const userSizeIndex = reportSizes.userSizes.findIndex(
                u => u.userId.toString() === userId,
            );

            const mappedSizes = new Map<string, number>(
                Object.entries(columnSizes).map(([key, value]) => [
                    key,
                    Number(value),
                ]),
            );

            if (userSizeIndex === -1) {
                reportSizes.userSizes.push({
                    _id: new Types.ObjectId(),
                    userId: new Types.ObjectId(userId),
                    columnSizes: mappedSizes,
                });
            } else {
                reportSizes.userSizes[userSizeIndex].columnSizes = mappedSizes;
            }

            await reportSizes.save();
            await session.commitTransaction();

            return {
                message: 'Report sizes updated successfully',
                sizes: [
                    Object.fromEntries(
                        reportSizes.userSizes[userSizeIndex].columnSizes,
                    ),
                ],
            };
        } catch (err) {
            await session.abortTransaction();
            throw new err;
        } finally {
            await session.endSession();
        }
    }

    // Returns report size for user
    async getReportSizeForUser(
        campaignId: string,
        userId: string,
    ): Promise<Record<string, number>> {

        const reportSizes = await this.reportSizeRepository.findOne({
            campaignId: new Types.ObjectId(campaignId),
        });

        if (!reportSizes) {
            return {};
        }

        const userSizes =
            reportSizes.userSizes.find(u => u.userId.toString() === userId) ??
            reportSizes.userSizes.find(
                u => u.userId.toString() === '66f540faaf4e960d2f9bebfc',
            );

        return userSizes
            ? Object.fromEntries(userSizes.columnSizes)
            : {};
    }
}
