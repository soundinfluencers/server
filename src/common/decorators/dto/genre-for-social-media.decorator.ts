import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import {
  isGenreAllowedForOfferSocialMedia,
  isOfferSocialMedia,
  OFFER_GENRES_BY_SOCIAL_MEDIA,
} from 'src/common/types/offer.types';

export function IsGenreAllowedForSocialMedia(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isGenreAllowedForSocialMedia',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === undefined || value === null) {
            return true;
          }

          if (typeof value !== 'string') {
            return false;
          }

          if (value.trim() === '') {
            return true;
          }

          const dto = args.object as { socialMedia?: unknown };
          const socialMedia = dto.socialMedia;

          if (!isOfferSocialMedia(socialMedia)) {
            return true;
          }

          return isGenreAllowedForOfferSocialMedia({
            socialMedia,
            genre: value,
          });
        },

        defaultMessage(args: ValidationArguments) {
          const dto = args.object as { socialMedia?: unknown };
          const socialMedia = dto.socialMedia;
          const genre = args.value;

          if (isOfferSocialMedia(socialMedia)) {
            const allowedGenres = OFFER_GENRES_BY_SOCIAL_MEDIA[socialMedia];

            return `genre "${genre}" is not allowed for social media "${socialMedia}". Allowed: ${allowedGenres.join(', ')}`;
          }

          return 'invalid genre for social media';
        },
      },
    });
  };
}
