import { Injectable } from '@nestjs/common';
import { createWriteStream } from 'fs';
import DropboxService from "../../integrations/dropbox/dropbox";
import {MediaService} from "../media/media.service";
import {GetCampaignContentVideoUrl, GetCampaignPreviewItem} from "../media/dto/resolved-media.dto";

@Injectable()
export class FileService {
    constructor(
        private readonly dropboxService: DropboxService,
        private readonly mediaService: MediaService,
    ) {
    }

    // Uploads new photo to dropbox
    async uploadDropBox(file: any): Promise<string> {
        return await this.dropboxService.uploadFile(file.buffer, file.originalname);
    }

    // Checks uploaded status
    async checkUploadStatus(fileName: string): Promise<boolean> {
        return await this.dropboxService.isFileUploaded(fileName);
    }

    // Returns preview for video
    async getVideoPreview(params: GetCampaignPreviewItem) {
        return this.mediaService.getCampaignPreviewJpeg(params);
    }

    // Returns video url
    async getVideo(data: GetCampaignContentVideoUrl) {
        const { videoUrl } = await this.mediaService.getVideoRedirectUrl(data);
        return videoUrl;
    }
}
