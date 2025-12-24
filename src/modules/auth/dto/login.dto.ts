import {ApiProperty} from '@nestjs/swagger';
import {Role} from "../../../common/types/auth.types";

export class LoginDto {
    @ApiProperty({
        description: 'User email',
        example: 'test@gmail.com'
    })
    email: string;

    @ApiProperty({
        description: 'User password',
        example: 'qwerty12345'
    })
    password: string;

    @ApiProperty({
        description: 'User role',
        example: 'influencer',
        enum: Role
    })
    role: Role;
}

export class LoginResponseDto {
    @ApiProperty()
    accessToken: string;

    @ApiProperty()
    role: Role;

    @ApiProperty()
    _id: string;
}