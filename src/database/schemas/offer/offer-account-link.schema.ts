import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {HydratedDocument, Types} from 'mongoose';

export type OfferAccountLinkDocument = HydratedDocument<OfferAccountLink>;

@Schema({
    timestamps: true,
})
export class OfferAccountLink {
    @Prop({type: Types.ObjectId, required: true, ref: 'Offer'})
    offerId: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true, ref: 'Influencer'})
    influencerId: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true})
    accountId: Types.ObjectId;
}

export const OfferAccountLinkSchema = SchemaFactory.createForClass(OfferAccountLink);

OfferAccountLinkSchema.index(
    {offerId: 1, influencerId: 1, accountId: 1},
    {unique: true},
);

OfferAccountLinkSchema.index({influencerId: 1, accountId: 1});
