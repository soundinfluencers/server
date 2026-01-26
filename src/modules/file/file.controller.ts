import {Controller, Post, UseInterceptors, UploadedFile, Get, Query} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags} from '@nestjs/swagger';
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {FileService} from "./file.service";
import {Auth} from "../../common/decorators/auth.decorator";

@ApiTags('file')
@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {
    }

    @ApiOperation({ summary: 'Uploads photo' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
            required: ['file'],
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    @Post()
    uploadPhoto(@UploadedFile() file: Express.Multer.File) {
        return this.fileService.uploadDropBox(file);
    }

    @ApiOperation({summary: 'Checks if photo uploaded'})
    @ApiQuery({
        name: 'fileName',
        required: true,
        type: 'string',
    })
    @ApiResponseDto()
    @Get('upload-status')
    async checkUploadStatus(@Query('fileName') fileName: string): Promise<boolean> {
        return await this.fileService.checkUploadStatus(fileName);
    }
}
