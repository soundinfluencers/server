import {Global, Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";
import {Influencer, InfluencerSchema} from "./schemas/users/influencer.schema";
import {Client, ClientSchema} from "./schemas/users/client.schema";
import {InfluencerRepository} from "./repositories/users/influencer.repository";
import {ClientRepository} from "./repositories/users/client.repository";
import {VerifyInfluencer, VerifyInfluencerSchema} from "./schemas/verify-users/verifyInfluencer.schema";
import {VerifyClient, VerifyClientSchema} from "./schemas/verify-users/verifyClient.schema";
import {VerifyClientRepository} from "./repositories/verify-users/verify-client.repository";
import {VerifyInfluencerRepository} from "./repositories/verify-users/verify-influencer.repository";
import {
    InfluencerActionsHistory,
    InfluencerActionsHistorySchema
} from "./schemas/histories/influencer-actions-history.schema";
import {InfluencerHistoryRepository} from "./repositories/histories/influencer-history.repository";
import {Campaign, CampaignSchema} from "./schemas/campaign/campaign.schema";
import {CompletedCampaign, CompletedCampaignSchema} from "./schemas/campaign/completed-campaign.schema";
import {CampaignRepository} from "./repositories/campaigns/campaign.repository";
import {CompletedCampaignRepository} from "./repositories/campaigns/completed-campaign.repository";
import {ProposalCampaign, ProposalCampaignSchema} from "./schemas/campaign/proposal-campaign.schema";
import {ProposalCampaignRepository} from "./repositories/campaigns/proposal-campaign.repository";
import {Admin, AdminSchema} from "./schemas/users/admin.schema";
import {AdminRepository} from "./repositories/users/admin.repository";
import {
    ClientInvoiceSchema, InfluencerInvoiceSchema,
    UserInvoice,
    UserInvoiceSchema
} from "./schemas/invoices/user-invoice.schema";
import {ReportSizes, ReportSizesSchema} from "./schemas/report-size/reports-sizes.schema";
import {ReportSizeRepository} from "./repositories/report-size/report-size.repository";
import {DraftCampaign, DraftCampaignSchema} from "./schemas/campaign/draft-campaign.schema";
import {DraftCampaignRepository} from "./repositories/campaigns/draft-campaign.repository";
import {InvoiceDetails, InvoiceDetailsSchema} from "./schemas/invoices/invoice-details.schema";
import {InvoiceDetailsRepository} from "./repositories/invoices/invoice-details.repository";
import {ProposalCampaignOption, ProposalCampaignOptionSchema} from "./schemas/campaign/proposal-campaign-option.schema";
import {ProposalCampaignOptionRepository} from "./repositories/campaigns/proposal-campaign-option.repository";
import {
    InternationalBankTransferDetails, InternationalBankTransferDetailsSchema, PayPalDetails, PayPalDetailsSchema,
    UKBankTransferDetails,
    UKBankTransferDetailsSchema
} from "./schemas/invoices/payment-details.schema";
import {UkBankTransferDetailsRepository} from "./repositories/invoices/uk-transfer-details.repository";
import {
    InternationalBankTransferDetailsRepository
} from "./repositories/invoices/international-transfer-details.repository";
import {PaypalDetailsRepository} from "./repositories/invoices/paypal-details.repository";
import {
    BespokeCampaignRequest,
    BespokeCampaignRequestSchema, EventBespokeCampaignFieldsSchema,
    MusicBespokeCampaignFieldsSchema
} from "./schemas/campaign/bespoke-campaign.schema";
import {BespokeRequestCategory} from "../common/types/client/campaign.types";
import {BespokeCampaignRepository} from "./repositories/campaigns/bespoke-campaign.repository";
import { Schema as MongooseSchema } from 'mongoose';
import {UserInvoiceRepository} from "./repositories/invoices/user-invoice.repository";
import {
    Negotiation,
    NegotiationOffer,
    NegotiationOfferSchema,
    NegotiationSchema
} from "./schemas/negotiation/negotiation.schema";
import {NegotiationRepository} from "./repositories/negotiation/negotiation.repository";
import {Role} from "../common/types/user.types";
import {PaymentHistoryCell, PaymentHistoryCellSchema} from "./schemas/histories/payment-history-cell.schema";
import {PaymentHistoryCellRepository} from "./repositories/histories/payment-history-cell.repository";
import {Offer, OfferSchema} from "./schemas/offer/offer.schema";
import {OfferAccountLink, OfferAccountLinkSchema} from "./schemas/offer/offer-account-link.schema";
import {OfferRepository} from "./repositories/offers/offer.repository";
import {OfferAccountLinkRepository} from "./repositories/offers/offer-account-link.repository";
import {AuthSession, AuthSessionSchema} from "./schemas/auth/auth-session.schema";
import {AuthSessionRepository} from "./repositories/auth/auth-session.repository";
import {RequestForAdminType} from "../common/types/request-for-admin/request-for-admin.types";
import {NewClientAdminRequestSchema} from "./schemas/requests/new-client-request.schema";
import {RequestForAdmin, RequestForAdminSchema} from "./schemas/requests/request-for-admin.schema";
import {RequestForAdminRepository} from "./repositories/requests/request-for-admin.repository";

@Global()
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Influencer.name, schema: InfluencerSchema },
            { name: Client.name, schema: ClientSchema },
            { name: Admin.name, schema: AdminSchema },
            { name: VerifyInfluencer.name, schema: VerifyInfluencerSchema },
            { name: VerifyClient.name, schema: VerifyClientSchema },
            { name: InfluencerActionsHistory.name, schema: InfluencerActionsHistorySchema },
            { name: Campaign.name, schema: CampaignSchema },
            { name: DraftCampaign.name, schema: DraftCampaignSchema },
            { name: CompletedCampaign.name, schema: CompletedCampaignSchema },
            { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
            { name: ProposalCampaignOption.name, schema: ProposalCampaignOptionSchema },
            { name: UserInvoice.name, schema: UserInvoiceSchema },
            { name: InvoiceDetails.name, schema: InvoiceDetailsSchema },
            { name: UKBankTransferDetails.name, schema: UKBankTransferDetailsSchema },
            { name: InternationalBankTransferDetails.name, schema: InternationalBankTransferDetailsSchema },
            { name: PayPalDetails.name, schema: PayPalDetailsSchema },
            { name: ReportSizes.name, schema: ReportSizesSchema },
            { name: Negotiation.name, schema: NegotiationSchema },
            { name: NegotiationOffer.name, schema: NegotiationOfferSchema },
            { name: PaymentHistoryCell.name, schema: PaymentHistoryCellSchema },
            { name: Offer.name, schema: OfferSchema },
            { name: OfferAccountLink.name, schema: OfferAccountLinkSchema },
            { name: AuthSession.name, schema: AuthSessionSchema },
            {
                name: UserInvoice.name,
                schema: UserInvoiceSchema,
                discriminators: [
                    { name: Role.client, schema: ClientInvoiceSchema },
                    { name: Role.influencer, schema: InfluencerInvoiceSchema },
                ],
            },
            {
                name: RequestForAdmin.name,
                schema: RequestForAdminSchema,
                discriminators: [
                    {
                        name: RequestForAdminType.NEW_CLIENT_REQUEST,
                        schema: NewClientAdminRequestSchema,
                    },
                ],
            },
        ]),
        MongooseModule.forFeatureAsync([
            {
                name: BespokeCampaignRequest.name,
                useFactory: () => {
                    const baseSchema = BespokeCampaignRequestSchema;

                    const ArtistSchema = new MongooseSchema({}, { _id: false });
                    const OtherSchema  = new MongooseSchema({}, { _id: false });

                    baseSchema.discriminator(BespokeRequestCategory.artist, ArtistSchema);
                    baseSchema.discriminator(BespokeRequestCategory.music, MusicBespokeCampaignFieldsSchema);
                    baseSchema.discriminator(BespokeRequestCategory.event, EventBespokeCampaignFieldsSchema);
                    baseSchema.discriminator(BespokeRequestCategory.other, OtherSchema);

                    return baseSchema;
                },
            }
        ])
    ],
    providers: [
        ClientRepository,
        InfluencerRepository,
        AdminRepository,
        VerifyClientRepository,
        VerifyInfluencerRepository,
        InfluencerHistoryRepository,
        CampaignRepository,
        DraftCampaignRepository,
        CompletedCampaignRepository,
        ProposalCampaignRepository,
        ProposalCampaignOptionRepository,
        BespokeCampaignRepository,
        UserInvoiceRepository,
        InvoiceDetailsRepository,
        UkBankTransferDetailsRepository,
        InternationalBankTransferDetailsRepository,
        PaypalDetailsRepository,
        ReportSizeRepository,
        NegotiationRepository,
        PaymentHistoryCellRepository,
        OfferRepository,
        OfferAccountLinkRepository,
        AuthSessionRepository,
        RequestForAdminRepository,
    ],
    exports: [
        ClientRepository,
        InfluencerRepository,
        AdminRepository,
        VerifyClientRepository,
        VerifyInfluencerRepository,
        InfluencerHistoryRepository,
        CampaignRepository,
        DraftCampaignRepository,
        CompletedCampaignRepository,
        ProposalCampaignRepository,
        ProposalCampaignOptionRepository,
        BespokeCampaignRepository,
        UserInvoiceRepository,
        InvoiceDetailsRepository,
        UkBankTransferDetailsRepository,
        InternationalBankTransferDetailsRepository,
        PaypalDetailsRepository,
        ReportSizeRepository,
        NegotiationRepository,
        PaymentHistoryCellRepository,
        OfferRepository,
        OfferAccountLinkRepository,
        AuthSessionRepository,
        RequestForAdminRepository,
    ],
})
export class DatabaseModule {}