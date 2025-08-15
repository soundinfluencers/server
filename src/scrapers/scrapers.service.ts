import {InjectModel} from "@nestjs/mongoose";
import {Offer} from "../offers/schemas/offer.schema";
import {Injectable, Logger} from "@nestjs/common";
import {Model} from "mongoose";
import {Influencer} from "../auth/schemas/influencer.schema";
import {Promos} from "../promos/schemas/promo.schema";

@Injectable()
export class ScrapersService {
    private readonly logger = new Logger();

    constructor(
        @InjectModel(Offer.name) private offersModel: Model<Offer>,
        @InjectModel(Influencer.name) private readonly influencerModel: Model<Influencer>,
        @InjectModel(Promos.name) private readonly campaignsModel: Model<Promos>,
    ) {
    }

}