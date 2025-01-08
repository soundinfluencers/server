import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Offers } from '../../promos/schemas/offers.schema';  

@Schema({
    timestamps: true,
})
export class OffersTemp {  
    @Prop({required: true})
    id: number;
    
    @Prop({required: false, default: 0})
    price: number;
    
    @Prop({required: true})
    followers: string;
    
    @Prop({required: true})
    network: string;
    
    @Prop({required: true})
    story: string;
    
    @Prop({required: false, default: 0})
    maxInfluencer: number;
    
    @Prop({required: false, default: []})
    connectInfluencer: [];
    
    @Prop({required: true})
    musicStyles: any[];
    
    @Prop({required: true})
    socialMedia: string;
    
    @Prop({required: true, default: false})
    isDeleted: boolean;  

    @Prop({required: true, default: true})
    isNew: boolean;
    
    @Prop({required: true, default: false})
    isUpdated: boolean;
}

export const OffersTempSchema = SchemaFactory.createForClass(OffersTemp);
