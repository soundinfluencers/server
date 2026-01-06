// invoice that influencer will see on the invoices dashboard
export interface InvoiceForDashboard {
    shortInvoiceId: string;
    creationDate: string;
    paymentMethod: string;
    amount: number;
    status: string;
}