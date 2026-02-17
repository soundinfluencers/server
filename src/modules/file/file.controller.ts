import {Controller, Post, UseInterceptors, UploadedFile, Get, Query, Header, Param, Res, Body} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {FileService} from "./file.service";
import {Auth} from "../../common/decorators/auth.decorator";
import {Public} from "../../common/decorators/public.decorator";
import {
    CampaignPreviewItemDto,
    GetCampaignContentVideoUrl,
    GetCampaignPreviewItem
} from "../media/dto/resolved-media.dto";
import {ThumbSizeTag} from "../media/strategies/media.strategy";
import {Response} from "express";

@ApiTags('file')
@Controller('file')
export class FileController {
    constructor(
        private readonly fileService: FileService
    ) {
    }

    @Public()
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

    @Public()
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

    @Public()
    @ApiOperation({summary: 'Returns previews for campaign content videos'})
    @ApiResponseDto(CampaignPreviewItemDto, {successStatusCode: 201})
    @Header('Content-Type', 'image/jpeg')
    @Header('Cache-Control', 'public, max-age=86400')
    @Post('preview')
    async getCampaignContentPreview(@Body() data: GetCampaignPreviewItem, @Res() res: Response) {
        const buffer = await this.fileService.getVideoPreview(data);

        if (!buffer) return res.status(404).end();

        return res.send(buffer);
    }

    @Public()
    @ApiOperation({summary: 'Returns campaign content video'})
    @ApiResponseDto()
    @Post('video')
    async getCampaignVideo(@Body() data: GetCampaignContentVideoUrl, @Res() res: Response) {
        const videoUrl = await this.fileService.getVideo(data);
        return res.redirect(302, videoUrl);
    }
}
