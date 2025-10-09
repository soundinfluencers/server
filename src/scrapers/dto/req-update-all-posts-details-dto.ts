import {IsNotEmpty, IsString} from 'class-validator';

export class ReqUpdateAllPostsDetailsDto {
    @IsString({
        message: 'Invalid campaign id',
    })
    @IsNotEmpty({
        message: 'Campaign id cannot be empty',
    })
    campaignId: string;

    @IsString({
        message: 'Invalid socket id',
    })
    @IsNotEmpty({
        message: 'Socket id cannot be empty',
    })
    socketId: string;

    @IsString({
        message: 'Invalid campaign name',
    })
    @IsNotEmpty({
        message: 'Campaign name cannot be empty',
    })
    campaignName: string;

    @IsString({
        message: 'Invalid user id',
    })
    @IsNotEmpty({
        message: 'User id cannot be empty',
    })
    refreshInitiatorId: string;
}
