import {InvoiceDetailsDto} from "../../modules/profile/dto/invoice-details.dto";
import {InvoiceDetails} from "../../database/schemas/invoices/invoice-details.schema";
import {CreateCampaignInvoiceDto, CreateInvoiceDto} from "../../modules/invoice/dto/create-invoice.dto";
import {UserInvoice} from "../../database/schemas/invoices/user-invoice.schema";
import {ObjId} from "../types/base.types";
import {Role} from "../types/auth.types";
import {InvoiceStatusEnum} from "../types/influencer/invoice.types";

export const mapToInvoiceDetailsDto = (data: InvoiceDetails): InvoiceDetailsDto => {
    return {
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        address: data.address ?? null,
        country: data.country ?? null,
        company: data.company ?? null,
        vatNumber: data.vatNumber ?? null,
    }
};

// map dto to ready-to-go model
export const mapToInvoiceModel = (data: CreateInvoiceDto | CreateCampaignInvoiceDto): UserInvoice => {
    const isInfluencerInvoice = data.userRole === Role.influencer;

    return {
        _id: new ObjId(),
        schemaVersion: 2,
        userId: new ObjId(data.userId),
        userRole: data.userRole,
        status: InvoiceStatusEnum.submitted,
        firstName: data.firstName,
        lastName: data.lastName,
        address: data.address,
        country: data.country,
        amount: data.amount,
        selectedPaymentMethod: data.selectedPaymentMethod,
        ...(isInfluencerInvoice && (data as CreateInvoiceDto).ukBankTransfer ? {
            ukBankTransfer: {
                ...(data as CreateInvoiceDto).ukBankTransfer,
                _id: new ObjId(),
                userId: new ObjId(data.userId),
                userRole: Role.influencer
            }
        } : {}),
        ...(isInfluencerInvoice && (data as CreateInvoiceDto).internationalBankTransfer ? {
            internationalBankTransfer: {
                ...(data as CreateInvoiceDto).internationalBankTransfer,
                _id: new ObjId(),
                userId: new ObjId(data.userId),
                userRole: Role.influencer
            }
        } : {}),
        ...(isInfluencerInvoice && (data as CreateInvoiceDto).paypal ? {
            paypal: {
                ...(data as CreateInvoiceDto).paypal,
                _id: new ObjId(),
                userId: new ObjId(data.userId),
                userRole: Role.influencer
            }
        } : {}),
        ...(data.company ? {company: data.company} : {}),
        ...(data.vatNumber ? {vatNumber: data.vatNumber} : {}),
        ...(!isInfluencerInvoice && (data as CreateCampaignInvoiceDto).campaignId ? {campaignId: new ObjId(data.campaignId)} : {}),
        ...(!isInfluencerInvoice && (data as CreateCampaignInvoiceDto).campaignName ? {campaignName: data.campaignName} : {}),
    } satisfies UserInvoice;
}