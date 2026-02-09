export type DropboxLinkKind = 'not_dropbox' | 'file' | 'folder' | 'unknown_dropbox';

export type ResolvedMedia =
    | { kind: 'direct'; videoUrl: string; posterUrl?: string | null; expiresInSec?: number }
    | { kind: 'folder'; items: Array<{ id: string; name: string; videoUrl: string; posterUrl?: string | null; expiresInSec: number }> }
    | { kind: 'unknown_dropbox'; url: string }
    | { kind: 'other'; url: string };
