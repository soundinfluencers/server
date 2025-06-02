import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Promos} from "../promos/schemas/promo.schema";
import mongoose, {Types} from "mongoose";
import {Client} from "../auth/schemas/client.schema";
import {Influencer} from "../auth/schemas/influencer.schema";
import {Offers} from "../promos/schemas/offers.schema";
import {AdminUpdatePersonalClientDto} from "./dto/admin-update-client.dto";
import {AdminUpdateInfluencerPersonalDto} from "./dto/admin-update-influencer-personal.dto";
import {AdminUpdateInfluencerInstagramDto} from "./dto/admin-update-influencer-instagram.dto";
import {Invoices} from "../invoice/schemas/invoices.schema";
import {AdminUpdateInfluencerInvoiceDto} from "./dto/admin-update-influencer-invoice.dto";
import {Payment} from "../payment/schemas/payment.entity";
import {AdminUpdateClientPayment} from "./dto/admin-update-client-payment.update";
import sendMail from "../utils/sendMail";
import {AdminUpdateCampaignDto} from "./dto/admin-update-promo.dto";
import {AdminSendEmailToInfluencerDto} from "./dto/admin-send-email-to-influencer.dto";
import {OffersTemp} from "./schemas/offers-temp.schema";
import {AdminSaveOffersToTempDto} from "./dto/admin-save-offer-to-temp.dto";
import {AdminPutOfferToOffersDto} from "./dto/admin-put-offer-to-offers.dto";
import {PromosService} from "../promos/promos.service";
import {PromosCopies} from "./schemas/promos-copies.schema";
import {AdminUpdateInfluencerFullAccountDto} from "./dto/admin-update-influencer-full-account.dto";
import {ProposalCampaign} from "../proposal-system/schemas/proposal-campaign.schema";
import {AdminUpdateFullCampaignDto} from "./dto/admin-update-full-campaign";
import {TwilioSendNewPromoRequestVariables, TwilioWhatsappService} from "../services/Twilio.service";
const fs = require("fs");
const PDFDocument = require("pdfkit");

@Injectable()
export class AdminService {
    constructor(
        @InjectModel(Promos.name)
        private promosModel: mongoose.Model<Promos>,
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
        @InjectModel(Offers.name)
        private offersModel: mongoose.Model<Offers>,
        @InjectModel(Invoices.name)
        private invoicesModel: mongoose.Model<Invoices>,
        @InjectModel(Payment.name)
        private paymentModel: mongoose.Model<Payment>,
        @InjectModel(OffersTemp.name)
        private offersTempModel: mongoose.Model<OffersTemp>,
        @InjectModel(PromosCopies.name)
        private promosCopiesModel: mongoose.Model<PromosCopies>,
        @InjectModel(ProposalCampaign.name)
        private proposalCampaignModel: mongoose.Model<ProposalCampaign>,
        private readonly promosService: PromosService,
        private readonly twilioService: TwilioWhatsappService
    ) {
    }

    async createPDF(data: any) {
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream("invoice.pdf");
        doc.pipe(writeStream);

        // Header
        doc.fontSize(20).text("INVOICE", 50, 50);

        // Sender's details
        doc.fontSize(10).text(data.fromCompanyName, 50, 100);
        doc.text(data.address, 50, 115);
        doc.text(data.townCountry, 50, 130);
        doc.text("Chamber of Commerce: " + data.chamberOfCommerce, 50, 145);
        doc.text("Email Address: " + data.email, 50, 160);
        doc.text("Phone number: " + data.phone, 50, 175);


        // Date and Invoice Number
        doc.text(`DATE: ${data.date}`, 400, 100);
        doc.text(`INVOICE NO. ${data.invoiceNo}`, 400, 115);

// Bill To
        doc.text("BILL TO", 50, 240);
        doc.text(data.companyName, 50, 255);
// Table headers
        doc.text("DESCRIPTION", 50, 350);
        doc.text("TOTAL", 250, 350);

// Table content
        doc.text("Instagram Promotion", 50, 365);
        doc.text(data.total + "€", 250, 365);

// Payment details
        doc.text("SUBTOTAL:", 50, 400);
        doc.text(data.subtotal + "€", 250, 400);
        doc.text("BALANCE DUE:", 50, 415);
        doc.text(data.balanceDue + "€", 250, 415);


        // Payment method and terms
        doc.text("Payment Terms: Within 7 business days", 50, 465);

        doc.end();

        return new Promise((resolve, reject) => {
            writeStream.on("finish", () => resolve("invoice.pdf"));
            writeStream.on("error", reject);
        });
    }

    async adminGetClients() {
        try {
            const clients = await this.clientModel.find();

            const clientsData = await Promise.all(
                clients.map(async (client) => {
                    const clientOngoingCampaigns = await this.promosModel
                        .find({ clientId: client.id })
                        .sort({ createdAt: -1 });
                    const clientCompletedCampaigns = await this.promosCopiesModel
                        .find({ clientId: client.id })
                        .sort({ createdAt: -1 });


                    const clientCampaignsInfo = {
                        campaignsCompleted: clientCompletedCampaigns?.length || 0,
                        campaignsDenied: 0,
                        campaignsOngoing: clientOngoingCampaigns?.length || 0,
                        latestCampaign: null,
                    };

                    if (clientOngoingCampaigns?.length > 0 || clientCompletedCampaigns?.length > 0) {
                        const latestOngoing = clientOngoingCampaigns[0] || null;
                        const latestCompleted = clientCompletedCampaigns[0] || null;

                        if (latestOngoing && latestCompleted) {
                            clientCampaignsInfo.latestCampaign =
                                latestOngoing.createdAt > latestCompleted.createdAt
                                    ? {
                                        campaignName: latestOngoing.campaignName,
                                        campaignId: latestOngoing._id,
                                    }
                                    : {
                                        campaignName: latestCompleted.campaignName,
                                        campaignId: latestCompleted._id,
                                    };
                        } else if (latestOngoing) {
                            clientCampaignsInfo.latestCampaign = {
                                campaignName: latestOngoing.campaignName,
                                campaignId: latestOngoing._id,
                            };
                        } else if (latestCompleted) {
                            clientCampaignsInfo.latestCampaign = {
                                campaignName: latestCompleted.campaignName,
                                campaignId: latestCompleted._id,
                            };
                        }
                    }

                    return {
                        company: client.company,
                        companyType: client.companyType,
                        firstName: client.firstName,
                        email: client.email,
                        phone: client.phone,
                        _id: client._id,
                        isProposalClient: client?.isProposalClient || false,
                        campaignsCompleted: clientCampaignsInfo.campaignsCompleted,
                        campaignsDenied: clientCampaignsInfo.campaignsDenied,
                        campaignsOngoing: clientCampaignsInfo.campaignsOngoing,
                        latestCampaign: clientCampaignsInfo.latestCampaign,
                        internalNote: client?.internalNote || "",
                    };
                })
            );

            return {
                code: 200,
                data: clientsData
            };
        } catch (err) {
            console.log(err);
            return {
                code: 500,
                message: err,
            };
        }
    }

