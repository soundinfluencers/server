import {ApiProperty} from "@nestjs/swagger";

export class AdminSendWhatsappMessageDto {
    @ApiProperty({required: true})
    influencerId: string;

    @ApiProperty({required: true})
    message: string;
}