import {IsNotEmpty, IsOptional, IsString} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";

export class ReqUpdatePostDetailsDto {
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

    @IsString({
        message: 'Invalid account id',
    })
    @IsNotEmpty({
        message: 'Account id cannot be empty',
    })
    @ApiProperty({
        example: '234g1h2b',
        description: 'Id of account that will be updated'
    })
    accountId: string;

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

    refreshInitiatorId: string;

    refreshSessionId?: string;

    @ApiPropertyOptional({
        description: 'Frontend-generated tab correlation key stored in sessionStorage.',
    })
    @IsOptional()
    @IsString()
    clientId?: string;
}
