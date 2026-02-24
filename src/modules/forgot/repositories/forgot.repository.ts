import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../../../database/repositories/base.repository";
import {Forgot} from "../schemas/forgot.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class ForgotRepository extends BaseRepository<Forgot> {
    constructor(
        @InjectModel(Forgot.name)
        private readonly forgotModel: Model<Forgot>,
    ) {
        super(forgotModel);
    }
}