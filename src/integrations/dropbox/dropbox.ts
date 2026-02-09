import { Injectable } from '@nestjs/common';
import { Dropbox, DropboxAuth } from 'dropbox';
import {DropboxLinkKind} from "../../common/types/file/file.types";
import {ThumbSizeTag} from "../../modules/media/strategies/media.strategy";

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

export type DropboxSharedFolderVideo = {
    id?: string;
    name: string;
    size?: number;
    pathLower: string;
};

@Injectable()
class DropboxService {
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

    async listVideosFromSharedFolder(
        folderUrl: string,
        opts?: {
            recursive?: boolean;
            extensions?: string[];
            maxItems?: number;
        },
    ): Promise<DropboxSharedFolderVideo[]> {
        const extensions = (opts?.extensions ?? ['.mp4', '.mov', '.m4v', '.webm']).map((x) =>
            x.toLowerCase(),
        );
        const maxItems = opts?.maxItems ?? 500;
        const recursive = opts?.recursive ?? false;

        const videos: DropboxSharedFolderVideo[] = [];

        let res = await this.dbx.filesListFolder({
            path: '',
            shared_link: { url: folderUrl },
            recursive,
            include_media_info: false,
            include_deleted: false,
        });

        while (true) {
            for (const e of res.result.entries) {
                if (videos.length >= maxItems) return videos;
                if ((e as any)['.tag'] !== 'file') continue;

                const anyE = e as any;
                const name = (anyE.name as string) ?? '';
                const lower = name.toLowerCase();

                if (!extensions.some((ext) => lower.endsWith(ext))) continue;

                const pathLower = anyE.path_lower as string | undefined;
                if (!pathLower) continue;

                videos.push({
                    id: anyE.id,
                    name,
                    size: anyE.size,
                    pathLower,
                });
            }

            if (!res.result.has_more) break;
            res = await this.dbx.filesListFolderContinue({ cursor: res.result.cursor });
        }

        return videos;
    }

    async getPlayableTempLinkByPath(pathLower: string): Promise<string> {
        const r = await this.dbx.filesGetTemporaryLink({ path: pathLower });
        return r.result.link;
    }

    async tryGetPosterBase64ByPath(
        pathLower: string,
        opts?: {
            sizeTag?: ThumbSizeTag
        },
    ): Promise<string | null> {
        try {
            const sizeTag = opts?.sizeTag ?? 'w256h256';

            const r: any = await this.dbx.filesGetThumbnailV2({
                resource: { '.tag': 'path', path: pathLower },
                format: { '.tag': 'jpeg' },
                size: { '.tag': sizeTag },
                mode: { '.tag': 'bestfit' },
            });

            const bytes: any =
                r?.result?.thumbnail ??
                r?.result?.fileBinary ??
                r?.fileBinary ??
                r?.result;

            console.log(r, 'res')

            if (!bytes) {
                console.warn('Dropbox thumbnail bytes missing for', pathLower);
                return null;
            }

            const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
            return `data:image/jpeg;base64,${buf.toString('base64')}`;
        } catch (e: any) {
            console.error('tryGetPosterBase64ByPath failed', e?.error ?? e);
            return null;
        }
    }

    async tryGetPosterJpegByPath(
        pathLower: string,
        opts?: { sizeTag?: ThumbSizeTag },
    ): Promise<Buffer | null> {
        try {
            const sizeTag = opts?.sizeTag ?? 'w256h256';

            const r: any = await this.dbx.filesGetThumbnailV2({
                resource: { '.tag': 'path', path: pathLower },
                format: { '.tag': 'jpeg' },
                size: { '.tag': sizeTag },
                mode: { '.tag': 'bestfit' },
            });

            const bytes: any =
                r?.result?.thumbnail ??
                r?.result?.fileBinary ??
                r?.fileBinary ??
                r?.result;

            if (!bytes) return null;

            if (Buffer.isBuffer(bytes)) return bytes;
            if (bytes instanceof Uint8Array) return Buffer.from(bytes);
            if (bytes instanceof ArrayBuffer) return Buffer.from(new Uint8Array(bytes));

            if (typeof bytes === 'string') {
                const b64 = bytes.startsWith('data:')
                    ? bytes.slice(bytes.indexOf('base64,') + 'base64,'.length)
                    : bytes;
                return Buffer.from(b64, 'base64');
            }

            return Buffer.from(bytes);
        } catch (e: any) {
            console.error('tryGetPosterJpegByPath failed', e?.error ?? e);
            return null;
        }
    }


    async resolveFilePathFromSharedLink(sharedUrl: string): Promise<{
        id?: string;
        pathLower?: string;
        name?: string;
    }> {
        const r = await this.dbx.sharingGetSharedLinkMetadata({ url: sharedUrl });
        const md: any = r.result;

        return {
            id: md?.id,
            pathLower: md?.path_lower,
            name: md?.name,
        };
    }

    async getPlayableTempLinkFromSharedFileLink(sharedUrl: string): Promise<{
        videoUrl: string;
        fileId?: string;
        name?: string;
        pathLower?: string;
    }> {
        const meta = await this.resolveFilePathFromSharedLink(sharedUrl);

        if (!meta.pathLower) {
            return {
                videoUrl: this.toDropboxRaw(sharedUrl),
                fileId: meta.id,
                name: meta.name,
                pathLower: undefined,
            };
        }

        const videoUrl = await this.getPlayableTempLinkByPath(meta.pathLower);
        return {
            videoUrl,
            fileId: meta.id,
            name: meta.name,
            pathLower: meta.pathLower,
        };
    }

    toDropboxRaw(url: string): string {
        const u = new URL(url);
        u.searchParams.delete('dl');
        u.searchParams.set('raw', '1');
        return u.toString();
    }
}

export default DropboxService
