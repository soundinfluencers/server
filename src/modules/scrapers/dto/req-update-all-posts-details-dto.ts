import {IsNotEmpty, IsString} from 'class-validator';
import {ApiProperty} from "@nestjs/swagger";

export class ReqUpdateAllPostsDetailsDto {
    @IsString({
        message: 'Invalid campaign id',
    })
    @IsNotEmpty({
        message: 'Campaign id cannot be empty',
    })
    @ApiProperty({
        example: '234g1h2b'
    })
    campaignId: string;

    // @IsString({
    //     message: 'Invalid socket id',
    // })
    // @IsNotEmpty({
    //     message: 'Socket id cannot be empty',
    // })
    // @ApiProperty({
    //     example: '234g1h2b'
    // })
    // socketId: string;

    @IsString({
        message: 'Invalid campaign name',
    })
    @IsNotEmpty({
        message: 'Campaign name cannot be empty',
    })
    @ApiProperty({
        example: 'Campaign 1'
    })
    campaignName: string;

    refreshInitiatorId: string;
}
