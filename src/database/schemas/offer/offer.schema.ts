import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  isGenreAllowedForOfferSocialMedia,
  OfferSocialMediaEnum,
} from 'src/common/types/offer.types';
import {
  CommunityMusicGenres,
  CreatorMusicGenres,
} from 'src/common/types/influencer/influencer.types';

@Schema({
  timestamps: true,
})
export class Offer {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({
    required: true,
    type: String,
    enum: OfferSocialMediaEnum,
  })
  socialMedia: OfferSocialMediaEnum;

  @Prop({
    required: true,
  })
  price: number;

  @Prop({
    type: String,
    required: true,
    validate: {
      validator: function (this: Offer, genre: string) {
        return isGenreAllowedForOfferSocialMedia({
          socialMedia: this.socialMedia,
          genre,
        });
      },
      message: function (props) {
        return `Invalid genre "${props.value}" for selected socialMedia`;
      },
    },
  })
  genre: CommunityMusicGenres | CreatorMusicGenres;

  @Prop({ required: false, default: false })
  isPublished: boolean;

  // @Prop({required: false, default: false})
  // isDeleted: boolean;

  @Prop({ required: false, type: Number })
  combinedFollowers?: number;

  @Prop({ required: false, type: String })
  networksAmount?: string;

  @Prop({ required: false, type: String })
  storyAndPostDetails?: string;

  @Prop({ type: Types.ObjectId })
  referenceId?: Types.ObjectId;

  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);

OfferSchema.index({
  socialMedia: 1,
  genre: 1,
  isPublished: 1,
  combinedFollowers: 1,
  createdAt: -1,
  _id: -1,
});

OfferSchema.index({
  socialMedia: 1,
  genre: 1,
  referenceId: 1,
  combinedFollowers: 1,
  createdAt: -1,
  _id: -1,
});

OfferSchema.index({
  referenceId: 1,
  isPublished: 1,
  updatedAt: -1,
  createdAt: -1,
  _id: -1,
});
