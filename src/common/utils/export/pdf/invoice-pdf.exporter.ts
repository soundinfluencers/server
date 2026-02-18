import puppeteer, {Browser, Page} from "puppeteer";
import { UserInvoice } from "../../../../database/schemas/invoices/user-invoice.schema";
import {Role} from "../../../types/auth.types";
const fs = require("fs");
const path = require("path");

export class InvoicePdfBuilderExtraInfoDto {
    brandName?: string;
    campaignName?: string;
    poNumber?: string;
    reach?: string;
}

export class InvoicePdfExporter {
    // ---------- config ----------
    private static readonly MAX_CONCURRENCY = Number(process.env.PDF_CONCURRENCY ?? 2);
    private static readonly PDF_TIMEOUT_MS = Number(process.env.PDF_TIMEOUT_MS ?? 30_000);

    // ---------- font cache ----------
    private static fontFaceCss: string | null = null;

    // ---------- browser singleton ----------
    private static browser: Browser | null = null;
    private static browserLaunching: Promise<Browser> | null = null;

    // ---------- simple queue ----------
    private static active = 0;
    private static queue: Array<() => void> = [];

    static async buildPdfBuffer(
        invoice: UserInvoice,
        extraInfo?: InvoicePdfBuilderExtraInfoDto,
    ): Promise<Buffer> {
        await this.acquire();

        try {
            const html = this.buildHtml(invoice, extraInfo);

            const browser = await this.getBrowser();
            const page = await browser.newPage();

            try {
                await this.hardenPage(page);

                await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 0 });

                // ждать шрифты
                await page.evaluate(async () => {
                    if (document.fonts && document.fonts.ready) {
                        await document.fonts.ready;
                    }
                });

                // небольшой reflow buffer
                await new Promise(resolve => setTimeout(resolve, 25));

                // pdf с таймаутом-охранником
                const pdfUint8 = await this.withTimeout(
                    page.pdf({
                        format: "A4",
                        printBackground: true,
                        margin: { top: "14mm", right: "10mm", bottom: "14mm", left: "10mm" },
                        preferCSSPageSize: true,
                    }),
                    this.PDF_TIMEOUT_MS,
                    "PDF generation timed out",
                );

                return Buffer.from(pdfUint8);
            } catch (err) {
                if (this.isLikelyBrowserCrash(err)) {
                    await this.resetBrowser();
                }
                throw err;
            } finally {
                await page.close().catch(() => undefined);
            }
        } finally {
            this.release();
        }
    }

    // -------------------- hardening --------------------

    private static async hardenPage(page: Page) {
        // разумные таймауты
        page.setDefaultNavigationTimeout(this.PDF_TIMEOUT_MS);
        page.setDefaultTimeout(this.PDF_TIMEOUT_MS);

        await page.setCacheEnabled(false).catch(() => undefined);

        await page.setRequestInterception(true).catch(() => undefined);
        page.on("request", (req) => {
            const url = req.url();

            if (url.startsWith("data:") || url.startsWith("about:")) return req.continue();

            if (url.startsWith("blob:")) return req.continue();

            return req.abort();
        });

        page.on("requestfailed", (r) => {
            console.log("[invoice-pdf] requestfailed", r.url(), r.failure()?.errorText);
        });
        page.on("pageerror", (_e) => {
            console.log("[invoice-pdf] pageerror", _e);
        });
    }

    private static withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
        let t: NodeJS.Timeout | null = null;
        const timeout = new Promise<T>((_, reject) => {
            t = setTimeout(() => reject(new Error(message)), ms);
        });
        return Promise.race([p, timeout]).finally(() => {
            if (t) clearTimeout(t);
        }) as Promise<T>;
    }

    private static isLikelyBrowserCrash(err: any) {
        const msg = String(err?.message ?? err);
        return (
            msg.includes("Target closed") ||
            msg.includes("Session closed") ||
            msg.includes("Browser has disconnected") ||
            msg.includes("Protocol error") ||
            msg.includes("Execution context was destroyed")
        );
    }

    // -------------------- queue --------------------

    private static acquire(): Promise<void> {
        if (this.active < this.MAX_CONCURRENCY) {
            this.active++;
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.queue.push(() => {
                this.active++;
                resolve();
            });
        });
    }

    private static release() {
        this.active = Math.max(0, this.active - 1);
        const next = this.queue.shift();
        if (next) next();
    }

    // -------------------- browser singleton --------------------

    private static async getBrowser(): Promise<Browser> {
        if (this.browser) return this.browser;

        if (!this.browserLaunching) {
            this.browserLaunching = (async () => {
                const b = await puppeteer.launch({
                    headless: true,
                    executablePath: "/snap/bin/chromium",
                    args: [
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--no-zygote",
                        "--no-first-run",
                        "--no-default-browser-check",
                        "--disable-background-networking",
                        "--disable-features=Translate,BackForwardCache",
                        "--font-render-hinting=medium",
                    ],
                });

                b.on("disconnected", () => {
                    this.browser = null;
                    this.browserLaunching = null;
                });

                this.browser = b;
                return b;
            })().finally(() => {
                this.browserLaunching = null;
            });
        }

        return this.browserLaunching;
    }

    private static async resetBrowser() {
        const b = this.browser;
        this.browser = null;
        this.browserLaunching = null;
        if (b) {
            await b.close().catch(() => undefined);
        }
    }

    // -------------------- fonts --------------------

    private static getFontFace() {
        if (this.fontFaceCss) return this.fontFaceCss;

        const load = (file: string) => {
            const p = path.resolve(__dirname, "../../../../../assets/fonts", file);
            return fs.readFileSync(p).toString("base64");
        };

        this.fontFaceCss = `
@font-face {
  font-family: 'Satoshi';
  src: url(data:font/woff2;base64,${load("Satoshi-Regular.woff2")}) format('woff2');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Satoshi';
  src: url(data:font/woff2;base64,${load("Satoshi-Medium.woff2")}) format('woff2');
  font-weight: 500;
  font-style: normal;
}
@font-face {
  font-family: 'Satoshi';
  src: url(data:font/woff2;base64,${load("Satoshi-Bold.woff2")}) format('woff2');
  font-weight: 700;
  font-style: normal;
}
`;
        return this.fontFaceCss;
    }

    private static buildHtml(invoice: UserInvoice, extraInfo?: InvoicePdfBuilderExtraInfoDto) {
        const isClientInvoice = invoice.userRole === Role.client;

        const invoiceDate = this.formatDate(
            (invoice as any)?.createdAt ?? (invoice as any)?.updatedAt ?? new Date(),
        );

        const invoiceNo = this.getInvoiceNo(invoice);

        const OUR = {
            name: "Techno TV Ltd",
            addressLines: ["124 City Road", "London, EC1V 2NX", "United Kingdom"],
            companyNo: '10458319',
            email: undefined as string | undefined,
            phone: undefined as string | undefined,
        };

        const counterpartyName = this.safeCompanyOrPerson(invoice);
        const counterpartyAddressLines = this.splitAddress(invoice.address, invoice.country);
        const counterpartyVat = invoice.vatNumber ?? null;

        const fromBlock = !isClientInvoice
            ? {
                title: "From:",
                name: counterpartyName,
                lines: counterpartyAddressLines,
                metaLines: [
                    counterpartyVat ? `VAT: ${this.escapeHtml(counterpartyVat)}` : null,
                ].filter(Boolean) as string[],
            }
            : {
                title: "From:",
                name: OUR.name,
                lines: OUR.addressLines,
                metaLines: [
                    OUR.companyNo ? `Company No: ${this.escapeHtml(OUR.companyNo)}` : null,
                ].filter(Boolean) as string[],
            };

        const toBlock = !isClientInvoice
            ? {
                title: "To:",
                name: OUR.name,
                lines: OUR.addressLines,
                metaLines: [
                    OUR.companyNo ? `Company No: ${this.escapeHtml(OUR.companyNo)}` : null,
                ].filter(Boolean) as string[],
            }
            : {
                title: "To:",
                name: counterpartyName,
                lines: counterpartyAddressLines,
                metaLines: [
                    counterpartyVat ? `VAT: ${this.escapeHtml(counterpartyVat)}` : null,
                ].filter(Boolean) as string[],
            };

        const amountStr = this.formatMoneyEUR(invoice.amount);

        const campaignName = extraInfo?.campaignName ?? invoice.campaignName ?? (invoice.campaignId ? "Campaign" : "Influencer Marketing Campaign");
        const brandName = extraInfo?.brandName ?? "—";
        const poNumber = extraInfo?.poNumber ?? "—";
        const reach = extraInfo?.reach ?? "—";

        const paymentHtml = this.renderPaymentInfo(invoice, isClientInvoice);

        const logoSvg = this.getLogoSvg();

        const tableHtml = isClientInvoice
            ? `
          <div class="table__head table__row">
            <div class="cell">Item Description</div>
            <div class="cell">Brand</div>
            <div class="cell">Project</div>
            <div class="cell">PO</div>
            <div class="cell">Reach</div>
            <div class="cell right">Total</div>
          </div>
          <div class="table__row">
            <div class="cell">${this.escapeHtml("Influencer Marketing Campaign")}</div>
            <div class="cell">${this.escapeHtml(brandName)}</div>
            <div class="cell">${this.escapeHtml(campaignName)}</div>
            <div class="cell">${this.escapeHtml(poNumber)}</div>
            <div class="cell">${this.escapeHtml(reach)}</div>
            <div class="cell right">${this.escapeHtml(amountStr)}</div>
          </div>
          <div class="table__footer">
            <div class="table__total">
              <span>Total:</span>
              <span class="strong">${this.escapeHtml(amountStr)}</span>
            </div>
          </div>
      `
            : `
          <div class="table__head table__row">
            <div class="cell">Item Description</div>
            <div class="cell">Page</div>
            <div class="cell right">Total</div>
          </div>
          <div class="table__row">
            <div class="cell">${this.escapeHtml("Influencer Marketing Campaign")}</div>
            <div class="cell"></div>
            <div class="cell right">${this.escapeHtml(amountStr)}</div>
          </div>
          <div class="table__footer">
            <div class="table__total">
              <span>Total:</span>
              <span class="strong">${this.escapeHtml(amountStr)}</span>
            </div>
          </div>
      `;

        const paymentHint = isClientInvoice
            ? "Please make payment via bank transfer to:"
            : null;

        return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Invoice</title>
  <style>
  ${this.getFontFace()}
    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      font-family: 'Satoshi', Arial, sans-serif;
      color:#0f172a;
      background: linear-gradient(180deg, #ffffff 0%, #ffffff 58%, #f3f6ff 100%);
    }
    .page{
      width: 100%;
      margin: 0 auto;
      padding: 8mm 6mm;
    }

    .brand{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      margin: 0 0 22px 0;
    }
    .brand__name{
      font-weight:700;
      font-size:22px;
      letter-spacing:0.2px;
    }

    .headerRow{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      margin-top:6px;
      margin-bottom: 16px;
    }
    .invoiceTitle{
      display:flex;
      align-items:baseline;
      gap:10px;
    }
    .invoiceTitle .h1{
      font-size:20px;
      font-weight:600;
      letter-spacing:0.2px;
    }
    .invoiceTitle .no{
      font-size:10px;
      color: black;
    }
    .date{
      font-size:11px;
      color: black;
      margin-top:4px;
    }

    .parties{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap: 26px;
      margin-top: 8px;
      margin-bottom: 18px;
    }
    .party .label{
      font-size:13px;
      color: black;
      margin-bottom:6px;
    }
    .party .name{
      font-size:12px;
      font-weight:600;
      margin-bottom:4px;
    }
    .party .line{
      font-size:10px;
      color: black;
      line-height:1.35;
    }
    .party .meta{
      font-size:10px;
      color: black;
      margin-top:8px;
      line-height:1.35;
    }

    .balance{
      border:1px solid #cfe0ff;
      border-radius:10px;
      padding:14px 16px;
      display:flex;
      justify-content:space-between;
      align-items:flex-end;
      background:rgba(255,255,255,0.6);
      margin: 40px 0 20px 0;
    }
    .balance .left .small{
      font-size:12px;
      color: black;
      margin-bottom:6px;
    }
    .balance .left .label{
      font-size:12px;
      color: black;
    }
    .balance .right{
      text-align:right;
    }
    .balance .right .due{
      font-size:14px;
      color: black;
      font-weight:500;
      letter-spacing:0.3px;
    }
    .balance .right .term{
      font-size:10px;
      color: black;
      margin-top:2px;
    }
    .balance .right .amount{
      margin-top:10px;
      font-size:24px;
      font-weight:600;
      letter-spacing:0.2px;
    }

    .table{
      border:1px solid #cfe0ff;
      border-radius:10px;
      overflow:hidden;
      background:rgba(255,255,255,0.6);
      margin-bottom: 22px;
    }
    .table__row{
      display:grid;
      padding:24px 12px;
      align-items:center;
      gap:10px;
      border-top:1px solid #e6eeff;
      font-size:12px;
      color:#0f172a;
    }
    .table__head{
      border-top:none;
      font-size:10px;
      color: black;
      background: rgba(255,255,255,0.35);
    }
    .table__footer{
      padding:10px 12px;
      border-top:1px solid #e6eeff;
      background: rgba(255,255,255,0.35);
    }
    .table__total{
      display:flex;
      justify-content:flex-end;
      gap:10px;
      font-size:12px;
      font-weight:500;
      color: black;
    }
    .table__total .strong{
      color:#0f172a;
      min-width: 90px;
      text-align:right;
    }
    .cell{white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
    .right{text-align:right;}
    .strong{font-weight:700; color:#0f172a;}

    .table.client .table__row{ grid-template-columns: 2.3fr 0.9fr 1.3fr 0.8fr 0.7fr 0.9fr; }
    .table.influencer .table__row{ grid-template-columns: 2.7fr 1.2fr 1fr; }

    .sectionTitle{
      font-size:13px;
      font-weight:500;
      margin-bottom:8px;
    }
    .hint{
      font-size:11px;
      color: black;
      margin-top:-2px;
      margin-bottom:8px;
    }
    .payment{
      font-size:11px;
      color: black;
      line-height:1.5;
    }
    .payment .kv{ display:flex; gap:8px; }
    .payment .k{ min-width: 140px; color:#0f172a; font-weight:400;}
    .payment .v{ color: black; }
    .footerSpace{height:6mm;}
  </style>
</head>
<body>
  <div class="page">
    <div class="brand">
      ${logoSvg}
      <div class="brand__name">SoundInfluencers</div>
    </div>

    <div class="headerRow">
      <div class="invoiceTitle">
        <div class="h1">INVOICE</div>
        <div class="no">No. ${this.escapeHtml(invoiceNo)}</div>
      </div>
      <div class="date">${this.escapeHtml(invoiceDate)}</div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="label">${this.escapeHtml(fromBlock.title)}</div>
        <div class="name">${this.escapeHtml(fromBlock.name)}</div>
        ${fromBlock.lines.map(l => `<div class="line">${this.escapeHtml(l)}</div>`).join("")}
        ${fromBlock.metaLines.length ? `<div class="meta">${fromBlock.metaLines.join("<br/>")}</div>` : ""}
      </div>

      <div class="party" style="text-align:right">
        <div class="label">${this.escapeHtml(toBlock.title)}</div>
        <div class="name">${this.escapeHtml(toBlock.name)}</div>
        ${toBlock.lines.map(l => `<div class="line">${this.escapeHtml(l)}</div>`).join("")}
        ${toBlock.metaLines.length ? `<div class="meta">${toBlock.metaLines.join("<br/>")}</div>` : ""}
      </div>
    </div>

    <div class="balance">
      <div class="left">
        <div class="small"> </div>
        <div class="label">Total Due:</div>
      </div>
      <div class="right">
        <div class="due">BALANCE DUE</div>
        <div class="term">Upon Receipt</div>
        <div class="amount">${this.escapeHtml(amountStr)}</div>
      </div>
    </div>

    <div class="table ${isClientInvoice ? "client" : "influencer"}">
      ${tableHtml}
    </div>

    <div class="sectionTitle">Payment Information</div>
    ${paymentHint ? `<div class="hint">${this.escapeHtml(paymentHint)}</div>` : ""}
    <div class="payment">
      ${paymentHtml}
    </div>

    <div class="footerSpace"></div>
  </div>
</body>
</html>`;
    }

    // ---------------- helpers ----------------

    private static renderPaymentInfo(invoice: UserInvoice, isClientInvoice: boolean) {
        const method = invoice.selectedPaymentMethod as any;

        if (isClientInvoice) {
            switch (method) {

                case 'bank_card': {
                    return `
        <div class="kv"><div class="k">Go to:</div><div class="v">https://revolut.me/technotvltd</div></div>
        <div class="kv"><div class="k">Currency:</div><div class="v">EUR</div></div>
        <div class="kv"><div class="k">Reference:</div><div class="v">C935872</div></div>
        <div class="kv"><div class="k">Instructions:</div>
            <div class="v">
                1. Enter amount shown above<br/>
                2. In "NOTE" section enter reference: C935872<br/>
                3. Click "Pay"<br/>
                4. Pay by card<br/>
                5. Add reference again if requested
            </div>
        </div>
        `;
                }

                case 'paypal': {
                    return `
        <div class="kv"><div class="k">Total Due:</div><div class="v">96€</div></div>
        <div class="kv"><div class="k">Reference ID:</div><div class="v">P935872</div></div>
        <div class="kv"><div class="k">Send funds to:</div><div class="v">technotvchannel@gmail.com</div></div>
        <div class="kv"><div class="k">Note:</div>
            <div class="v">
                Enter reference in "NOTE" section.<br/>
                If possible, send as "Friends & Family".
            </div>
        </div>
        `;
                }

                case 'bank_transfer_uk': {
                    return `
        <div class="kv"><div class="k">Total Due:</div><div class="v">96€</div></div>
        <div class="kv"><div class="k">Beneficiary:</div><div class="v">Techno TV LTD</div></div>
        <div class="kv"><div class="k">Beneficiary address:</div><div class="v">124 City Road, EC1V 2NX, London, United Kingdom</div></div>
        <div class="kv"><div class="k">Account number:</div><div class="v">17299128</div></div>
        <div class="kv"><div class="k">Sort code:</div><div class="v">04-00-75</div></div>
        <div class="kv"><div class="k">Payment method:</div><div class="v">Revolut Ltd</div></div>
        <div class="kv"><div class="k">Bank address:</div><div class="v">7 Westferry Circus, E14 4HD, London, United Kingdom</div></div>
        <div class="kv"><div class="k">Reference ID:</div><div class="v">935872</div></div>
        <div class="kv"><div class="k">Note:</div><div class="v">If possible, send payment as "Friends & Family".</div></div>
        `;
                }

                case 'bank_transfer_eu': {
                    return `
        <div class="kv"><div class="k">Total Due:</div><div class="v">96€</div></div>
        <div class="kv"><div class="k">Beneficiary:</div><div class="v">Techno TV LTD</div></div>
        <div class="kv"><div class="k">Beneficiary address:</div><div class="v">124 City Road, EC1V 2NX, London, United Kingdom</div></div>
        <div class="kv"><div class="k">IBAN:</div><div class="v">GB91REVO00997094280983</div></div>
        <div class="kv"><div class="k">BIC:</div><div class="v">REVOGB21</div></div>
        <div class="kv"><div class="k">Payment method:</div><div class="v">Revolut Ltd</div></div>
        <div class="kv"><div class="k">Bank address:</div><div class="v">7 Westferry Circus, E14 4HD, London, United Kingdom</div></div>
        <div class="kv"><div class="k">Reference ID:</div><div class="v">935872</div></div>
        `;
                }

                case 'bank_transfer_international': {
                    return `
        <div class="kv"><div class="k">Beneficiary:</div><div class="v">Techno TV LTD</div></div>
        <div class="kv"><div class="k">Beneficiary address:</div><div class="v">124 City Road, EC1V 2NX, London, United Kingdom</div></div>
        <div class="kv"><div class="k">IBAN:</div><div class="v">GB91REVO00997094280983</div></div>
        <div class="kv"><div class="k">BIC:</div><div class="v">REVOGB21</div></div>
        <div class="kv"><div class="k">Intermediary BIC:</div><div class="v">CHASDEFX</div></div>
        <div class="kv"><div class="k">Payment method:</div><div class="v">Revolut Ltd</div></div>
        <div class="kv"><div class="k">Bank address:</div><div class="v">7 Westferry Circus, E14 4HD, London, United Kingdom</div></div>
        <div class="kv"><div class="k">Reference:</div><div class="v">935872</div></div>
        `;
                }

                case 'crypto': {
                    return `
        <div class="kv"><div class="k">Payment method:</div><div class="v">Crypto</div></div>
        <div class="kv"><div class="k">Note:</div><div class="v">Wallet details will be provided separately.</div></div>
        `;
                }

                default: {
                    return `<div class="v">Payment method: ${this.escapeHtml(String(method))}</div>`;
                }
            }
        }

        // ---------- INFLUENCER INVOICE ----------
        // Мы платим ИНФЛЮЕНСЕРУ. Тут реквизиты берём из invoice.ukBankTransfer / invoice.international... / invoice.paypal.
        switch (method) {
            // influencer enums
            case 'paypal': {
                if (!invoice.paypal?.paypalEmail) return `<div class="v">PayPal email not provided.</div>`;
                return `
              <div class="kv"><div class="k">PayPal:</div><div class="v">${this.escapeHtml(invoice.paypal.paypalEmail)}</div></div>
            `;
            }

            case 'ukBankTransfer':
            case 'bank_transfer_uk': // на всякий, если где-то придёт так
            {
                const d = invoice.ukBankTransfer;
                if (!d) return `<div class="v">UK bank transfer details not provided.</div>`;
                return `
              <div class="kv"><div class="k">Bank transfer:</div><div class="v"></div></div>
              <div class="kv"><div class="k">Beneficiary:</div><div class="v">${this.escapeHtml(d.beneficiary)}</div></div>
              <div class="kv"><div class="k">Beneficiary address:</div><div class="v">${this.escapeHtml(d.beneficiaryAddress)}</div></div>
              <div class="kv"><div class="k">Sort code:</div><div class="v">${this.escapeHtml(d.sortCode)}</div></div>
              <div class="kv"><div class="k">Account number:</div><div class="v">${this.escapeHtml(d.accountNumber)}</div></div>
            `;
            }

            case 'internationalBankTransfer':
            case 'bank_transfer_international':
            case 'bank_transfer_eu': {
                const d = invoice.internationalBankTransfer;
                if (!d) return `<div class="v">International bank transfer details not provided.</div>`;
                return `
              <div class="kv"><div class="k">Bank transfer:</div><div class="v"></div></div>
              <div class="kv"><div class="k">Beneficiary:</div><div class="v">${this.escapeHtml(d.beneficiary)}</div></div>
              <div class="kv"><div class="k">Beneficiary address:</div><div class="v">${this.escapeHtml(d.beneficiaryAddress)}</div></div>
              <div class="kv"><div class="k">IBAN:</div><div class="v">${this.escapeHtml(d.iban)}</div></div>
              <div class="kv"><div class="k">Bank Name:</div><div class="v">${this.escapeHtml(d.bankName)}</div></div>
              <div class="kv"><div class="k">Bank country:</div><div class="v">${this.escapeHtml(d.bankCountry)}</div></div>
              <div class="kv"><div class="k">Bank account currency:</div><div class="v">${this.escapeHtml(d.bankAccountCurrency)}</div></div>
              <div class="kv"><div class="k">SWIFT/BIC:</div><div class="v">${this.escapeHtml(d.swiftBicCode)}</div></div>
            `;
            }

            default:
                return `<div class="v">Payment method: ${this.escapeHtml(String(method))}</div>`;
        }
    }

    private static safeCompanyOrPerson(i: UserInvoice) {
        const fullName = `${i.firstName ?? ""} ${i.lastName ?? ""}`.trim();
        return (i.company && i.company.trim()) ? i.company.trim() : (fullName || "—");
    }

    private static splitAddress(address: string, country: string) {
        const lines = (address ?? "")
            .split(/\r?\n|,/g)
            .map(s => s.trim())
            .filter(Boolean);

        const out = [...lines];

        const c = (country ?? "").trim();
        if (c) {
            const hasCountry = out.some(l => l.toLowerCase() === c.toLowerCase());
            if (!hasCountry) out.push(c);
        }

        return out.length ? out : ["—"];
    }

    private static getInvoiceNo(invoice: UserInvoice) {
        const anyInv = invoice as any;
        if (anyInv?.invoiceNo) return String(anyInv.invoiceNo);

        const id = (invoice as any)?._id ? String((invoice as any)._id) : "";
        const tail = id.slice(-4);
        return tail || "—";
    }

    private static formatMoneyEUR(amount: number) {
        const n = Number(amount ?? 0);
        const formatted = new Intl.NumberFormat("de-DE", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(n);

        return formatted.replace(/\s€$/, "€");
    }

    private static formatDate(d: Date | string | number) {
        const dt = new Date(d);
        const day = dt.getDate();
        const month = dt.toLocaleString("en-US", { month: "long" });
        const year = dt.getFullYear();
        return `${day} ${month}, ${year}`;
    }

    private static escapeHtml(input: any) {
        const s = String(input ?? "");
        return s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private static getLogoSvg() {
        return `<svg width="22" height="24" viewBox="0 0 22 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2.31579 21.7143C1.04211 21.7143 0 20.6897 0 19.4375V4.5625C0 3.31027 1.04211 2.28571 2.31579 2.28571C3.58947 2.28571 4.63158 3.31027 4.63158 4.5625V19.4375C4.63158 20.6518 3.58947 21.7143 2.31579 21.7143Z" fill="#B9D0FF"/>
<path d="M8.10526 24C6.83158 24 5.78947 23.054 5.78947 21.8978V2.10219C5.78947 0.945985 6.83158 0 8.10526 0C9.37895 0 10.4211 0.945985 10.4211 2.10219V21.8978C10.4211 23.054 9.37895 24 8.10526 24Z" fill="#B9D0FF"/>
<path d="M13.8947 17.7143C12.6211 17.7143 11.5789 16.75 11.5789 15.5714V8.42857C11.5789 7.25 12.6211 6.28571 13.8947 6.28571C15.1684 6.28571 16.2105 7.25 16.2105 8.42857V15.5714C16.2105 16.75 15.1684 17.7143 13.8947 17.7143Z" fill="#B9D0FF"/>
<path d="M19.6842 14.8571C18.4105 14.8571 17.3684 13.8487 17.3684 12.6162V11.3838C17.3684 10.1513 18.4105 9.14286 19.6842 9.14286C20.9579 9.14286 22 10.1513 22 11.3838V12.6162C22 13.8487 20.9579 14.8571 19.6842 14.8571Z" fill="#B9D0FF"/>
</svg>
    `;
    }
}
