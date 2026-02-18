import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Role} from "../../../common/types/user.types";
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

// dto for get/me response (base user info for home page)
export class GetMeResponseDto {
    @ApiProperty()
    firstName: string;

    @ApiProperty()
    role: Role;

    @ApiPropertyOptional()
    balance?: number;

    @ApiPropertyOptional()
    logoUrl?: string;
}

// dto for login response (adds accessToken to get/me)
export class LoginResponseDto extends GetMeResponseDto {
    @ApiProperty()
    accessToken: string;
}