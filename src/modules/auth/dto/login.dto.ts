import {ApiProperty} from '@nestjs/swagger';
import {Role} from "../../../common/types/auth.types";
import {IsEmail, IsEnum, IsString} from "class-validator";

export class LoginDto {
    @ApiProperty({
        description: 'User email',
        example: 'test@gmail.com',
    })
    @IsEmail({}, { message: 'Email must be valid' })
    email: string;

    @ApiProperty({
        description: 'User password',
        example: 'qwerty12345',
    })
    @IsString({ message: 'Password must be a string' })
    password: string;

    @ApiProperty({
        description: 'User role',
        example: 'influencer',
        enum: Role,
    })
    @IsEnum(Role, { message: 'Role must be a valid enum value' })
    role: Role;
}

export class LoginResponseDto {
    @ApiProperty()
    accessToken: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    role: Role;

    @ApiProperty()
    balance?: number;
}