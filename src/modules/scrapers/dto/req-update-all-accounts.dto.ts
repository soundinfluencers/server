import {IsNotEmpty, IsString} from 'class-validator';

export class ReqUpdateAllAccountsDto {
    @IsString({
        message: 'Invalid social media',
    })
    @IsNotEmpty({
        message: 'Social media cannot be empty',
    })
    socialMedia: string;

    @IsString({
        message: 'Invalid socket id',
    })
    @IsNotEmpty({
        message: 'Socket id cannot be empty',
    })
    socketId: string;

    @IsString({
        message: 'Invalid user id',
    })
    @IsNotEmpty({
        message: 'User id cannot be empty',
    })
    refreshInitiatorId: string;
}
