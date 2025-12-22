import {ApiProperty} from '@nestjs/swagger';

export class UpdateClientPersonalDetailsDto {
    _id: string;

    @ApiProperty({required: true})
    firstName: string;

    @ApiProperty({required: true})
    company: string;

    @ApiProperty({required: true})
    email: string;

    @ApiProperty({required: true})
    phone: string;
}

export class ClientUpdatedPersonalDetailsDto {
    @ApiProperty({required: true})
    firstName: string;

    @ApiProperty({required: true})
    company: string;

    @ApiProperty({required: true})
    email: string;

    @ApiProperty({required: true})
    phone: string;
}