    async adminUpdateClientProposalStatus(clientId: string, newStatus: boolean) {
        try {
            const updatedClient = await this.clientModel.findByIdAndUpdate(
                clientId,
                { $set: { isProposalClient: newStatus } },
                { new: true }
            );

            if (!updatedClient) {
                return {
                    code: 404,
                    message: 'Client not found',
                };
            }

            return {
                code: 200,
                message: 'Client proposal status updated successfully',
            };
        } catch (err) {
            console.log(err);
            return {
                code: 500,
                message: 'Internal Server Error',
            };
        }
    }

    async adminUpdateClient(data: AdminUpdatePersonalClientDto) {
        try {
            if (!data) {
                return {
                    status: 400,
                    message: 'Not enough arguments',
                };
            }
            const checkUser = await this.clientModel.findOne({_id: data.id});

            if (!checkUser) {
                return {
                    code: 404,
                    message: 'User not found',
                };
            }

            await this.clientModel.findOneAndUpdate(
                {_id: data.id},
                {
                    ...data
                },
            );

            return {
                code: 200,
                message: 'personal data update',
            };
        } catch (err) {
            return {
                status: 500,
                message: err,
            };
        }
    }

    async adminGetAllInfluencerInstaAccounts(socialMedia: string) {
        try {
            const socialMediaAccounts = await this.influencerModel.aggregate([
                {$match: {statusVerify: 'accept'}},
                {$unwind: `$${socialMedia}`},
                {$match: {[`${socialMedia}.isVerified`]: true}},
                {$sort: {[`${socialMedia}.createdAt`]: -1}},
                {
                    $project: {
                        influencerId: '$_id',
                        firstName: 1,
                        phone: 1,
                        balance: 1,
                        email: 1,
                        internalNote: 1,
                        account: `$${socialMedia}`,
                    },
                },
            ]);

            if (!socialMediaAccounts || socialMediaAccounts.length === 0) {
                return {
                    status: 404,
                    message: 'No accounts found',
                };
            }

            const influencerIds = socialMediaAccounts.map(acc => acc.influencerId);
            const usernames = socialMediaAccounts.map(acc => acc.account.instagramUsername);

            const latestInvoices = await this.invoicesModel
                .find({influencerId: {$in: influencerIds}})
                .sort({createdAt: -1})
                .lean()
                .exec();

            const promoData = await this.promosModel
                .aggregate([
                    {$unwind: "$selectInfluencers"},
                    {
                        $match: {
                            "selectInfluencers.instagramUsername": {$in: usernames},
                        },
                    },
                    {
                        $group: {
                            _id: "$selectInfluencers.instagramUsername",
                            campaignsCompleted: {
                                $sum: {
                                    $cond: [
                                        {$and: [{$eq: ["$selectInfluencers.confirmation", "accept"]}, {$eq: ["$selectInfluencers.closePromo", "close"]}]},
                                        1,
                                        0,
                                    ],
                                },
                            },
                            campaignsDenied: {
                                $sum: {
                                    $cond: [
                                        {$ne: ["$selectInfluencers.confirmation", "accept"]},
                                        1,
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ])
                .exec();

            const invoiceMap = Object.fromEntries(latestInvoices.map(inv => [inv.influencerId.toString(), inv]));
            const promoMap = Object.fromEntries(promoData.map(promo => [promo._id, promo]));

            socialMediaAccounts.forEach(acc => {
                acc.latestInvoice = invoiceMap[acc.influencerId] || "No Invoice";
                acc.campaignsCompleted = promoMap[acc.account.instagramUsername]?.campaignsCompleted || 0;
                acc.campaignsDenied = promoMap[acc.account.instagramUsername]?.campaignsDenied || 0;
            });

            return {
                status: 200,
                data: socialMediaAccounts,
            };

        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: err.message || 'An unknown error occurred',
            };
        }
    }

    async isValidUTF8(str) {
        try {
            decodeURIComponent(escape(str));
            return true;
        } catch (e) {
            return false;
        }
    }

    async adminUpdatePersonalInfluencer(data: AdminUpdateInfluencerPersonalDto) {
        try {
            if (!data) {
                return {
                    status: 400,
                    message: 'Not enough arguments',
                };
            }
            const checkUser = await this.influencerModel.findOne({_id: data.id});

            if (!checkUser) {
                return {
                    code: 404,
                    message: 'User not found',
                };
            }

            await this.influencerModel.findOneAndUpdate(
                {_id: data.id},
                {
                    ...data
                },
            );

            return {
                code: 200,
                message: 'personal data update',
            };
        } catch (err) {
            return {
                status: 500,
                message: err,
            };
        }
    }

    async adminUpdateInfluencerSocialMediaAccount(data: AdminUpdateInfluencerInstagramDto) {
        try {
            if (!data) {
                return {
                    status: 400,
                    message: 'Not enough arguments',
                };
            }

            const checkUser = await this.influencerModel.findOne({_id: data.influencerId});

            if (!checkUser) {
                return {
                    code: 404,
                    message: 'User not found',
                };
            }

            const checkSocialMediaAccount = checkUser[data.socialMedia]?.find(
                (account) => account.instagramUsername === data.instagramUsername
            );

            if (!checkSocialMediaAccount) {
                return {
                    code: 404,
                    message: `${data.socialMedia} not found`,
                };
            }

            const updateFields: any = {
                [`${data.socialMedia}.$.instagramLink`]: data.instagramLink,
                [`${data.socialMedia}.$.followersNumber`]: data.followersNumber,
                [`${data.socialMedia}.$.price`]: data.price,
                [`${data.socialMedia}.$.publicPrice`]: data.publicPrice,
            };

            if (data.musicStyle) {
                updateFields[`${data.socialMedia}.$.musicStyle`] = data.musicStyle;
            }

            if (data.musicSubStyles && Array.isArray(data.musicSubStyles)) {
                updateFields[`${data.socialMedia}.$.musicSubStyles`] = data.musicSubStyles;
            }

            if (data.musicStyleOther && Array.isArray(data.musicStyleOther)) {
                updateFields[`${data.socialMedia}.$.musicStyleOther`] = data.musicStyleOther;
            }

            if (data.countries && Array.isArray(data.countries)) {
                updateFields[`${data.socialMedia}.$.countries`] = data.countries;
            }

            if (data.categories && Array.isArray(data.categories)) {
                updateFields[`${data.socialMedia}.$.categories`] = data.categories;
            }

            if (data.logo && data.logo !== checkSocialMediaAccount.logo) {
                updateFields[`${data.socialMedia}.$.logo`] = data.logo;
            }

            await this.influencerModel.findOneAndUpdate(
                {
                    _id: data.influencerId,
                    [`${data.socialMedia}.instagramUsername`]: data.instagramUsername,
                },
                {
                    $set: updateFields,
                }
            );

            return {
                status: 200,
                message: 'Social media account updated successfully',
            };
        } catch (err) {
            return {
                status: 500,
                message: err.message || 'Internal server error',
            };
        }
    }

    async adminGetOneInfluencerInstaAccount(influencerId: string, socialMedia: string, instagramUsername: string) {
        try {
            const influencer = await this.influencerModel.findOne({_id: influencerId}).lean().exec();

            if (!influencer) {
                return {
                    status: 404,
                    message: 'Influencer not found',
                };
            }

            const socialMediaAccount = influencer[socialMedia].find((account) => account.instagramUsername === instagramUsername);

            if (!socialMediaAccount) {
                return {
                    status: 404,
                    message: 'Instagram not found',
                };
            }

            const influencerAvatar = socialMediaAccount.logo;

            const result = {
                account: {
                    instagramUsername: socialMediaAccount.instagramUsername,
                    instagramLink: socialMediaAccount.instagramLink,
                    followersNumber: socialMediaAccount.followersNumber,
                    price: socialMediaAccount.price,
                    publicPrice: socialMediaAccount.publicPrice,
                    logo: socialMediaAccount.logo,
                    musicStyle: socialMediaAccount.musicStyle,
                    musicSubStyles: socialMediaAccount.musicSubStyles,
                    musicStyleOther: socialMediaAccount.musicStyleOther,
                    countries: socialMediaAccount.countries,
                    categories: socialMediaAccount.categories,
                    isHidden: socialMediaAccount.isHidden,
                },
                influencerId: influencer._id,
                firstName: influencer.firstName,
                phone: influencer.phone,
                balance: influencer.balance,
                email: influencer.email,
                avatar: influencerAvatar,
                internalNote: influencer.internalNote,
            };

            return {
                status: 200,
                data: result,
            };

        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: err.message || 'An unknown error occurred',
            };
        }
    }

    async adminGetAllInvoices() {
        try {
            const invoices = await this.invoicesModel
                .find()
                .sort({createdAt: -1})
                .lean()
                .exec();

            if (!invoices || invoices.length === 0) {
                return {
                    status: 404,
                    message: 'No invoices found',
                };
            }

            const validInvoices = invoices.filter(invoice => {
                try {
                    return Object.values(invoice).every(value =>
                        typeof value !== 'string' || this.isValidUTF8(value)
                    );
                } catch (err) {
                    console.warn(`Skipping invoice due to error:`, err);
                    return false;
                }
            });

            if (validInvoices.length === 0) {
                return {
                    status: 404,
                    message: 'No valid invoices found',
                };
            }

            return {
                status: 200,
                data: validInvoices,
            };

        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: err.message || 'An unknown error occurred',
            };
        }
    }

    async adminUpdateInfluencerInvoice(data: AdminUpdateInfluencerInvoiceDto) {
        try {
            if (!data) {
                return {
                    status: 400,
                    message: 'Not enough arguments',
                };
            }

            const checkInvoice = await this.invoicesModel.findOne({_id: data._id});

            if (!checkInvoice) {
                return {
                    code: 404,
                    message: 'Invoice not found',
                };
            }

            await this.invoicesModel.findOneAndUpdate(
                {_id: data._id},
                {
                    ...data
                },
            );

            return {
                code: 200,
                message: 'Invoice update',
            };

        } catch (err) {
            return {
                status: 500,
                message: err,
            }
        }
    }

    async adminGetOneInfluencerInvoice(invoiceId: string) {
        try {
            const invoice = await this.invoicesModel.findOne({_id: invoiceId}).lean().exec();

            if (!invoice) {
                return {
                    status: 404,
                    message: 'Invoice not found',
                };
            }

            return {
                status: 200,
                data: invoice,
            };
        } catch (err) {
            return {
                status: 500,
                message: err,
            };
        }
    }

    async adminGetAllClientsPayments() {
        try {
            const payments = await this.paymentModel
                .find()
                .sort({createdAt: -1})
                .lean()
                .exec();

            if (!payments || payments.length === 0) {
                return {
                    status: 404,
                    message: 'No payments found',
                };
            }

            const result = await Promise.all(payments.map(async (payment) => {
                const user = await this.clientModel.findOne({_id: payment.userId}).lean().exec();
                return {
                    ...payment,
                    companyName: user.company,
                };
            }));

            return {
                status: 200,
                data: result,
            };

        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: err.message || 'An unknown error occurred',
            };
        }
    }

    async adminUpdateClientPayment(data: AdminUpdateClientPayment) {
        try {
            if (!data) {
                return {
                    status: 400,
                    message: 'Not enough arguments',
                };
            }

            const checkPayment = await this.paymentModel.findOne({_id: data._id});

            if (!checkPayment) {
                return {
                    code: 404,
                    message: 'Payment not found',
                };
            }

            await this.paymentModel.findOneAndUpdate(
                {_id: data._id},
                {
                    ...data
                },
            );

            const user = await this.clientModel.findOne({_id: data.userId}).lean().exec();

            await this.clientModel.findOneAndUpdate(
                {_id: data.userId},
                {
                    company: data.companyName
                },
            );

            // if (!user) {
            //     return {
            //         code: 404,
            //         message: 'User not found',
            //     };
            // }

            return {
                code: 200,
                message: 'Payment update',
            };

        } catch (err) {
            return {
                status: 500,
                message: err,
            }
        }
    }

    async adminGetOneClientPayment(_id: string) {
        try {
            const payment = await this.paymentModel.findOne({_id}).lean().exec();

            if (!payment) {
                return {
                    status: 404,
                    message: 'Payment not found',
                };
            }

            const user = await this.clientModel.findOne({_id: payment.userId}).lean().exec();

            return {
                status: 200,
                data: {
                    ...payment,
                    companyName: user.company,
                },
            };
        } catch (err) {
            return {
                status: 500,
                message: err,
            };
        }
    }

    async adminSendNewInvoiceToClient(data: any) {
        try {
            const user = await this.clientModel.findOne({_id: data.userId}).lean().exec();

            if (!user) {
                return {
                    status: 404,
                    message: 'User not found',
                };
            }

            await this.createPDF(data).then(async (path) => {
                const emailToSend = user.email;

                await sendMail(
                    emailToSend,
                    "Invoice",
                    `<p>Hello,</p>
          <p>Please find attached the invoice for your SoundInfluencers campaign.</p><br/>
          <p> To monitor the progress of your campaign, please visit the <a href="https://go.soundinfluencers.com/account/client/ongoing-promos">"Ongoing Promo"</a>  section in the homepage in <a href="https://go.soundinfluencers.com">go.soundinfluencers.com</a></p><br/>
          <p>Best regards,
          SoundInfluencers Team</p>`,
                    "pdf",
                    path as string
                );
            })
                .catch((error) => {
                    console.error("Error creating PDF:", error);
                });
            return {
                code: 201,
                message: "ok",
            };
        } catch (err) {
            console.log(err);

            return {
                code: 500,
                message: err,
            };
        }
    }

    async adminGetAllCampaigns() {
        try {
            const campaigns = await this.promosModel.find().sort({createdAt: -1}).lean().exec();

            const campaignsCopies = await this.promosCopiesModel.find().sort({createdAt: -1}).lean().exec();

            if ((!campaigns || campaigns.length === 0) && (!campaignsCopies || campaignsCopies.length === 0)) {
                return {
                    status: 404,
                    message: 'No promos found',
                };
            }

            const resultCampaigns = await Promise.all(campaigns.map(async (campaign) => {
                let totalFollowers = 0;

                if (Array.isArray(campaign.selectInfluencers) && !campaign.isCopy) {
                    const influencersSocialMediaAccountsUsernames = campaign.selectInfluencers.map(influencer => influencer.socialMediaUsername);

                    const socialMediaField = campaign.socialMedia;

                    const influencers = await this.influencerModel.find({
                        [`${socialMediaField}.instagramUsername`]: {$in: influencersSocialMediaAccountsUsernames}
                    }).lean().exec();

                    campaign.selectInfluencers.forEach(campaignInfluencer => {
                        const influencer = influencers.find(inf =>
                            inf[socialMediaField].some(acc => acc.instagramUsername === campaignInfluencer.socialMediaUsername)
                        );

                        if (influencer) {
                            const socialMediaAccount = influencer[socialMediaField].find(acc => acc.instagramUsername === campaignInfluencer.socialMediaUsername);

                            if (socialMediaAccount) {
                                const followersCount = socialMediaAccount.followersNumber.replace(/[\s,]/g, '');
                                totalFollowers += parseInt(followersCount, 10);

                                const cleanedPrice = socialMediaAccount.price.replace(/[^\d]/g, '');
                                const cleanedPublicPrice = socialMediaAccount.publicPrice.replace(/[^\d]/g, '');

                                Object.assign(campaignInfluencer, {
                                    price: parseInt(cleanedPrice, 10),
                                    publicPrice: parseInt(cleanedPublicPrice, 10),
                                });
                            }
                        }
                    });
                }

                return {
                    ...campaign,
                    amount: campaign.campaignPrice || (campaign as any).amount,
                    userId: campaign.clientId || (campaign as any).userId,
                    statusPromo: campaign.statusCampaign || (campaign as any).statusPromo,
                    verifyPromo: campaign.verifyCampaign || (campaign as any).verifyPromo,
                    totalFollowers,
                };
            }));
            const resultCampaignsCopies = await Promise.all(campaignsCopies.map(async (campaign) => {
                return {
                    ...campaign,
                    amount: campaign.campaignPrice || (campaign as any).amount,
                    userId: campaign.clientId || (campaign as any).userId,
                    statusPromo: campaign.statusCampaign || (campaign as any).statusPromo,
                    verifyPromo: campaign.verifyCampaign || (campaign as any).verifyPromo,
                };
            }));

            const dataToReturn = [...resultCampaigns, ...resultCampaignsCopies].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return {
                status: 200,
                data: dataToReturn,
            };
        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: err.message || 'An unknown error occurred',
            };
        }
    }

