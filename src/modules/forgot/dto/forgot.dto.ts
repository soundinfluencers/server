import {ApiProperty} from "@nestjs/swagger";
import {IsEmail, IsEnum, IsNotEmpty, IsString} from "class-validator";
import {Role} from "../../../common/types/user.types";


// -------------- REQUESTS ----------------

export class CreateNewForgotRequestDto {
    @ApiProperty({type: String, required: true})
    @IsEmail()
    email: string;

    @ApiProperty({type: String, required: true})
    @IsEnum(Role)
    role: Role;
}

export class CloseForgotRequestDto {
    @ApiProperty({type: String, required: true})
    @IsEmail()
    email: string;

    @ApiProperty({type: String, required: true})
    @IsEnum(Role)
    role: Role;

    @ApiProperty({type: String, required: true})
    @IsString()
    @IsNotEmpty()
    code: string;
}