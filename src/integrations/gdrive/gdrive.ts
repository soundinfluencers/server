import { Injectable, Logger } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import { ThumbSizeTag } from '../../modules/media/strategies/media.strategy';

export type GdriveLinkKind = 'folder' | 'file' | 'not_gdrive' | 'unknown_gdrive';

export type GdriveVideo = {
  fileId: string;
  name: string;
  mimeType: string;
};

export function detectGdriveLinkKind(url: string): GdriveLinkKind {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'not_gdrive';
  }

  if (!u.hostname.endsWith('drive.google.com') && !u.hostname.endsWith('docs.google.com')) {
    return 'not_gdrive';
  }

  if (u.pathname.includes('/folders/')) return 'folder';
  if (u.pathname.includes('/file/d/')) return 'file';
  if (u.searchParams.has('id')) return 'file';

  return 'unknown_gdrive';
}

export function extractGdriveId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  // /drive/folders/{id} or /drive/u/0/folders/{id}
  const folderMatch = u.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  // /file/d/{id}/view
  const fileMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  // ?id={id} or open?id={id}
  const idParam = u.searchParams.get('id');
  if (idParam) return idParam;

  return null;
}

const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-m4v',
];

const THUMB_SIZE_MAP: Record<string, number> = {
  w32h32: 32,
  w64h64: 64,
  w128h128: 128,
  w256h256: 256,
  w480h320: 480,
  w640h480: 640,
  w960h640: 960,
  w1024h768: 1024,
  w2048h1536: 2048,
};

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private drive: drive_v3.Drive;
  private auth: any;

  constructor() {
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
      this.logger.warn(
        'GOOGLE_SERVICE_ACCOUNT_JSON is not set — GDrive features will be unavailable',
      );
      return;
    }

    try {
      const credentials = JSON.parse(credentialsJson);
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
      this.drive = google.drive({ version: 'v3', auth: this.auth });
    } catch (e) {
      this.logger.error('Failed to initialize Google Drive service', e);
    }
  }

  isInitialized(): boolean {
    return !!this.drive;
  }

  private ensureInitialized() {
    if (!this.drive)
      throw new Error(
        'Google Drive service is not initialized (missing GOOGLE_SERVICE_ACCOUNT_JSON)',
      );
  }

  async listVideosFromFolder(folderId: string, maxItems = 500): Promise<GdriveVideo[]> {
    this.ensureInitialized();

    const mimeFilter = VIDEO_MIME_TYPES.map((m) => `mimeType = '${m}'`).join(' or ');
    const q = `'${folderId}' in parents and (${mimeFilter}) and trashed = false`;

    const videos: GdriveVideo[] = [];
    let pageToken: string | undefined;

    do {
      const res = await this.drive.files.list({
        q,
        fields: 'nextPageToken, files(id, name, mimeType)',
        pageSize: Math.min(maxItems - videos.length, 1000),
        pageToken,
      });

      for (const f of res.data.files ?? []) {
        if (videos.length >= maxItems) break;
        videos.push({ fileId: f.id!, name: f.name!, mimeType: f.mimeType! });
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && videos.length < maxItems);

    return videos;
  }

  async getVideoStreamUrl(fileId: string): Promise<string> {
    this.ensureInitialized();
    const client = await this.auth.getClient();
    const tokenRes = await client.getAccessToken();
    const token = tokenRes.token as string;
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${token}`;
  }

  async tryGetThumbnailBase64(
    fileId: string,
    sizeTag: ThumbSizeTag = 'w256h256',
  ): Promise<string | null> {
    this.ensureInitialized();
    try {
      const sz = THUMB_SIZE_MAP[sizeTag] ?? 256;
      const client = await this.auth.getClient();
      const tokenRes = await client.getAccessToken();
      const token = tokenRes.token as string;

      const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${sz}-h${sz}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return null;

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') ?? 'image/jpeg';
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  async tryGetThumbnailJpeg(
    fileId: string,
    sizeTag: ThumbSizeTag = 'w256h256',
  ): Promise<Buffer | null> {
    this.ensureInitialized();
    try {
      const sz = THUMB_SIZE_MAP[sizeTag] ?? 256;
      const client = await this.auth.getClient();
      const tokenRes = await client.getAccessToken();
      const token = tokenRes.token as string;

      const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${sz}-h${sz}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return null;

      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  async getFileInfo(
    fileId: string,
  ): Promise<{ fileId: string; name: string; mimeType: string } | null> {
    this.ensureInitialized();
    try {
      const res = await this.drive.files.get({ fileId, fields: 'id, name, mimeType' });
      const f = res.data;
      return { fileId: f.id!, name: f.name!, mimeType: f.mimeType! };
    } catch {
      return null;
    }
  }
}

export default GoogleDriveService;
