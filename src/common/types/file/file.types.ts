export enum MediaProviderEnum {
    dropbox = 'dropbox',
    gdrive = 'gdrive',
    direct = 'direct',
}

export enum MediaKindEnum {
    file = 'file',
    folder = 'folder',
}

export type DropboxLinkKind = 'not_dropbox' | 'file' | 'folder' | 'unknown_dropbox';
