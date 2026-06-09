import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {NegotiationMessage} from "../../schemas/email/negotiation-message.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

// Interface for negotiation message repository
interface INegotiationMessageRepository {}

@Injectable()
export class NegotiationMessageRepository extends BaseRepository<NegotiationMessage> implements INegotiationMessageRepository {
    constructor(
        @InjectModel(NegotiationMessage.name)
        private readonly negotiationMessageModel: Model<NegotiationMessage>,
    ) {
        super(negotiationMessageModel);
    }
}