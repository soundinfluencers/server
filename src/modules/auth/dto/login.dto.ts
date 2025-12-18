import { ApiProperty } from '@nestjs/swagger';
import {Role} from "../../../common/types/auth.types";

export class LoginDto {
  @ApiProperty({ required: true })
  email: string;

  @ApiProperty({ required: true })
  password: string;
}

export class LoginResponseDto {
    @ApiProperty()
    accessToken: string;

    @ApiProperty()
    role: Role;

    @ApiProperty()
    _id: string;
}