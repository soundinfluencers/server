import { Injectable } from "@nestjs/common";
import { OfferRepository } from "src/database/repositories/offers/offer.repository";
import { AdminCreateOfferDto } from "../../dto/offers/admin-offers-matrix.dto";
import { Offer } from "src/database/schemas/offer/offer.schema";
import { ObjId } from "src/common/types/base.types";
import { ClientSession } from "mongoose";

export const CREATE_OFFER_SERVICE = Symbol('CREATE_OFFER_SERVICE');

@Injectable()
export class CreateOfferService {
    constructor(
        private readonly offerRepository: OfferRepository
    ) { }

    exec(data: AdminCreateOfferDto, session?: ClientSession): Promise<Offer> {
        return this.offerRepository.create({
            _id: data.requestedId ?? new ObjId(),
            title: data.offerName,
            socialMedia: data.socialMedia,
            price: data.price ?? 0,
            genre: data.genre,
            isPublished: false,
            combinedFollowers: data.combinedFollowers ?? 0,
            networksAmount: data.networksAmount ?? '0',
            storyAndPostDetails: data.storyAndPostDetails ?? '0',
            ...data.referenceId ? { referenceId: data.referenceId } : {}
        } satisfies Offer, {session});
    }
}