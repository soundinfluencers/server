import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {VerifyInfluencer} from "../../schemas/verify-users/verifyInfluencer.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class VerifyInfluencerRepository extends BaseRepository<VerifyInfluencer> {
    constructor(
        @InjectModel('VerifyInfluencer')
        private readonly verifyInfluencerModel: Model<VerifyInfluencer>
    ) {
        super(verifyInfluencerModel);
    }
}