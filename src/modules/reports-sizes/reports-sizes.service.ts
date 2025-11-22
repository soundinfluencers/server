import {Injectable, Logger} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Model, Types} from 'mongoose';
import {ReportSizes} from './schemas/reports-sizes.schema';
import {UpdateReportSizeDto} from './dto/update-report-size.dto';
import {Promos} from '../promos/schemas/promo.schema';
import {Client} from '../auth/schemas/client.schema';
import {GetReportSizeDto} from './dto/get-report-size.dto';
import {find} from 'rxjs';
import {ProposalCampaign} from "../proposal-system/schemas/proposal-campaign.schema";

@Injectable()
export class ReportsSizesService {
    private readonly logger = new Logger();

    constructor(
        @InjectModel(ReportSizes.name) private reportsSizesModel: Model<ReportSizes>,
        @InjectModel(Client.name) private readonly clientModel: Model<Client>,
        @InjectModel(Promos.name) private readonly promosModel: Model<Promos>,
        @InjectModel(ProposalCampaign.name) private readonly proposalCampaignModel: Model<ProposalCampaign>,
    ) {
    }

    async updateReportSize(data: UpdateReportSizeDto) {
        if (!data.campaignId || !data.columnSizes) {
            return {code: 400, message: 'Bad Request'};
        }

        const {campaignId, userId = '66f540faaf4e960d2f9bebfc', columnSizes} = data;

        const allDefault = Object.values(columnSizes).every(value => Number(value) === 150);
        if (allDefault) {
            return {code: 200, message: 'Default sizes not saved', data: null};
        }

        try {
            const campaignExists =
                !!(await this.promosModel.exists({ _id: campaignId })) ||
                !!(await this.proposalCampaignModel.exists({ _id: campaignId }));

            if (!campaignExists) {
                return { code: 404, message: 'Campaign Not Found' };
            }

            let reportSizes = await this.reportsSizesModel.findOne({campaignId});

            if (!reportSizes) {
                reportSizes = await this.reportsSizesModel.create({
                    campaignId,
                    userSizes: [],
                });
            }

            const userSizeIndex = reportSizes.userSizes.findIndex((u) =>
                u.userId.toString() === userId,
            );

            if (userSizeIndex === -1) {
                reportSizes.userSizes.push({
                    _id: new Types.ObjectId(),
                    userId: new Types.ObjectId(userId),
                    columnSizes: new Map(
                        Object.entries(columnSizes).map(([key, value]) => [key, Number(value)]),
                    ),
                });
            } else {
                reportSizes.userSizes[userSizeIndex].columnSizes = new Map(
                    Object.entries(columnSizes).map(([key, value]) => [key, Number(value)]),
                );
            }

            await reportSizes.save();

            return {
                code: 200,
                message: 'Report sizes updated successfully',
                data: reportSizes,
            };
        } catch (err) {
            this.logger.error(
                `Error while updating report sizes for \nCampaign id: ${campaignId} \nUser id: ${userId} \n${err.message}`,
                err instanceof Error ? err.stack : new Error().stack,
            );
            return {code: 500, message: 'Internal Server Error'};
        }
    }

    async getReportSizeForUser({campaignId, userId}: GetReportSizeDto) {
        try {
            const reportSizes = await this.reportsSizesModel.findOne({campaignId});
            if (!reportSizes) return null;

            const userSizes = reportSizes.userSizes.find(u =>
                u.userId.toString() === userId,
            );

            if (userSizes) {
                return {code: 200, sizes: userSizes.columnSizes};
            }

            const adminSizes = reportSizes.userSizes.find(u =>
                u.userId.toString() === '66f540faaf4e960d2f9bebfc'
            )?.columnSizes;


            return {code: 200, sizes: adminSizes} || {code: 200, sizes: null};
        } catch (err) {
            this.logger.error(
                `Error while getting report sizes for Campaign: ${campaignId}, User: ${userId} \n${err.message}`,
                err instanceof Error ? err.stack : new Error().stack
            );
            throw err;
        }
    }
}
