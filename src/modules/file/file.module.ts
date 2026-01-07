import {Module} from '@nestjs/common';
import {FileController} from './file.controller';
import {FileService} from "./file.service";
import {DropboxService} from "../../integrations/dropbox/dropbox";

@Module({
    controllers: [FileController],
    providers: [FileService, DropboxService],
    exports: [FileService]
})
export class FileModule {
}
