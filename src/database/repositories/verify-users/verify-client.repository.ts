import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {VerifyClient} from "../../schemas/verify-users/verifyClient.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class VerifyClientRepository extends BaseRepository<VerifyClient> {
    constructor(
        @InjectModel('VerifyClient')
        private readonly verifyClientModel: Model<VerifyClient>,
    ) {
        super(verifyClientModel);
    }

}