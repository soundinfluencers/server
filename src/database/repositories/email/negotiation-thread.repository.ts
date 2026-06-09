import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {NegotiationThread} from "../../schemas/email/negotiation-thread.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

// Interface for negotiation thread repository
interface INegotiationThreadRepository {

}

@Injectable()
export class NegotiationThreadRepository extends BaseRepository<NegotiationThread> implements INegotiationThreadRepository {
    constructor(
        @InjectModel(NegotiationThread.name)
        private readonly negotiationThreadModel: Model<NegotiationThread>
    ) {
        super(negotiationThreadModel);
    }
}