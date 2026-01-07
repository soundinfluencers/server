import {Controller, Post, UseInterceptors, UploadedFile, UploadedFiles, Get, Query} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import File from 'multer';
import {ApiOperation, ApiQuery, ApiTags} from '@nestjs/swagger';
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {FileService} from "./file.service";
import {Auth} from "../../common/decorators/auth.decorator";

@ApiTags('file')
@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {
    }

    @Auth()
    @ApiOperation({summary: 'Uploads screenshot - will be removed to files controller'})
    @ApiResponseDto()
    @UseInterceptors(FileInterceptor('file'))
    @Post()
    uploadFile(@UploadedFile() file: File) {
        return this.fileService.uploadDropBox(file);
    }

    @Auth()
    @ApiOperation({summary: 'Checks if screenshot uploaded - will be removed to files controller'})
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
