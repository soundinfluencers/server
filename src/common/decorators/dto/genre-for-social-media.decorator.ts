import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
} from 'class-validator';
import {SocialMediaEnum} from '../../types/social-media.types';
import {allowedGenresMap, isGenreAllowedForSocialMedia} from '../../types/genres.types';

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
                    const dto = args.object as {socialMedia?: unknown};
                    const sm = dto.socialMedia;
                    if (
                        typeof sm !== 'string' ||
                        !Object.values(SocialMediaEnum).includes(sm as SocialMediaEnum)
                    ) {
                        return true;
                    }
                    return isGenreAllowedForSocialMedia(sm as SocialMediaEnum, value);
                },
                defaultMessage(args: ValidationArguments) {
                    const dto = args.object as {socialMedia?: SocialMediaEnum};
                    const sm = dto.socialMedia;
                    const value = args.value;
                    if (sm && Object.values(SocialMediaEnum).includes(sm)) {
                        const allowed = allowedGenresMap[sm].join(', ');
                        return `genre "${value}" is not allowed for social media "${sm}". Allowed: ${allowed}`;
                    }
                    return 'invalid genre for social media';
                },
            },
        });
    };
}
