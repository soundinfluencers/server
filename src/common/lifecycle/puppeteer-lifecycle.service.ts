import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { InvoicePdfExporter } from '../utils/export/pdf/invoice-pdf.exporter';

@Injectable()
export class PuppeteerLifecycleService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await InvoicePdfExporter.shutdown();
  }
}
