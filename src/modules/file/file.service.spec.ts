import { Test, TestingModule } from '@nestjs/testing';
import { FileService } from './file.service';
import DropboxService from '../../integrations/dropbox/dropbox';
import { MediaService } from '../media/media.service';

describe('FileService', () => {
  let service: FileService;
  let dropboxService: Record<string, jest.Mock>;
  let mediaService: Record<string, jest.Mock>;

  beforeEach(async () => {
    dropboxService = {
      uploadFile: jest.fn(),
      isFileUploaded: jest.fn(),
    };

    mediaService = {
      getCampaignPreviewJpeg: jest.fn(),
      getVideoRedirectUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: DropboxService, useValue: dropboxService },
        { provide: MediaService, useValue: mediaService },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadDropBox', () => {
    it('should call dropboxService.uploadFile', async () => {
      const file = { buffer: Buffer.from('data'), originalname: 'test.jpg' };
      dropboxService.uploadFile.mockResolvedValue('https://dropbox.com/test.jpg');

      const result = await service.uploadDropBox(file);

      expect(dropboxService.uploadFile).toHaveBeenCalledWith(file.buffer, file.originalname);
      expect(result).toBe('https://dropbox.com/test.jpg');
    });
  });

  describe('checkUploadStatus', () => {
    it('should call dropboxService.isFileUploaded', async () => {
      dropboxService.isFileUploaded.mockResolvedValue(true);

      const result = await service.checkUploadStatus('test.jpg');

      expect(dropboxService.isFileUploaded).toHaveBeenCalledWith('test.jpg');
      expect(result).toBe(true);
    });
  });
});
