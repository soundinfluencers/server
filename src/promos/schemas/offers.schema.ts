import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';

export interface MusicStyle {
    price: number;
    genres: string[];
    connectInfluencer: [];
}

@Schema()
export class MusicStyleSchema {
    @Prop()
    price: number;

    @Prop({type: [String]})
    genres: string[];
    
    @Prop()
    connectInfluencer: [];
}

export const MusicStyleSchemaSchema = SchemaFactory.createForClass(MusicStyleSchema);

@Schema({
    timestamps: true,
})
export class Offers {
    @Prop()
    id: number;

    @Prop({required: false, default: 0})
    price: number;

    @Prop({required: false, default: 0})
    maxInfluencer: number;

    @Prop({required: false, default: null})
    connectInfluencer: [];

    @Prop()
    followers: string;

    @Prop()
    network: string;

    @Prop()
    story: string;
    
    @Prop()
    socialMedia: string;

    @Prop({type: [MusicStyleSchemaSchema]})
    musicStyles: MusicStyle[];
}

export const OffersSchema = SchemaFactory.createForClass(Offers);