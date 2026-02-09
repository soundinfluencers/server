import { Injectable } from '@nestjs/common';
import { createWriteStream } from 'fs';
import DropboxService from "../../integrations/dropbox/dropbox";

@Injectable()
export class FileService {
    constructor(
        private readonly dropboxService: DropboxService,
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


}
