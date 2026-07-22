import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { XlsxImporter } from './xlsx-import';

const xlsxMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function createCampaignFile(rows: (string | null)[][]): Promise<Express.Multer.File> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Campaign');

  rows.forEach((row) => worksheet.addRow(row));

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return {
    fieldname: 'file',
    originalname: 'campaign.xlsx',
    encoding: '7bit',
    mimetype: xlsxMimeType,
    size: buffer.length,
    destination: '',
    filename: 'campaign.xlsx',
    path: '',
    buffer,
    stream: Readable.from(buffer),
  };
}

async function createCampaignFileWithLinkHeader(linkHeader: string): Promise<Express.Multer.File> {
  return createCampaignFile([
    ['Project:', 'Header aliases'],
    ['Platform', 'Brand name', 'Followers', linkHeader, 'Description:'],
    ['Instagram', 'test_brand', '1234', 'https://example.com/content', 'Test description'],
  ]);
}

describe('XlsxImporter campaign headers', () => {
  const importer = new XlsxImporter();

  it.each([
    'Video link',
    'Video link:',
    'Content link',
    'Content link:',
    'Track link',
    'Track link:',
    'TRACK LINK',
    '  Track   link:  ',
    'Track\nlink:',
    '\u00a0Track\u00a0link:\u00a0',
  ])('maps the "%s" header to videoLink', async (linkHeader) => {
    const file = await createCampaignFileWithLinkHeader(linkHeader);

    const result = await importer.importProposalCampaign(file);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].mainLink).toBe('https://example.com/content');
  });

  it('maps optional campaign columns when they are present', async () => {
    const file = await createCampaignFile([
      ['Project:', 'Optional columns'],
      ['Platform', 'Brand name', 'Followers', 'Track link:', 'Description:', 'Special request:'],
      [
        'TikTok',
        'test_brand',
        '1234',
        'https://example.com/content',
        'Test description',
        'No lyrics',
      ],
    ]);

    const result = await importer.importProposalCampaign(file);

    expect(result.pages[0]).toMatchObject({
      username: 'test_brand',
      mainLink: 'https://example.com/content',
      additionalBrief: 'No lyrics',
    });
  });

  it('recognizes a campaign table without optional columns', async () => {
    const file = await createCampaignFile([
      ['Project:', 'Required columns'],
      ['Brand name', 'Followers', 'Video link', 'Description'],
      ['test_brand', '1234', 'https://example.com/content', 'Test description'],
    ]);

    const result = await importer.importProposalCampaign(file);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].username).toBe('test_brand');
  });

  it('rejects a campaign table without a supported link column', async () => {
    const file = await createCampaignFile([
      ['Project:', 'Missing link'],
      ['Brand name', 'Followers', 'Description'],
      ['test_brand', '1234', 'Test description'],
    ]);

    await expect(importer.importProposalCampaign(file)).rejects.toEqual(
      new BadRequestException('Campaign table headers not found'),
    );
  });
});
