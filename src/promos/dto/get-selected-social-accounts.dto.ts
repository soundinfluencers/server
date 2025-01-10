import {ApiProperty} from '@nestjs/swagger';
import mongoose from 'mongoose';

interface selectedAccountsType {
    influencerId: string;
    instagramUsername: string;
}

export class GetSelectedSocialAccountsDto {
    @ApiProperty({
        required: true,
        type: 'array',
        items: {
            type: 'object',
        },
    })
    selectedAccounts: selectedAccountsType[];
    
    @ApiProperty({required: true, type: 'string'})
    socialMedia: string;
}
