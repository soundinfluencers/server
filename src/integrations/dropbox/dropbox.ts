import { Injectable } from '@nestjs/common';
import { Dropbox, DropboxAuth } from 'dropbox';
import {DropboxLinkKind} from "../../common/types/file/file.types";

export function detectDropboxLinkKind(url: string): DropboxLinkKind {
    let u: URL;
    try {
        u = new URL(url);
    } catch {
        return 'not_dropbox';
    }

    const hostIsDropbox =
        u.hostname.endsWith('dropbox.com') || u.hostname === 'dl.dropboxusercontent.com';

    if (!hostIsDropbox) return 'not_dropbox';

    if (u.pathname.includes('/scl/fo/')) return 'folder';

    if (u.pathname.includes('/s/') || u.pathname.includes('/scl/fi/')) return 'file';

    return 'unknown_dropbox';
}

@Injectable()
export class DropboxService {
    private dbxAuth: DropboxAuth;
    private dbx: Dropbox;
    private accessToken: string;
    private refreshToken: string;

    constructor() {
        this.accessToken =
            'sl.B-ucodXvHPOp5y8kIGneeEypJXP8PRWI51hPTAuO_9CUi2KuARIsmd2zfGbe6f2F9Q_-xTAWt6nOpj3pLekFlm6hKHcHkN6Okapi0xM5Ynp-aX6cuirywobFbTOwGaImuOms8znfkcGMrYBCmslT'; // Новый access token
        this.refreshToken = 'QydSschJ_vMAAAAAAAAAAUH0fIuNzZ9ExG5TwzqHpa4bgiAUcJkXCf9ouONt5bSE';
        this.dbx = new Dropbox({
            clientId: 'rnxlin8iqwjihu7',
            clientSecret: 'drq6feze89b0j33',
            refreshToken: this.refreshToken,
        });
        this.dbxAuth = new DropboxAuth({
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
        });
    }

    async isFileUploaded(fileName: string): Promise<boolean> {
        try {
            const response = await this.dbx.filesListFolder({ path: '' });
            const fileExists = response.result.entries.some((entry) => entry.name === fileName);
            return fileExists;
        } catch (error) {
            return false;
        }
    }

    async uploadFile(fileBuffer: Buffer, fileName: string): Promise<string> {
        const CHUNK_SIZE = 16 * 1024 * 1024; // 8MB
        const fileSize = fileBuffer.length;

        try {
            if (fileSize <= CHUNK_SIZE) {
                const response = await this.dbx.filesUpload({
                    path: '/' + new Date().toISOString() + fileName,
                    contents: fileBuffer,
                });

                const shareLink = await this.dbx.sharingCreateSharedLinkWithSettings({
                    path: response.result.path_lower,
                    settings: { requested_visibility: { '.tag': 'public' } },
                });

                return shareLink.result.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
            } else {
                let sessionId = await this.startUploadSession(fileBuffer.slice(0, CHUNK_SIZE));

                let promises = [];
                let offset = CHUNK_SIZE;
                while (offset < fileSize) {
                    const chunk = fileBuffer.slice(offset, offset + CHUNK_SIZE);
                    promises.push(this.appendUploadSession(sessionId, chunk, offset));
                    offset += CHUNK_SIZE;
                }

                await Promise.all(promises);

                const resultUrl = await this.finishUploadSession(
                    sessionId,
                    fileBuffer.slice(offset - CHUNK_SIZE),
                    fileName,
                );
                return resultUrl;
            }
        } catch (error) {
            console.error('Error uploading file to Dropbox', error);
            throw new Error('Unable to upload file to Dropbox');
        }
    }

    async startUploadSession(firstChunk: Buffer): Promise<string> {
        const response = await this.dbx.filesUploadSessionStart({
            close: false,
            contents: firstChunk,
        });
        return response.result.session_id;
    }

    async appendUploadSession(sessionId: string, chunk: Buffer, offset: number): Promise<void> {
        await this.dbx.filesUploadSessionAppendV2({
            cursor: {
                session_id: sessionId,
                offset: offset,
            },
            contents: chunk,
        });
    }

    async finishUploadSession(
        sessionId: string,
        lastChunk: Buffer,
        fileName: string,
    ): Promise<string> {
        const response = await this.dbx.filesUploadSessionFinish({
            cursor: {
                session_id: sessionId,
                offset: lastChunk.length,
            },
            commit: {
                path: `/${fileName}`,
                mode: { '.tag': 'add' },
                autorename: true,
            },
            contents: lastChunk,
        });

        const shareLink = await this.dbx.sharingCreateSharedLinkWithSettings({
            path: response.result.path_lower,
            settings: {
                requested_visibility: { '.tag': 'public' },
            },
        });

        return shareLink.result.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    }

    async listVideosFromSharedFolder(folderUrl: string) {
        const videos: Array<{ id: string; name: string; size?: number }> = [];

        let res = await this.dbx.filesListFolder({
            path: '',
            shared_link: { url: folderUrl },
            recursive: false,
            include_media_info: false,
        });

        while (true) {
            for (const e of res.result.entries) {
                if (e['.tag'] !== 'file') continue;
                const name = (e as any).name as string;
                if (!name.toLowerCase().endsWith('.mp4')) continue;

                videos.push({
                    id: (e as any).id,
                    name,
                    size: (e as any).size,
                });
            }

            if (!res.result.has_more) break;
            res = await this.dbx.filesListFolderContinue({ cursor: res.result.cursor });
        }

        return videos;
    }

    async getPlayableTempLinkById(fileId: string) {
        const r = await this.dbx.filesGetTemporaryLink({ path: fileId });
        return r.result.link;
    }

    async tryGetPosterBase64ById(fileId: string) {
        try {
            const r = await this.dbx.filesGetThumbnailV2({
                resource: { '.tag': 'path', path: fileId },
                format: { '.tag': 'jpeg' },
                size: { '.tag': 'w640h480' },
                mode: { '.tag': 'bestfit' },
            });

            const bytes = (r as any).result.thumbnail as Uint8Array;
            const b64 = Buffer.from(bytes).toString('base64');
            return `data:image/jpeg;base64,${b64}`;
        } catch {
            return null;
        }
    }
}