    async adminDeletePromo(promoId: string) {
        try {
            let promo = await this.promosModel.findOne({_id: promoId}) || await this.promosCopiesModel.findOne({_id: promoId});

            if (!promo) {
                return {
                    status: 404,
                    message: 'Promo not found',
                };
            }

            await this.promosModel.deleteOne({_id: promoId}) || await this.promosCopiesModel.deleteOne({_id: promoId});

            return {
                status: 200,
                message: 'Promo deleted successfully',
            };
        } catch (err) {
            console.error('Error deleting promo:', err);
            return {
                status: 500,
                message: err.message || 'An error occurred while deleting the promo',
            };
        }
    }

    async adminCloseCampaignForInfluencer(campaignId: string, selectInfluencersAccountId: string) {
        try {
            let campaign = await this.promosModel.findOne({_id: campaignId}) || await this.promosCopiesModel.findOne({_id: campaignId});

            if (!campaign) {
                return {
                    code: 404,
                    message: 'Promo not found',
                };
            }

            const influencer = campaign.selectInfluencers.find(
                (influencer) => influencer._id.toString() === selectInfluencersAccountId
            );

            if (!influencer) {
                return {
                    code: 404,
                    message: 'Influencer not found in promo',
                };
            }

            const influencerAccount = await this.influencerModel
                .findOne({
                    _id: influencer.influencerId,
                    $or: [
                        {[`${influencer.socialMedia}.instagramUsername`]: influencer.socialMediaUsername},
                        {[`${influencer.socialMedia}.instagramUsername`]: (influencer as any).instagramUsername}
                    ]
                })
                .lean()
                .exec();

            if (!influencerAccount) {
                return {
                    code: 404,
                    message: 'Influencer account not found',
                };
            }

            influencer.confirmation = 'accept';
            influencer.closePromo = 'close';

            const price = influencerAccount[influencer.socialMedia].find(
                (acc) => acc.instagramUsername === influencer.socialMediaUsername || acc.instagramUsername === (influencer as any).instagramUsername
            )?.price;

            if (!price) {
                return {
                    code: 400,
                    message: 'Price not found for influencer',
                };
            }

            let balance = parseInt(influencerAccount.balance.replace('€', '').trim(), 10);

            if (isNaN(balance)) {
                balance = 0;
            }

            balance += parseInt(price.replace('€', '').trim(), 10);

            const updatedBalance = `${balance}`;

            try {
                await this.influencerModel.findOneAndUpdate(
                    {
                        _id: influencer.influencerId,
                    },
                    {balance: updatedBalance}
                );
                await campaign.save();
            } catch (err) {
                console.error('Error while closing campaign for influencer', err);
                return {
                    code: 500,
                    message: err.message || 'An error occurred while updating the influencer balance while closing the campaign for this him',
                };
            }

            return {
                code: 200,
                message: 'Promo closed for influencer successfully',
            };
        } catch (err) {
            console.error('Error closing promo for influencer:', err);
            return {
                code: 500,
                message: err.message || 'An error occurred while closing the promo for the influencer',
            };
        }
    }

