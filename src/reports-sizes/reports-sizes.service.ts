import {Injectable, Logger} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";
import {ReportSizes} from "./schemas/reports-sizes.schema";
import {UpdateReportSizeDto} from "./dto/update-report-size.dto";
import {Promos} from "../promos/schemas/promo.schema";
import {Client} from "../auth/schemas/client.schema";
import {GetReportSizeDto} from "./dto/get-report-size.dto";
import {find} from "rxjs";

@Injectable()
export class ReportsSizesService {
    private readonly logger = new Logger();

    constructor(
        @InjectModel(ReportSizes.name) private reportsSizesModel: Model<ReportSizes>,
        @InjectModel(Client.name) private readonly clientModel: Model<Client>,
        @InjectModel(Promos.name) private readonly promosModel: Model<Promos>,
    ) {
    }

    async updateReportSize(data: UpdateReportSizeDto) {
        if (!data.campaignId || !data.columnSizes) {
            return { code: 400, message: 'Bad Request' };
        }

        const { campaignId, userId = "66f540faaf4e960d2f9bebfc", columnSizes } = data;

        try {
            const campaignExists = await this.promosModel.exists({ _id: campaignId });
            if (!campaignExists) {
                return { code: 404, message: 'Campaign Not Found' };
            }

            let reportSizes = await this.reportsSizesModel.findOne({ campaignId });

            if (!reportSizes) {
                reportSizes = await this.reportsSizesModel.create({
                    campaignId,
                    userSizes: [],
                });
            }

            const userSizeIndex = reportSizes.userSizes.findIndex(
                (u) => u.userId.toString() === userId
            );

            if (userSizeIndex === -1) {
                reportSizes.userSizes.push({
                    _id: new Types.ObjectId(),
                    userId: new Types.ObjectId(userId),
                    columnSizes: new Map(
                        Object.entries(columnSizes).map(([key, value]) => [key, Number(value)])
                    ),
                });
            } else {
                reportSizes.userSizes[userSizeIndex].columnSizes = new Map(
                    Object.entries(columnSizes).map(([key, value]) => [key, Number(value)])
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
                err instanceof Error ? err.stack : new Error().stack
            );
            return { code: 500, message: 'Internal Server Error' };
        }
    }

    async getReportSizeForUser(data: GetReportSizeDto) {
        if (!data.campaignId) {
            return { code: 400, message: 'Bad Request' };
        }

        const { campaignId, userId = "66f540faaf4e960d2f9bebfc" } = data;

        try {
            const reportSizesObj = await this.reportsSizesModel.findOne({ campaignId });
            if (!reportSizesObj) {
                return { code: 404, message: 'Not Found' };
            }

            let userSize = reportSizesObj.userSizes.find(u => u.userId.toString() === userId);

            if (!userSize) {
                const adminSizeEntry = reportSizesObj.userSizes.find(u => u.userId.toString() === "66f540faaf4e960d2f9bebfc");

                const adminSizesObj = adminSizeEntry
                    ? adminSizeEntry.columnSizes instanceof Map
                        ? Object.fromEntries(adminSizeEntry.columnSizes)
                        : adminSizeEntry.columnSizes
                    : {};

                const newUserSize = {
                    _id: new Types.ObjectId(),
                    userId: new Types.ObjectId(userId),
                    columnSizes: new Map(
                        Object.entries(adminSizesObj).map(([key, value]) => [key, Number(value)])
                    ),
                };

                reportSizesObj.userSizes.push(newUserSize);
                await reportSizesObj.save();

                userSize = newUserSize;
            }

            const sizesToReturn = userSize.columnSizes instanceof Map
                ? Object.fromEntries(userSize.columnSizes)
                : userSize.columnSizes;

            return {
                code: 200,
                sizesToReturn: [sizesToReturn],
            };
        } catch (e) {
            this.logger.error(
                `Error while getting report size for \nCampaign id: ${campaignId} \nUser id: ${userId} \n${e.message}`,
                e instanceof Error ? e.stack : new Error().stack
            );
            return { code: 500, message: 'Internal Server Error' };
        }
    }
}