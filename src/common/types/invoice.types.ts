// invoice that influencer will see on the invoices dashboard
import {Types} from "mongoose";

export interface InvoiceForDashboard {
    invoiceId: string;
    shortInvoiceId: string;
    creationDate: string;
    paymentMethod: string;
    amount: number;
    status: string;
    campaignName?: string;
}

// detailed invoice
export interface BaseDetailedInvoice {
    invoiceId: string;
    creationDate: string;
    amount: number;
    fullName: string;
    country: string;
    address: string;
    company?: string;
    vatNumber?: string;
}

// enum for influencer's invoice status
export enum InvoiceStatusEnum {
    wait = 'wait',
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

// client detailed invoice
export interface ClientDetailedInvoice extends BaseDetailedInvoice {
    campaignName: string;
    campaignFollowers: number;
    referenceNumber: string;
    poNumber?: string;
}

export interface IAdminClientInvoice {
    _id: Types.ObjectId;
    company: string;
    campaignName: string;
    createdAt: Date;
    amount: number;
    status: InvoiceStatusEnum;
}

export interface IAdminInfluencerInvoice {
    _id: Types.ObjectId;
    company: string;
    campaignName: string;
    createdAt: Date;
    amount: number;
    status: InvoiceStatusEnum;
}

// influencer detailed invoice
export interface InfluencerDetailedInvoice extends BaseDetailedInvoice {

}