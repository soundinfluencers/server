import { Injectable } from '@nestjs/common';
import { MediaStrategy } from './media.strategy';
import {MediaKindEnum, MediaProviderEnum} from "../../../common/types/file/file.types";

@Injectable()
export class DirectMediaStrategy implements MediaStrategy {
    canHandle(_: string): boolean {
        return true;
    }

    async resolve(contentItem: any) {
        return {
            resolved: {
                provider: MediaProviderEnum.direct,
                kind: MediaKindEnum.file,
                items: [{ videoUrl: contentItem.mainLink, previewUrl: null }],
            },
        };
    }
}