    async adminClosePromo(campaignId: string) {
        if (!campaignId) {
            return {
                status: 400,
                message: 'Not enough arguments',
            };
        }

        const campaign = await this.promosModel.findOne({_id: campaignId}).lean().exec();

        if (!campaign) {
            return {
                status: 404,
                message: 'Promo not found',
            };
        }

        let selectInfluencers = campaign.selectInfluencers;
        let totalFollowers = 0;

        for (const influencer of campaign.selectInfluencers) {
            const influencerData = await this.influencerModel.findOne({
                [`${influencer.socialMedia}.instagramUsername`]: influencer.socialMediaUsername || (influencer as any).instagramUsername,
            }).lean().exec();

            if (influencerData && influencerData[influencer.socialMedia]) {
                const socialMediaAccountProfile = influencerData[influencer.socialMedia].find(
                    (profile: any) => profile.instagramUsername === influencer.socialMediaUsername || profile.instagramUsername === (influencer as any).instagramUsername,
                );

                if (socialMediaAccountProfile) {
                    const followersCount = socialMediaAccountProfile.followersNumber;
                    const price = socialMediaAccountProfile.price;
                    const publicPrice = socialMediaAccountProfile.publicPrice;

                    const cleanedPrice = price.replace(/[^\d]/g, '');
                    const cleanedPublicPrice = publicPrice.replace(/[^\d]/g, '');

                    totalFollowers += parseInt(followersCount);

                    selectInfluencers = selectInfluencers.map((influencer) => {
                        if (influencer.socialMediaUsername === socialMediaAccountProfile.instagramUsername || (influencer as any).instagramUsername === socialMediaAccountProfile.instagramUsername) {
                            return {
                                _id: influencer._id,
                                influencerId: influencer.influencerId,
                                socialMediaUsername: influencer.socialMediaUsername || (influencer as any).instagramUsername,
                                confirmation: influencer.confirmation,
                                socialMedia: influencer.socialMedia,
                                closePromo: 'close',
                                price: cleanedPrice,
                                publicPrice: cleanedPublicPrice,
                                selectedCampaignContentItem: influencer.selectedCampaignContentItem || (influencer as any).selectedVideo,
                                followersNumber: parseInt(followersCount),
                                dateRequest: influencer.dateRequest || '',
                                postLink: influencer.postLink || '',
                                screenshot: influencer.screenshot || '',
                                impressions: influencer.impressions || '',
                                like: influencer.like || '',
                            };
                        }
                        return influencer;
                    });
                } else {
                    console.log(`No matching Instagram profile found for ${influencer.socialMediaUsername}`);
                    return {
                        status: 404,
                        message: 'No matching Instagram profile found for influencer' + influencer.socialMediaUsername,
                    };
                }
            } else {
                console.log(`No influencer data found for ${influencer.socialMediaUsername}`);
            }
        }

        await this.promosCopiesModel.create({
            ...campaign,
            _id: campaign._id,
            campaignContent: campaign.campaignContent || (campaign as any).videos,
            campaignPrice: campaign.campaignPrice || (campaign as any).amount,
            statusCampaign: 'finally',
            selectInfluencers: selectInfluencers,
            totalFollowers: totalFollowers,
            isCopy: true,
        });

        await this.promosModel.deleteOne({_id: campaignId});

        return {
            status: 201,
            message: 'Promo closed successfully',
        };
    }

