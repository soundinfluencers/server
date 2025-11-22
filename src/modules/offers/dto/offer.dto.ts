import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';
import {SocialMediaEnum} from "../../../common/types/social-media.types";

export class OfferDto {
  @IsString({
    message: (args: ValidationArguments) => `${args.value} is not a valid title for offer`,
  })
  @IsNotEmpty({
    message: 'Offer title can not be empty',
  })
  title: string;

  @IsEnum({
    enum: SocialMediaEnum,
    message: (args: ValidationArguments) => `${args.value} is not a valid social media for offer`,
  })
  socialMedia: SocialMediaEnum;

  @IsArray({ message: 'connectedAccounts must be an array' })
  @ArrayNotEmpty({ message: 'connectedAccounts can not be empty' })
  @IsString({ each: true, message: 'Each connected account must be a string' })
  connectedAccounts: string[];

  @Type(() => Number)
  @IsNumber({}, { message: 'price must be a number' })
  price: number;

  @IsOptional()
  @IsEnum({
    enum: [
      'Techno (Melodic, Minimal)',
      'Techno (Hard, Peak)',
      'House (Tech House)',
      'House (Melodic, Afro)',
      'EDM',
      'D&B',
      'Bass',
      'Psy, Trance',
      'Dubstep',
      'Garage',
      'Dance Pop',
    ],
    message: (args: ValidationArguments) => `${args.value} is not a valid genre for offer`,
  })
  genre?: string | null;

  @IsOptional()
  combinedFollowers?: string | null;

  @IsOptional()
  @IsString({ message: 'networksAmount must be a string' })
  networksAmount?: string | null;

  @IsOptional()
  @IsString({ message: 'storyAndPostDetails must be a string' })
  storyAndPostDetails?: string | null;
}
