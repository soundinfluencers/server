import {InvoiceDetailsDto} from "../../modules/profile/dto/invoice-details.dto";
import {InvoiceDetails} from "../../database/schemas/invoices/invoice-details.schema";
import {CreateCampaignInvoiceDto, CreateInvoiceDto} from "../../modules/invoice/dto/create-invoice.dto";
import {
    ClientInvoice,
    ClientInvoiceDocument, InfluencerInvoice,
    InfluencerInvoiceDocument, InfluencerInvoiceLinkedPromo,
    UserInvoice
} from "../../database/schemas/invoices/user-invoice.schema";
import {ObjId} from "../types/base.types";
import {Role} from "../types/user.types";
import {InvoiceStatusEnum} from "../types/influencer/invoice.types";
import {SelectInfluencerDto} from "../../modules/campaigns/dto/create-campaign.dto";
import {CampaignAccount} from "../../database/schemas/campaign/campaign.schema";

// Repository create client invoice input
export type CreateClientInvoiceDbShape = Omit<
    UserInvoice & ClientInvoice,
    'createdAt'
>;

// Repository create influencer invoice input
export type CreateInfluencerInvoiceDbShape = Omit<
    UserInvoice & InfluencerInvoice,
    'createdAt'
>;

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

// Maps create campaign invoice dto to repository create input
export const mapDtoToClientInvoice = (
    data: CreateCampaignInvoiceDto
): CreateClientInvoiceDbShape => {
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
        campaignId: new ObjId(data.campaignId),
        campaignName: data.campaignName,
        ...(data.company ? { company: data.company } : {}),
        ...(data.vatNumber ? { vatNumber: data.vatNumber } : {}),
    } satisfies CreateClientInvoiceDbShape;
};

// Maps promo to InfluencerInvoiceLinkedPromo
export const mapPromoToInvoiceLinkedPromo = (
    payload: (CampaignAccount & { campaignId: ObjId }),
): InfluencerInvoiceLinkedPromo => {
    return {
        campaignId: payload.campaignId,
        promoId: payload._id,
        reward: payload.price,
    } satisfies InfluencerInvoiceLinkedPromo;
};

// Maps promos array to InfluencerInvoiceLinkedPromo[]
export const mapPromosToInvoiceLinkedPromos = (
    payload: (CampaignAccount & { campaignId: ObjId })[],
): InfluencerInvoiceLinkedPromo[] => {
    return payload.map(mapPromoToInvoiceLinkedPromo) satisfies InfluencerInvoiceLinkedPromo[];
};

// Maps create influencer invoice dto to repository create input
export const mapDtoToInfluencerInvoice = (data: CreateInvoiceDto): CreateInfluencerInvoiceDbShape => {
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
        linkedPromos: data.linkedPromos,
        selectedPaymentMethod: data.selectedPaymentMethod,
        ...(data as CreateInvoiceDto).ukBankTransfer ? {
            ukBankTransfer: {
                ...(data as CreateInvoiceDto).ukBankTransfer,
                _id: new ObjId(),
                userId: new ObjId(data.userId),
                userRole: Role.influencer
            }
        } : {},
        ...(data as CreateInvoiceDto).internationalBankTransfer ? {
            internationalBankTransfer: {
                ...(data as CreateInvoiceDto).internationalBankTransfer,
                _id: new ObjId(),
                userId: new ObjId(data.userId),
                userRole: Role.influencer
            }
        } : {},
        ...(data as CreateInvoiceDto).paypal ? {
            paypal: {
                ...(data as CreateInvoiceDto).paypal,
                _id: new ObjId(),
                userId: new ObjId(data.userId),
                userRole: Role.influencer
            }
        } : {},
        ...(data.company ? {company: data.company} : {}),
        ...(data.vatNumber ? {vatNumber: data.vatNumber} : {}),
    } satisfies CreateInfluencerInvoiceDbShape;
}