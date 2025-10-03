import {IsNotEmpty, IsString} from 'class-validator';

export class ReqUpdatePostDetailsDto {
    @IsString({
        message: 'Invalid campaign id',
    })
    @IsNotEmpty({
        message: 'Campaign id cannot be empty',
    })
    campaignId: string;

    @IsString({
        message: 'Invalid account id',
    })
    @IsNotEmpty({
        message: 'Account id cannot be empty',
    })
    accountId: string;

    @IsString({
        message: 'Invalid socket id',
    })
    @IsNotEmpty({
        message: 'Socket id cannot be empty',
    })
    socketId: string;
}
