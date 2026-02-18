import { ApiProperty } from '@nestjs/swagger';
import {Role} from "../../../common/types/user.types";

export class UpdateUserPasswordDto {
  @ApiProperty({ required: true })
  currentPassword: string;

  @ApiProperty({ required: true })
  newPassword: string;

  _id: string;
  role: Role;
}
