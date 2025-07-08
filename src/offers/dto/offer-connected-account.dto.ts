import { IsNotEmpty, IsString, ValidationArguments } from 'class-validator';

export class OfferConnectedAccountDto {
  @IsString({
    message: 'Influencer id must be a string',
  })
  @IsNotEmpty({
    message: 'Influencer id can not be empty',
  })
  influencerId: string;

  @IsString({
    message: 'Account username must be a string',
  })
  @IsNotEmpty({
    message: 'Account username can not be empty',
  })
  socialMediaUsername: string;
}
