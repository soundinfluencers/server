// invoice that influencer will see on the invoices dashboard
export interface InvoiceForDashboard {
    invoiceId: string;
    shortInvoiceId: string;
    creationDate: string;
    paymentMethod: string;
    amount: number;
    status: string;
    campaignName?: string;
}

// enum for influencer's invoice status
export enum InvoiceStatusEnum {
    submitted = 'submitted',
    paid = 'paid',
    cancelled = 'cancelled',
}

// enum for invoice selected payment method
export enum InvoicePaymentMethodEnum {
    ukBankTransfer = 'ukBankTransfer',
    internationalBankTransfer = 'internationalBankTransfer',
    paypal = 'paypal',
}