    async adminSendCampaignPublicLinkToClient(userId: string, publicLink: string) {
        try {
            const user = await this.clientModel.findOne({_id: userId}).lean().exec();
            if (!user) {
                return {
                    status: 404,
                    message: 'User not found',
                };
            }

            const emailToSend = user.email;
            await sendMail(
                emailToSend,
                // "nazarkozynets030606@zohomail.eu",
                "Campaign Public Link",
                `Hello,
            Here is the public link to campaign: ${publicLink}
            Best regards,
            SoundInfluencers Team`,
            );
            return {
                code: 201,
                message: "ok",
            };
        } catch (err) {
            console.log(err);

            return {
                code: 500,
                message: err,
            };
        }
    }

    async adminGetOneCampaign(campaignId: string, isProposal?: boolean) {
        try {
            let campaign: any;

            if (!isProposal) {
                campaign = await this.promosModel.findOne({_id: campaignId}).lean().exec();
                if (!campaign) {
                    campaign = await this.promosCopiesModel.findOne({_id: campaignId}).lean().exec();
                }
            } else {
                campaign = await this.proposalCampaignModel.findOne({_id: campaignId}).lean().exec();
            }

            if (!campaign) {
                return {
                    status: 404,
                    message: 'Promo not found',
                };
            }

            const campaignToReturn = {
                _id: campaign._id,
                clientId: campaign.clientId,
                campaignName: campaign.campaignName ?? 'OLD CAMPAIGN',
                price: campaign.campaignPrice ?? campaign.price ?? campaign.amount ?? 0,
                publicPrice: campaign.campaignPrice ?? campaign.publicPrice ?? campaign.amount ?? 0,
                addedAccounts: [],
                campaignContent: campaign.campaignContent ?? campaign.videos ?? [],
                socialMedia: campaign.socialMedia ?? 'instagram',
                totalFollowers: 0,
                totalLikes: 0,
                totalImpressions: 0,
                createdAt: campaign.createdAt ?? 0,
                isCopy: campaign.isCopy ?? false,
                isCpmAndResultHidden: campaign.isCpmAndResultHidden ?? false,
                isPriceHidden: campaign.isPriceHidden ?? false,
                hiddenColumns: campaign.hiddenColumns ?? [],
            };

            for (const addedAccount of campaign.selectInfluencers) {
                const normalizedUsername =
                    addedAccount?.socialMediaUsername?.trim() ||
                    addedAccount?.instagramUsername?.trim() ||
                    '';

                const accSocialMedia = addedAccount?.socialMedia || campaign.socialMedia !== 'multipromo' && campaign.socialMedia;

                campaignToReturn.totalFollowers += addedAccount?.followersNumber ?? 0;
                campaignToReturn.totalImpressions += parseInt(addedAccount.impressions?.replace(/[\s,]/g, '') || '0');
                campaignToReturn.totalLikes += parseInt(addedAccount.like?.replace(/[\s,]/g, '') || '0');

                const selectedCampaignContentItemId =
                    addedAccount?.selectedCampaignContentItem ??
                    (Array.isArray(campaign?.videos)
                        ? campaign.videos.find((item) => item.videoLink === addedAccount?.selectedVideo)?._id
                        : null) ??
                    null;

                let selectedCampaignContentItem = null;

                if (selectedCampaignContentItemId) {
                    selectedCampaignContentItem =
                        (Array.isArray(campaign?.campaignContent)
                            ? campaign.campaignContent.find(
                                (item) => item?._id?.toString() === selectedCampaignContentItemId?.toString(),
                            )
                            : null) ??
                        (Array.isArray(campaign?.videos) && campaign.videos.length > 0
                            ? campaign.videos.find(
                                (item) => item?._id?.toString() === selectedCampaignContentItemId?.toString(),
                            )
                            : null) ??
                        null;
                }

                addedAccount.selectedCampaignContentItemId = selectedCampaignContentItemId;
                addedAccount.selectedCampaignContentItem = selectedCampaignContentItem;
                addedAccount.socialMedia = addedAccount?.socialMedia || accSocialMedia;
                addedAccount.socialMediaUsername = normalizedUsername;

                campaignToReturn.addedAccounts.push(addedAccount);
            }

            campaignToReturn.addedAccounts.sort((a, b) => {
                const aContentId = a.selectedCampaignContentItemId;
                const bContentId = b.selectedCampaignContentItemId;

                const aIndex = Array.isArray(campaign.campaignContent)
                    ? campaign.campaignContent.findIndex((content) => content?._id?.toString() === aContentId?.toString())
                    : Array.isArray(campaign.videos)
                        ? campaign.videos.findIndex((video) => video?._id?.toString() === aContentId?.toString())
                        : -1;

                const bIndex = Array.isArray(campaign.campaignContent)
                    ? campaign.campaignContent.findIndex((content) => content?._id?.toString() === bContentId?.toString())
                    : Array.isArray(campaign.videos)
                        ? campaign.videos.findIndex((video) => video?._id?.toString() === bContentId?.toString())
                        : -1;

                return aIndex - bIndex;
            });

            return {
                status: 200,
                campaign: campaignToReturn,
            };
        } catch (err) {
            console.error(err);
            return {
                status: 500,
                message: err.message || 'Internal server error',
            };
        }
    }

