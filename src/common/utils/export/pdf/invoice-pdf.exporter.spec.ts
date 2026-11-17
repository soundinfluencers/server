import type { ClientInvoiceDocument } from '../../../../database/schemas/invoices/user-invoice.schema';
import { InvoicePdfExporter } from './invoice-pdf.exporter';

describe('InvoicePdfExporter payment instructions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['true', false],
    ['false', true],
  ])('with CODEX_ISOLATED=%s includes live instructions: %s', (isolated, enabled) => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      CODEX_ISOLATED: isolated,
    });
    const invoice = { selectedPaymentMethod: 'bank_card' } as ClientInvoiceDocument;

    const html = InvoicePdfExporter['renderPaymentInfo'](invoice, true);

    expect(html.includes('Bank Transfer details:')).toBe(enabled);
    expect(html.includes('Payments are disabled in this test environment.')).toBe(!enabled);
  });
});
