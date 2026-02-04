import {InvoiceDetailsDto} from "../../modules/profile/dto/invoice-details.dto";
import {InvoiceDetails} from "../../database/schemas/invoices/invoice-details.schema";

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