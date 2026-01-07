import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {ReportSizes} from "../../schemas/report-size/reports-sizes.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class ReportSizeRepository extends BaseRepository<ReportSizes> {
    constructor(
        @InjectModel(ReportSizes.name)
        private readonly reportSizeModel: Model<ReportSizes>
    ) {
        super(reportSizeModel);
    }
}