    async adminUpdateCampaign(data: AdminUpdateFullCampaignDto) {
        try {
            const {
                campaignId,
                campaignName,
                campaignPrice,
                campaignContent,
                isPriceHidden,
                isCpmAndResultHidden,
                isProposalCampaign,
                hiddenColumns,
                addedInfluencers
            } = data;

            if (
                !campaignId ||
                !campaignName ||
                !campaignPrice ||
                !campaignContent ||
                !addedInfluencers ||
                isPriceHidden == null ||
                isCpmAndResultHidden == null ||
                isProposalCampaign == null
            ) {
                return {
                    status: 400,
                    message: "Bad Request",
                };
            }

            let campaign;

            if (!isProposalCampaign) {
                campaign = await this.promosModel.findById(campaignId) || await this.promosCopiesModel.findById(campaignId);
            } else {
                campaign = await this.proposalCampaignModel.findById(campaignId);
            }

            if (!campaign) {
                return {
                    code: 404,
                    message: "No campaign found",
                }
            }

            campaign.campaignName = campaignName.trim() ?? campaign.campaignName;
            campaign.isPriceHidden = isPriceHidden ?? campaign.isPriceHidden;
            campaign.isCpmAndResultHidden = isCpmAndResultHidden ?? campaign.isCpmAndResultHidden;
            campaign.hiddenColumns = hiddenColumns || [];
            campaign.campaignContent = campaignContent ?? campaign?.campaignContent ?? campaign?.videos ?? [];

            if (!isProposalCampaign) {
                campaign.campaignPrice = campaignPrice || campaign.campaignPrice;
            } else {
                campaign.price = campaignPrice || campaign.price;
                campaign.publicPrice = campaignPrice || campaign.publicPrice;
            }

            const selectInfluencerIds = new Set(campaign.selectInfluencers.map((account) => account._id.toString()));
            const addedInfluencerIds = new Set(addedInfluencers.map((item) => item._id.toString()));

            campaign.selectInfluencers = campaign.selectInfluencers.filter((account) => {
                const id = account._id.toString();
                if (!addedInfluencerIds.has(id)) {
                    if (isProposalCampaign) campaign.totalFollowers -= account.followersNumber;
                    return false;
                }

                const thisAccountFromData = addedInfluencers.find((item) => item._id.toString() === id);
                if (thisAccountFromData) {
                    account.selectedCampaignContentItem = thisAccountFromData.selectedCampaignContentItemId;
                    account.dateRequest = thisAccountFromData?.dateRequest ?? (account.dateRequest || "ASAP");
                    account.postLink = thisAccountFromData?.postLink ?? (account.postLink || "");
                    account.screenshot = thisAccountFromData?.screenshot ?? (account.screenshot || "");
                    account.like = thisAccountFromData?.like ?? (account.like || "");
                    account.impressions = thisAccountFromData?.impressions ?? (account.impressions || "");
                }

                return true;
            });

            if (!isProposalCampaign) {
                addedInfluencers.forEach((newInfluencer) => {
                    const id = newInfluencer._id.toString();
                    if (!selectInfluencerIds.has(id)) {
                        campaign.selectInfluencers.push({
                            _id: new Types.ObjectId(),
                            influencerId: newInfluencer.influencerId,
                            socialMediaUsername: newInfluencer.socialMediaUsername,
                            selectedCampaignContentItem: newInfluencer.selectedCampaignContentItemId,
                            socialMedia: newInfluencer.socialMedia,
                            dateRequest: newInfluencer.dateRequest ?? "ASAP",
                            postLink: newInfluencer.postLink ?? "",
                            screenshot: newInfluencer.screenshot ?? "",
                            like: newInfluencer.like ?? "",
                            impressions: newInfluencer.impressions ?? "",
                            followersNumber: newInfluencer.followersNumber ?? 0,
                            price: newInfluencer.price ?? "0",
                            publicPrice: newInfluencer.publicPrice ?? "0",
                        });
                    }
                });
            } else {
                for (const newInfluencer of addedInfluencers) {
                    const id = newInfluencer._id.toString();
                    if (!selectInfluencerIds.has(id)) {
                        const aggregationPipeline = [
                            { $unwind: `$${newInfluencer.socialMedia}` },
                            {
                                $match: {
                                    $expr: {
                                        $eq: [
                                            { $trim: { input: `$${newInfluencer.socialMedia}.instagramUsername` } },
                                            newInfluencer.socialMediaUsername,
                                        ],
                                    },
                                },
                            },
                            {
                                $project: {
                                    influencerId: `$${newInfluencer.socialMedia}._id`,
                                    followersNumber: `$${newInfluencer.socialMedia}.followersNumber`,
                                    musicStyle: `$${newInfluencer.socialMedia}.musicStyle`,
                                    musicStyleOther: `$${newInfluencer.socialMedia}.musicStyleOther`,
                                    musicSubStyles: `$${newInfluencer.socialMedia}.musicSubStyles`,
                                    countries: `$${newInfluencer.socialMedia}.countries`,
                                },
                            },
                        ];

                        const result = await this.influencerModel.aggregate(aggregationPipeline).exec();

                        if (result.length > 0) {
                            const formattedGenres = this.promosService.returnMusicStyles(result[0].musicStyle, result[0].musicStyleOther, result[0].musicSubStyles)

                            campaign.totalFollowers += parseInt(result[0].followersNumber);
                            campaign.selectInfluencers.push({
                                _id: new Types.ObjectId(),
                                influencerId: result[0].influencerId,
                                socialMediaUsername: newInfluencer.socialMediaUsername,
                                selectedCampaignContentItem: newInfluencer.selectedCampaignContentItemId,
                                socialMedia: newInfluencer.socialMedia,
                                dateRequest: newInfluencer.dateRequest ?? "ASAP",
                                postLink: newInfluencer.postLink ?? "",
                                screenshot: newInfluencer.screenshot ?? "",
                                like: newInfluencer.like ?? "",
                                impressions: newInfluencer.impressions ?? "",
                                followersNumber: newInfluencer.followersNumber ?? 0,
                                price: newInfluencer.price ?? "0",
                                publicPrice: newInfluencer.publicPrice ?? "0",
                                genres: formattedGenres || [],
                                countries: result[0].countries
                            });
                        }
                    }
                }
            }

            campaign.markModified('selectInfluencers');
            await campaign.save();

            return {
                code: 200,
                message: "Campaign updated",
            }
        } catch (err) {
            console.error('Error saving campaign:', err);
            return {
                code: 500,
                message: err.message || 'Internal server error',
            };
        }
    };

