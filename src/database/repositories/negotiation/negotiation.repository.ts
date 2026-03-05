import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {
    Negotiation,
    NegotiationDocument, NegotiationOffer, NegotiationOfferDocument,
} from "../../schemas/negotiation/negotiation.schema";
import {InjectModel} from "@nestjs/mongoose";
import {ClientSession, Model} from "mongoose";
import {NegotiationDto} from "../../../modules/profile/dto/negotiation.dto";
import {ObjId} from "../../../common/types/base.types";

// Interface for negotiation repository
export interface INegotiationRepository {
    startNegotiation(payload: NegotiationDto): Promise<void>;
}

@Injectable()
export class NegotiationRepository extends BaseRepository<NegotiationDocument> implements INegotiationRepository {
    constructor(
        @InjectModel(Negotiation.name)
        private readonly negotiationModel: Model<NegotiationDocument>,
        @InjectModel(NegotiationOffer.name)
        private readonly negotiationOfferModel: Model<NegotiationOfferDocument>,
    ) {
        super(negotiationModel);
    }

    // Method for starting new negotiation
    async startNegotiation(payload: NegotiationDto): Promise<void> {
        const session: ClientSession = await this.negotiationModel.startSession();
        session.startTransaction();

        // _id of future negotiation
        const negotiationId = new ObjId;

        // _id of future negotiation offer
        const negotiationOfferId = new ObjId();

        // Payload for creating negotiation
        const negotiationPayload: Negotiation = {
            _id: negotiationId,
            userId: payload.userId,
            disputedAccount: {
                accountId: payload.accountId,
                socialMedia: payload.socialMedia
            },
            offersToAdmin: [negotiationOfferId],
            offersToUser: []
        };

        // Payload for creating negotiation offer to admin
        const negotiationOfferPayload: NegotiationOffer = {
            _id: negotiationOfferId,
            negotiationId: negotiationId,
            offeredPrice: payload.offerPayload.offeredPrice,
            currency: payload.offerPayload.currencyCode,
            email: payload.offerPayload.email
        }

        try {
            await this.negotiationModel.create([negotiationPayload], { session });
            await this.negotiationOfferModel.create([negotiationOfferPayload], { session });

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    }
}