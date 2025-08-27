import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class ChangeOfferDeletedStatusDto {
  @IsString({
    message: 'Invalid offer ID',
  })
  @IsNotEmpty({
    message: 'Offer ID cannot be empty',
  })
  offerId: string;

  @IsBoolean({
    message: 'New status must be a boolean',
  })
  @IsNotEmpty({
    message: 'New status cannot be empty',
  })
  newStatus: boolean;
}