    async adminUpdateCampaignUpdateFromCampaignsPage(data: AdminUpdateCampaignDto) {
        try {
            if (!data) {
                return {
                    status: 400,
                    message: 'Not enough arguments',
                };
            }

            let checkCampaign = await this.promosModel.findOne({_id: data._id}) || await this.promosCopiesModel.findOne({_id: data._id});

            if (!checkCampaign) {
                return {
                    code: 404,
                    message: 'Promo not found',
                };
            }

            const updatedCampaign = await this.promosModel.findOneAndUpdate(
                {_id: data._id},
                {
                    ...data
                },
            ) || await this.promosCopiesModel.findOneAndUpdate(
                {_id: data._id},
                {
                    ...data
                },
            );

            return {
                code: 200,
                message: 'Campaign updated',
            };

        } catch (err) {
            console.error(err);
            return {
                status: 500,
                message: err,
            }
        }
    }

    async adminGivePartialRefundToClient(userId: string, partialRefund: number, campaignId: string) {
        try {
            let campaign = await this.promosModel.findOne({_id: campaignId}) || await this.promosCopiesModel.findOne({_id: campaignId});

            if (!campaign) {
                return {
                    code: 404,
                    message: 'Campaign not found',
                };
            }

            campaign.partialRefund = 0;
            await campaign.save();

            const client = await this.clientModel.findOne({_id: userId});

            if (!client) {
                return {
                    code: 404,
                    message: 'Client not found',
                };
            }

            client.balance += partialRefund;

            await client.save();

            return {
                code: 200,
                message: 'Partial refund given',
            };
        } catch (err) {
            console.log(err);

            return {
                code: 500,
                message: err.message || 'An error occurred',
            };
        }
    }

    async adminAddInfluencerToTempList(campaignId: string, socialMediaUsername: string, socialMedia: string) {
        if (!campaignId || !socialMediaUsername) {
            return {
                code: 400,
                message: 'Not enough arguments',
            };
        }

        try {
            let campaign =
                await this.promosModel.findOne({_id: campaignId}) ||
                await this.promosCopiesModel.findOne({_id: campaignId}) ||
                await this.proposalCampaignModel.findOne({_id: campaignId});

            if (!campaign) {
                return {
                    code: 404,
                    message: 'Campaign not found',
                };
            }

            const influencer = await this.influencerModel.findOne({
                [`${socialMedia}.instagramUsername`]: {$regex: `^${socialMediaUsername}$`, $options: 'i'}
            });

            if (!influencer) {
                return {
                    code: 404,
                    message: 'Influencer not found',
                };
            }

            const socialMediaAccount = influencer[socialMedia].find((acc) => acc.instagramUsername === socialMediaUsername);

            if (!socialMediaAccount)
                return {
                    code: 404,
                    message: 'Influencer not found',
                }

            const influencerObj = {
                _id: new Types.ObjectId(),
                influencerId: new Types.ObjectId(influencer._id),
                socialMediaUsername: socialMediaAccount.instagramUsername,
                followersNumber: socialMediaAccount.followersNumber ?? 0,
                price: socialMediaAccount.price,
                publicPrice: socialMediaAccount.publicPrice,
                socialMedia: socialMedia,
                confirmation: 'wait',
                selectedCampaignContentItemId: null,
                selectedCampaignContentItem: {
                    _id: "",
                    videoLink: "",
                    postDescription: "",
                    storyTag: "",
                    swipeUpLink: "",
                    specialWishes: '',
                    socialMedia: '',
                },
                dateRequest: '',
                closePromo: 'wait',
                postLink: '',
                screenshot: '',
                impressions: '',
                like: '',
            };

            return {
                code: 200,
                account: influencerObj,
            };
        } catch (err) {
            console.error('Error adding influencer to promo:', err);
            return {
                code: 500,
                message: err.message || 'An error occurred while adding the influencer to the promo',
            };
        }
    }

    async adminSendWhatsAppMessageToInfluencer(data: AdminSendEmailToInfluencerDto) {
        try {
            const influencer = await this.influencerModel.findOne({ _id: data.influencerId });

            if (!influencer) {
                return {
                    code: 404,
                    message: 'Influencer not found',
                };
            }

            const phoneNumber = influencer.phone;
            if (!phoneNumber) {
                return {
                    code: 400,
                    message: 'Phone number is missing for this influencer',
                };
            }

            const variablesToUse: TwilioSendNewPromoRequestVariables = {
                socialMediaUsername: data.socialMediaUsername,
                socialMedia: data.socialMedia,
                link: data.videoLink,
                postDesc: data.postDescription,
                storyTag: data.storyTag,
                storyLink: data.storyLink,
            };

            await this.twilioService.sendNewPromoRequest(phoneNumber.replace(/\s+/g, ''), variablesToUse);

            return {
                code: 200,
                message: 'Message sent successfully',
            };
        } catch (err) {
            console.error('Failed to send WhatsApp message:', err);
            return {
                code: 500,
                message: 'Internal server error',
                error: err.message || err,
            };
        }
    }

