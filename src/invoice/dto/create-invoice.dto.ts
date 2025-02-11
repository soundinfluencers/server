import { ApiProperty } from '@nestjs/swagger';

export class CreateInvoiceDtoDto {
  @ApiProperty({ required: true })
  influencerId: string;

  @ApiProperty({ required: true, default: 'pending' })
  status: string;

  @ApiProperty({ required: true })
  contactName: string;
  
  @ApiProperty({ required: true })
  contactLastName: string;

  @ApiProperty({ required: true })
  contactPhone: string;

  @ApiProperty({ required: true })
  contactEmail: string;

  @ApiProperty({ required: false })
  payee: string;

  @ApiProperty({ required: false })
  bankName: string;

  @ApiProperty({ required: false })
  bankBranchName: string;

  @ApiProperty({ required: false })
  bankCountry: string;

  @ApiProperty({ required: false })
  bankAccountCurrency: string;

  @ApiProperty({ required: false })
  sortCode: string;

  @ApiProperty({ required: false })
  accountNumber: string;

  @ApiProperty({ required: false })
  swiftOrBic: string;

  @ApiProperty({ required: false })
  companyName: string;

  @ApiProperty({ required: false })
  companyId: string;

  @ApiProperty({ required: false })
  street: string;

  @ApiProperty({ required: false })
  city: string;

  @ApiProperty({ required: false })
  state: string;

  @ApiProperty({ required: false })
  postcode: string;

  @ApiProperty({ required: false })
  country: string;

  @ApiProperty({ required: false })
  notes: string;

  @ApiProperty({ required: false })
  amount: number;

  @ApiProperty({ required: false })
  vat: string;

  @ApiProperty({ required: false })
  description: string;

  @ApiProperty({ required: true })
  selectedPaymentMethod: string;

  @ApiProperty({ required: false })
  poNumber?: string;
}
