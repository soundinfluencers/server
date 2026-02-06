import {
    InternationalBankTransferDetails, PayPalDetails,
    UKBankTransferDetails
} from "../../database/schemas/invoices/payment-details.schema";
import {
    InternationalBankTransferDto,
    PayPalDto,
    UKBankTransferDto
} from "../../modules/profile/dto/payment-details.dto";

// Map model UKBankTransferDetails to UKBankTransferDto
export const mapToUkBankTransferDto = (details: UKBankTransferDetails): UKBankTransferDto => {
    return {
        beneficiary: details.beneficiary,
        beneficiaryAddress: details.beneficiaryAddress,
        sortCode: details.sortCode,
        accountNumber: details.accountNumber
    }
}

// Map model InternationalBankTransferDetails to InternationalBankTransferDto
export const mapToInternationalBankTransferDto = (details: InternationalBankTransferDetails): InternationalBankTransferDto => {
    return {
        beneficiary: details.beneficiary,
        beneficiaryAddress: details.beneficiaryAddress,
        iban: details.iban,
        bankName: details.bankName,
        bankCountry: details.bankCountry,
        bankAccountCurrency: details.bankAccountCurrency,
        swiftBicCode: details.swiftBicCode
    }
}

// Map model PayPalDetails to PayPalDto
export const mapToPayPalDto = (details: PayPalDetails): PayPalDto => {
    return {
        paypalEmail: details.paypalEmail,
    }
}