    async adminGetAllOffers() {
        try {
            const offersTempPromise = this.offersTempModel.find();

            const socialMediaTypes = ["instagram", "tiktok", "facebook", "youtube", "spotify", "soundcloud", "press"];
            const promosService = new PromosService(this.promosModel, this.clientModel, this.influencerModel, this.offersModel, this.promosCopiesModel);

            const socialMediaPromises = socialMediaTypes.map(socialMedia => promosService.getOffers(socialMedia));
            const socialMediaResults = await Promise.all(socialMediaPromises);

            const socialMedias = socialMediaTypes.reduce((acc, socialMedia, index) => {
                acc[socialMedia] = socialMediaResults[index];
                return acc;
            }, {});

            const offersTemp = await offersTempPromise;

            return {
                status: 200,
                data: {
                    offersTemp,
                    socialMedias
                },
            };
        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: err.message || 'An unknown error occurred',
            };
        }
    }

    async adminDeleteOfferAndSaveToTemp(data: AdminSaveOffersToTempDto) {
        try {
            const offer = await this.offersModel.findOne({_id: data._id});

            if (Array.isArray(data.connectInfluencer) && data.connectInfluencer.length === 0) {
                data.connectInfluencer = null;
            }

            if (offer) await offer.deleteOne();

            const findOfferInTemp = await this.offersTempModel.findOne({_id: data._id});

            if (!findOfferInTemp) {
                const offersTemp = new this.offersTempModel(data);
                await offersTemp.save();

                return {
                    status: 200,
                    message: 'Offer deleted and saved to temp successfully',
                };
            } else {
                await this.offersTempModel.updateOne({_id: data._id}, {isDeleted: true});
            }
        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async adminSaveOffersToTemp(data: AdminSaveOffersToTempDto) {
        try {
            const existingOffer = await this.offersTempModel.findOne({_id: data._id});

            if (Array.isArray(data.connectInfluencer) && data.connectInfluencer.length === 0) {
                data.connectInfluencer = null;
            }

            if (existingOffer) {
                await this.offersTempModel.updateOne({_id: data._id}, {...data});
                return {
                    status: 200,
                    message: 'Offer updated successfully',
                };
            } else {
                const offersTemp = new this.offersTempModel(data);
                await offersTemp.save();
                return {
                    status: 201,
                    message: 'Offer created successfully',
                };
            }
        } catch (err) {
            console.error('Error occurred:', err.message);
            console.error('Full error:', err);
            return {
                status: 500,
                message: `An error occurred: ${err.message}`,
            };
        }
    }

    async adminDeleteOffer(offerId: string) {
        try {
            let offer;
            offer = await this.offersTempModel.findById(offerId);

            if (!offer) {
                offer = await this.offersModel.findById(offerId);

                if (!offer) {
                    return {
                        status: 404,
                        message: 'Offer not found',
                    };
                }

            }

            await offer.deleteOne();

            return {
                status: 200,
                message: 'Offer deleted successfully',
            };
        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async adminReturnOfferFromDeleted(data: AdminPutOfferToOffersDto) {
        try {
            if (Array.isArray(data.connectInfluencer) && data.connectInfluencer.length === 0) {
                data.connectInfluencer = null;
            }

            if (data.wasPublished) {
                const offer = await this.offersModel.findOne({_id: data._id});

                if (offer) {
                    return {
                        status: 400,
                        message: 'Offer already published',
                    };
                }

                await this.offersModel.create(data);
                await this.offersTempModel.deleteOne({_id: data._id});
            } else if (!data.wasPublished) {
                const offer = await this.offersTempModel.findOne({_id: data._id});

                if (!offer) {
                    return {
                        status: 400,
                        message: 'Offer not found',
                    };
                }

                await this.offersTempModel.updateOne({_id: data._id}, {isDeleted: false});
            }
        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async adminPublishOffers() {
        try {
            const offersTemp = await this.offersTempModel.find({isDeleted: false});

            if (!offersTemp || offersTemp.length === 0) {
                return {
                    status: 404,
                    message: 'No offers found',
                };
            }

            for (const offer of offersTemp) {
                const existingOffer = await this.offersModel.findOne({_id: offer._id});

                if (existingOffer) {
                    await this.offersModel.updateOne({_id: offer._id}, {...offer.toObject()});
                } else {
                    const newOffer = {
                        ...offer.toObject(),
                        _id: new Types.ObjectId()
                    };
                    await this.offersModel.create(newOffer);
                }
            }

            await this.offersTempModel.deleteMany({isDeleted: false});

            return {
                status: 200,
                message: 'Offers published successfully',
            };

        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async adminUpdateOldOffer(data: AdminSaveOffersToTempDto) {
        try {
            const offer = await this.offersModel.findOne({_id: data._id});

            if (Array.isArray(data.connectInfluencer) && data.connectInfluencer.length === 0) {
                data.connectInfluencer = null;
            }

            if (offer) {
                await this.offersTempModel.create({...data, isNew: true});
                await this.offersModel.deleteOne({_id: data._id});

                return {
                    status: 200,
                    message: 'Offer updated successfully',
                };
            } else {
                const offerTemp = await this.offersTempModel.findOne({_id: data._id});

                if (!offerTemp) {
                    return {
                        status: 404,
                        message: 'Offer not found',
                    };
                }

                await this.offersTempModel.updateOne({_id: data._id}, {...data});

                return {
                    status: 200,
                    message: 'Offer updated successfully',
                };
            }
        } catch (err) {
            console.error('Error occurred:', err);
            throw new Error('An unknown error occurred');
        }
    }

    async adminHideInstagramAccount(influencerId, instagramUsername) {
        try {
            const influencer = await this.influencerModel.findOne({_id: influencerId});

            if (!influencer) {
                return {
                    status: 404,
                    message: 'Influencer not found',
                };
            }

            const instagram = influencer.instagram.find((insta) => insta.instagramUsername === instagramUsername);

            if (!instagram) {
                return {
                    status: 404,
                    message: 'Instagram account not found',
                };
            }

            instagram.isHidden = !instagram.isHidden;

            await influencer.save();

            return {
                status: 200,
                message: 'Instagram account hidden successfully',
            };
        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async adminGetInfluencerAccount(influencerId: string) {
        try {
            const influencer = await this.influencerModel.findOne({_id: influencerId});

            if (!influencer) {
                console.error('Influencer not found');
                return {
                    status: 404,
                    message: 'Influencer not found',
                };
            }

            return {
                status: 200,
                influencer: influencer,
            };
        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async adminUpdateInfluencerAccount(data: AdminUpdateInfluencerFullAccountDto) {
        try {
            const influencer = await this.influencerModel.findOne({_id: data._id});

            if (!influencer) {
                console.error('Influencer not found');
                return {
                    status: 404,
                    message: 'Influencer not found',
                };
            }

            try {
                await this.influencerModel.updateOne({_id: data._id}, {...data});
            } catch (err) {
                console.error('Error updating influencer:', err);
                return {
                    status: 500,
                    message: 'An unknown error occurred',
                };
            }

            return {
                status: 200,
                message: 'Influencer updated successfully',
            };
        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    }

    async adminChangeInfluencerUsernameInOffer() {
        try {
            const offers = await this.offersModel.find();

            for (const offer of offers) {
                let isModified = false;

                if (offer.connectInfluencer && offer.connectInfluencer.length > 0) {
                    offer.connectInfluencer = offer.connectInfluencer.map(item => {
                        if (item.instagramUsername === "The Home of Techno") {
                            isModified = true;
                            return {
                                ...item,
                                instagramUsername: "Techno and House People",
                                influencerId: "659cf0091bf12bc988f64da1"
                            };
                        }
                        return item;
                    });
                }

                if (offer.musicStyles && offer.musicStyles.length > 0) {
                    offer.musicStyles = offer.musicStyles.map(style => {
                        if (style.connectInfluencer && style.connectInfluencer.length > 0) {
                            const updatedConnectInfluencer = style.connectInfluencer.map(item => {
                                if (item.instagramUsername === "The Home of Techno") {
                                    isModified = true;
                                    return {
                                        ...item,
                                        instagramUsername: "Techno and House People",
                                        influencerId: "659cf0091bf12bc988f64da1"
                                    };
                                }
                                return item;
                            });
                            return {
                                ...style,
                                connectInfluencer: updatedConnectInfluencer
                            };
                        }
                        return style;
                    });
                }

                if (isModified) {
                    await offer.save();
                }
            }
        } catch (err) {
            console.error('Error occurred:', err);
            throw err;
        }
    }
}