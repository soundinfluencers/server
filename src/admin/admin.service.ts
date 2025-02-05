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
import {AdminUpdateCampaignVideoDto} from "./dto/admin-update-promo-video.dto";
import {AdminUpdateCampaignInfluencersDto} from "./dto/admin-update-promo-influencers.dto";
import {AdminAddInfluencerToCampaignDto} from "./dto/admin-add-influencer-to-campaign.dto";
import {AdminSendEmailToInfluencerDto} from "./dto/admin-send-email-to-influencer.dto";
import {OffersTemp, OffersTempSchema} from "./schemas/offers-temp.schema";
import {AdminSaveOffersToTempDto} from "./dto/admin-save-offer-to-temp.dto";
import {AdminPutOfferToOffersDto} from "./dto/admin-put-offer-to-offers.dto";
import {PromosService} from "../promos/promos.service";
import {PromosCopies} from "./schemas/promos-copies.schema";
import {AdminUpdateInfluencerFullAccountDto} from "./dto/admin-update-influencer-full-account.dto";

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
            const clientsData = await this.clientModel.aggregate([
                {
                    $match: {statusVerify: 'accept'}
                },
                {
                    $lookup: {
                        from: 'promos',
                        localField: '_id',
                        foreignField: 'userId',
                        as: 'campaigns'
                    }
                },
                {
                    $addFields: {
                        campaignsCompleted: {
                            $size: {
                                $filter: {
                                    input: '$campaigns',
                                    as: 'campaign',
                                    cond: {$eq: ['$$campaign.statusPromo', 'finally']}
                                }
                            }
                        },
                        campaignsDenied: {
                            $size: {
                                $filter: {
                                    input: '$campaigns',
                                    as: 'campaign',
                                    cond: {
                                        $gt: [
                                            {
                                                $size: {
                                                    $filter: {
                                                        input: '$$campaign.selectInfluencers',
                                                        as: 'influencer',
                                                        cond: {$ne: ['$$influencer.confirmation', 'accept']}
                                                    }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                }
                            }
                        },
                        campaignsOngoing: {
                            $size: {
                                $filter: {
                                    input: '$campaigns',
                                    as: 'campaign',
                                    cond: {$eq: ['$$campaign.statusPromo', 'work']}
                                }
                            }
                        },
                        latestCampaign: {
                            $arrayElemAt: [
                                {
                                    $sortArray: {
                                        input: '$campaigns',
                                        sortBy: {createdAt: -1}
                                    }
                                },
                                0
                            ]
                        }
                    }
                },
                {
                    $project: {
                        password: 0,
                        campaigns: 0
                    }
                }
            ]);

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
                        {[`${campaign.socialMedia}.instagramUsername`]: influencer.socialMediaUsername},
                        {[`${campaign.socialMedia}.instagramUsername`]: (influencer as any).instagramUsername}
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
            await campaign.save();

            const price = influencerAccount[campaign.socialMedia].find(
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

            await this.influencerModel.findOneAndUpdate(
                {
                    $or: [
                        {[`${campaign.socialMedia}.instagramUsername`]: influencer.socialMediaUsername},
                        {[`${campaign.socialMedia}.instagramUsername`]: (influencer as any).instagramUsername}
                    ]
                },
                {balance: updatedBalance}
            );

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
                [`${campaign.socialMedia}.instagramUsername`]: influencer.socialMediaUsername || (influencer as any).instagramUsername,
            }).lean().exec();

            if (influencerData && influencerData[campaign.socialMedia]) {
                const socialMediaAccountProfile = influencerData[campaign.socialMedia].find(
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
                                socialMedia: campaign.socialMedia,
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
            _id: new mongoose.Types.ObjectId(),
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
                "Campaign Public Link",
                `Hello,
            Here is the public link to campaign: ${publicLink},
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

    async adminGetOneCampaign(campaignId: string) {
        try {
            let campaign: any = await this.promosModel.findOne({_id: campaignId}).lean().exec();

            if (!campaign) {
                campaign = await this.promosCopiesModel.findOne({_id: campaignId}).lean().exec();

                if (!campaign) {
                    return {
                        status: 404,
                        message: 'Promo not found',
                    };
                }
            }

            if (!campaign.isCopy) {
                let totalFollowers = 0;

                if (Array.isArray(campaign.selectInfluencers)) {
                    const influencersSocialMediaAccountsUsernames = campaign.selectInfluencers.map(influencer => influencer.socialMediaUsername || (influencer as any).instagramUsername);

                    const socialMediaField = campaign.socialMedia ? `${campaign.socialMedia}` : 'instagram';

                    const influencers = await this.influencerModel.find({
                        [`${socialMediaField}.instagramUsername`]: {$in: influencersSocialMediaAccountsUsernames}
                    }).lean().exec();

                    campaign.selectInfluencers.forEach((campaignInfluencer: any) => {
                        campaignInfluencer.instagramUsername = campaignInfluencer.socialMediaUsername || (campaignInfluencer as any).instagramUsername;

                        const influencer = influencers.find(inf =>
                            inf[socialMediaField].some(acc => acc.instagramUsername === campaignInfluencer.instagramUsername)
                        );

                        if (influencer) {
                            const socialMediaAccount = influencer[socialMediaField].find(acc => acc.instagramUsername === campaignInfluencer.instagramUsername);

                            if (socialMediaAccount) {
                                const followersNumber = socialMediaAccount.followersNumber.replace(/[\s,]/g, '');
                                campaignInfluencer.followersNumber = parseInt(followersNumber, 10);
                                totalFollowers += campaignInfluencer.followersNumber;
                            } else {
                                campaignInfluencer.followersNumber = 0;
                            }
                        } else {
                            campaignInfluencer.followersNumber = 0;
                        }
                    });
                }

                return {
                    status: 200,
                    campaign: {
                        ...campaign,
                        totalFollowers,
                        amount: campaign.campaignPrice || (campaign as any).amount,
                        videos: campaign.campaignContent || (campaign as any).videos,
                    },
                };
            } else {
                return {
                    status: 200,
                    campaign: {
                        ...campaign,
                        amount: campaign.campaignPrice || (campaign as any).amount,
                        videos: campaign.campaignContent || (campaign as any).videos,
                        selectInfluencers: campaign.selectInfluencers.map((influencer: any) => {
                            return {
                                ...influencer,
                                instagramUsername: influencer.socialMediaUsername || (influencer as any).instagramUsername,
                            }
                        })
                    }
                };
            }
        } catch (err) {
            return {
                status: 500,
                message: err,
            };
        }
    }

    async adminUpdateCampaign(data: AdminUpdateCampaignDto) {
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

            await this.promosModel.findOneAndUpdate(
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
                message: 'Promo update',
            };

        } catch (err) {
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

    async adminUpdateCampaignVideo(data: AdminUpdateCampaignVideoDto) {
        try {
            let campaign = await this.promosModel.findOne({_id: data._id}).lean().exec();
            if (!campaign) {
                return {
                    status: 404,
                    message: 'Promo not found',
                };
            }
            
            if (campaign.campaignContent && campaign.campaignContent.length > 0) {
                const campaignContentItem = campaign.campaignContent.find((campaignContentItem) => campaignContentItem._id.toString() === data.campaignContentItemId) || (campaign as any).videos.find((video) => video._id.toString() === data.campaignContentItemId);
                
                if (data.newVideoLink) {
                    campaign.selectInfluencers.forEach((influencer) => {
                        if (influencer.selectedCampaignContentItem === campaignContentItem.videoLink && data.selectInfluencersAccountId === influencer._id.toString()) {
                            influencer.selectedCampaignContentItem = data.newVideoLink;
                        }
                    });
                }

                if (campaignContentItem && data.newVideoLink && data.isNewCampaignContentItem) {
                    campaignContentItem.videoLink = data.newVideoLink;
                }
                
                await this.promosModel.findOneAndUpdate(
                    {_id: data._id},
                    {
                        $set: {
                            campaignContent: campaign.campaignContent,
                            selectInfluencers: campaign.selectInfluencers,
                        }
                    },
                );

                return {
                    status: 200,
                    message: 'Campaign video updated successfully',
                }
            } else if ((campaign as any).videos && (campaign as any).videos.length > 0) {
                const campaignContentItem = (campaign as any).videos.find((video) => video._id.toString() === data.campaignContentItemId);
                
                if (data.newVideoLink) {
                    campaign.selectInfluencers.forEach((influencer) => {
                        if ((influencer as any).selectedVideo === campaignContentItem.videoLink && data.selectInfluencersAccountId === influencer._id.toString()) {
                            (influencer as any).selectedVideo = data.newVideoLink;
                        }
                    });
                }

                if (campaignContentItem && data.newVideoLink && data.isNewCampaignContentItem) {
                    campaignContentItem.videoLink = data.newVideoLink;
                }
                
                await this.promosModel.findOneAndUpdate(
                    {_id: data._id},
                    {
                        $set: {
                            videos: (campaign as any).videos,
                            selectInfluencers: campaign.selectInfluencers,
                        }
                    },
                    {strict: false}
                );
                
                return {
                    status: 200,
                    message: 'Campaign video updated successfully',
                }
            }
        } catch (err) {
            console.error('Error updating promo video:', err);
            return {
                status: 500,
                message: err.message || 'An error occurred while updating the promo video',
            };
        }
    }

    async adminUpdateInfluencersListCampaign(data: AdminUpdateCampaignInfluencersDto) {
        try {
            let campaign = await this.promosModel.findOne({_id: data.campaignId}).lean().exec();

            if (!campaign) {
                return {
                    status: 404,
                    message: 'Promo not found',
                };
            }

            const influencerIndex = campaign.selectInfluencers.findIndex(
                (influencer) => (influencer.socialMediaUsername === data.socialMediaUsername || (influencer as any).instagramUsername === data.socialMediaUsername) && influencer._id.toString() === data.selectInfluencersAccountId
            );

            if (influencerIndex === -1) {
                return {
                    status: 404,
                    message: 'Influencer not found in promo',
                };
            }

            await this.promosModel.findOneAndUpdate(
                {_id: data.campaignId},
                {
                    $set: {
                        [`selectInfluencers.${influencerIndex}.confirmation`]: 'accept',
                        [`selectInfluencers.${influencerIndex}.postLink`]: data.postLink,
                        [`selectInfluencers.${influencerIndex}.screenshot`]: data.screenshot,
                        [`selectInfluencers.${influencerIndex}.impressions`]: data.impressions,
                        [`selectInfluencers.${influencerIndex}.like`]: data.like,
                    },
                },
            );

            return {
                status: 200,
                message: 'Influencer data updated successfully',
            };
        } catch (err) {
            console.error('Error updating promo influencers:', err);
            return {
                status: 500,
                message: err.message || 'An error occurred while updating the promo influencers',
            };
        }
    }

    async adminRemoveInfluencerFromCampaign(campaignId: string, selectInfluencersAccountId: string) {
        try {
            let campaign = await this.promosModel.findOne({_id: campaignId}) || await this.promosCopiesModel.findOne({_id: campaignId});

            if (!campaign) {
                return {
                    status: 404,
                    message: 'Campaign not found',
                };
            }

            const influencerIndex = campaign.selectInfluencers.findIndex(
                (influencer) => influencer._id.toString() === selectInfluencersAccountId
            );

            if (influencerIndex === -1) {
                return {
                    status: 404,
                    message: 'Influencer not found in promo',
                };
            }

            const influencersPrice = parseInt(campaign.selectInfluencers[influencerIndex].publicPrice);

            campaign.selectInfluencers.splice(influencerIndex, 1);

            campaign.campaignPrice = campaign.campaignPrice - influencersPrice;

            await campaign.save();

            return {
                code: 200,
                message: 'Influencer removed from promo successfully',
            };
        } catch (err) {
            console.error('Error removing influencer from promo:', err);
            return {
                code: 500,
                message: err.message || 'An error occurred while removing the influencer from the promo',
            };
        }
    }

    async adminAddInfluencerToCampaign(data: AdminAddInfluencerToCampaignDto) {
        try {
            let campaign = await this.promosModel.findOne({_id: data._id}) || await this.promosCopiesModel.findOne({_id: data._id});
            if (!campaign) {
                return {
                    code: 404,
                    message: 'Campaign not found',
                };
            }

            const influencer = await this.influencerModel.findOne({_id: data.influencerId});

            if (!influencer) {
                return {
                    code: 404,
                    message: 'Influencer not found',
                };
            }

            const price = influencer[campaign.socialMedia].find((acc) => acc.instagramUsername === data.socialMediaUsername).price;
            const publicPrice = influencer[campaign.socialMedia].find((acc) => acc.instagramUsername === data.socialMediaUsername).publicPrice;

            campaign.selectInfluencers.push({
                _id: new Types.ObjectId(),
                influencerId: new Types.ObjectId(data.influencerId),
                socialMediaUsername: data.socialMediaUsername,
                confirmation: 'wait',
                socialMedia: 'instagram',
                selectedCampaignContentItem: data.selectedCampaignContentItem,
                dateRequest: data.dateRequest,
                closePromo: 'wait',
                postLink: '',
                screenshot: '',
                impressions: '',
                like: '',
                price: price,
                publicPrice: publicPrice,
                followersNumber: influencer[campaign.socialMedia].find((acc) => acc.instagramUsername === data.socialMediaUsername).followersNumber,
            });

            if (!campaign.campaignContent.some(campaignContentItem => campaignContentItem.videoLink === data.selectedCampaignContentItem)) {
                const newCampaignContent = {
                    _id: new Types.ObjectId(),
                    videoLink: data.selectedCampaignContentItem,
                    postDescription: '',
                    storyTag: '',
                    swipeUpLink: '',
                    specialWishes: '',
                };
                campaign.campaignContent.push(newCampaignContent);
            }

            campaign.campaignPrice = campaign.campaignPrice + parseInt(publicPrice);

            await campaign.save();

            return {
                code: 200,
                message: 'Influencer added to promo successfully',
            };
        } catch (err) {
            console.error('Error adding influencer to promo:', err);
            return {
                code: 500,
                message: err.message || 'An error occurred while adding the influencer to the promo',
            };
        }
    }

    async adminAddInfluencerToTempList(campaignId: string, socialMediaUsername: string) {
        if (!campaignId || !socialMediaUsername) {
            return {
                code: 400,
                message: 'Not enough arguments',
            };
        }

        try {
            let campaign = await this.promosModel.findOne({_id: campaignId}) || await this.promosCopiesModel.findOne({_id: campaignId});

            if (!campaign) {
                return {
                    code: 404,
                    message: 'Campaign not found',
                };
            }

            const influencer = await this.influencerModel.findOne({
                [`${campaign.socialMedia}.instagramUsername`]: {$regex: `^${socialMediaUsername}$`, $options: 'i'}
            });

            if (!influencer) {
                return {
                    code: 404,
                    message: 'Influencer not found',
                };
            }

            const socialMediaAccountFollowers = influencer[campaign.socialMedia].find((acc) => acc.instagramUsername.toLowerCase() === socialMediaUsername.toLowerCase()).followersNumber;
            const socialMediaAccountUsername = influencer[campaign.socialMedia].find((acc) => acc.instagramUsername.toLowerCase() === socialMediaUsername.toLowerCase()).instagramUsername;

            const influencerObj = {
                _id: new Types.ObjectId(),
                influencerId: new Types.ObjectId(influencer._id),
                instagramUsername: socialMediaAccountUsername,
                socialMedia: 'instagram',
                confirmation: 'wait',
                selectedCampaignContentItem: '',
                selectedVideo: '',
                dateRequest: '',
                closePromo: 'wait',
                postLink: '',
                screenshot: '',
                impressions: '',
                like: '',
            };

            return {
                code: 200,
                account: {
                    ...influencerObj,
                    followersCount: socialMediaAccountFollowers,
                },
            };
        } catch (err) {
            console.error('Error adding influencer to promo:', err);
            return {
                code: 500,
                message: err.message || 'An error occurred while adding the influencer to the promo',
            };
        }
    }

    async adminSendEmailToInfluencer(data: AdminSendEmailToInfluencerDto) {
        const emailToInfluencer = `
Hi,
You have received a new promo request on your account for the following:
${data.socialMediaUsername} - Instagram Post & Story
Post Details:
  
     Link:${data.videoLink || 'No link provided'}
     Post Description: ${data.postDescription || 'No description provided'}
     Story Tag: ${data.storyTag || 'No story tag provided'}
     Swipe Up Link: ${data.storyLink || 'No post link provided'}
   
Access your account to accept or deny it here: https://go.soundinfluencers.com/account/influencer/new-promos     
Thanks,
Soundinfluencers Team
`;

        try {
            const influencer = await this.influencerModel.findOne({_id: data.influencerId});
            if (!influencer) {
                return {
                    status: 404,
                    message: 'Influencer not found',
                };
            }
            const emailToSend = influencer.email;
            await sendMail(
                emailToSend,
                "New Campaign Request",
                emailToInfluencer,
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

    async hideCpmAndResultForCampaign(campaignId: string) {
        try {
            let campaign = await this.promosModel.findOne({_id: campaignId});

            if (!campaign) {
                campaign = await this.promosCopiesModel.findOne({_id: campaignId});

                if (!campaign) {
                    return {
                        status: 404,
                        message: 'Campaign not found',
                    };
                }
            }

            const updateResult = await this.promosModel.updateOne(
                {_id: campaignId},
                {$set: {isCpmAndResultHidden: !campaign.isCpmAndResultHidden}}
            );

            if (updateResult.matchedCount === 0) {
                await this.promosCopiesModel.updateOne(
                    {_id: campaignId},
                    {$set: {isCpmAndResultHidden: !campaign.isCpmAndResultHidden}}
                );
            }

            return {
                status: 200,
                message: 'CPM and Result hidden successfully',
            };
        } catch (err) {
            console.error('Error occurred:', err);
            return {
                status: 500,
                message: 'An unknown error occurred',
            };
        }
    };

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

    async adminAddInfluencerIdsToOffers() {
        const offer = await this.offersModel.findOne({id: 15}).exec();
        let ctr = 0;

        // console.log('Before update:', offer.connectInfluencer);

        if (offer.connectInfluencer && offer.connectInfluencer.length > 0) {
            for (const influencerObj of offer.connectInfluencer) {
                const influencerObjTyped = influencerObj as { instagramUsername: string; influencerId?: string };

                if (!influencerObjTyped.influencerId) {
                    const influencer = await this.influencerModel.findOne({
                        'instagram.instagramUsername': influencerObjTyped.instagramUsername
                    });
                    // console.log(`Processing influencer ${influencer?._id.toString()}`);
                    if (influencer) {
                        influencerObjTyped.influencerId = influencer._id.toString();
                        ctr++;
                    } else {
                        console.log(`No influencer found for ${influencerObjTyped.instagramUsername}`);
                    }
                }
            }
        }

        // console.log('After update:', offer.connectInfluencer);

        if (offer.musicStyles && offer.musicStyles.length > 0) {
            for (const musicStyle of offer.musicStyles) {
                console.log('Before update:', musicStyle.connectInfluencer);
                await Promise.all(
                    musicStyle.connectInfluencer.map(async (influencerObj: any) => {
                        const influencerObjTyped = influencerObj as {
                            instagramUsername: string;
                            influencerId?: string
                        };

                        if (!influencerObjTyped.influencerId) {
                            const influencer = await this.influencerModel.findOne({
                                'instagram.instagramUsername': influencerObjTyped.instagramUsername
                            });
                            console.log(`Processing influencer ${influencer?._id.toString()}`);
                            if (influencer) {
                                influencerObjTyped.influencerId = influencer._id.toString();
                                ctr++;
                            } else {
                                console.log(`No influencer found for ${influencerObjTyped.instagramUsername}`);
                            }
                        }
                    })
                );
                console.log('After update:', musicStyle.connectInfluencer);
            }
        }

        offer.markModified('connectInfluencer');
        offer.markModified('musicStyles');
        await offer.save();

        console.log(`Total ${ctr} influencer ids added`);
    }

    async adminGiveIdsToSelectInfluencersAndVideos() {
        const promos = await this.promosModel.find().lean().exec();
        for (const promo of promos) {
            if (promo.selectInfluencers && promo.selectInfluencers.length > 0) {
                promo.selectInfluencers = promo.selectInfluencers.map((influencer: any) => {
                    if (!influencer._id) {
                        influencer._id = new Types.ObjectId();
                    } else {
                        influencer._id = new Types.ObjectId(influencer._id);
                    }
                    influencer.socialMediaUsername =  (influencer as any).instagramUsername;
                    influencer.selectedCampaignContentItem = (influencer as any).selectedVideo;
                    return influencer;
                })
            }

            if ((promo as any).videos && (promo as any).videos.length > 0) { 
                for (const campaignContentItem of (promo as any).videos) {
                    if (!campaignContentItem._id) {
                        campaignContentItem._id = new Types.ObjectId();
                    }
                }
            }

            const updatedPromo = {
                _id: promo._id,
                campaignName: promo.campaignName,
                clientId: (promo as any).userId,
                socialMedia: promo.socialMedia,
                selectInfluencers: promo.selectInfluencers,
                campaignContent: (promo as any).videos,
                paymentType: promo.paymentType,
                paymentStatus: promo.paymentStatus,
                statusCampaign: (promo as any).statusPromo,
                campaignPrice: (promo as any).amount,
                verifyCampaign: (promo as any).verifyPromo,
                isCpmAndResultHidden: (promo as any).isCpmAndResultHidden,
                isCopy: (promo as any).isCopy,
                replacementsNotes: (promo as any).replacementsNotes,
                partialRefund: (promo as any).partialRefund,
            };
            console.log('Updated promo:', updatedPromo);
            try {
                await this.promosModel.findOneAndReplace({_id: promo._id}, updatedPromo);
            } catch (error) {
                console.error('Error updating promo:', error);
                return {
                    status: 500,
                    message: 'An unknown error occurred',
                };
            }
        }
    }
}