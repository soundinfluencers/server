import {Injectable, Logger} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Promos} from '../promos/schemas/promo.schema';
import mongoose, {Types} from 'mongoose';
import {Client} from '../auth/schemas/client.schema';
import {Influencer} from '../auth/schemas/influencer.schema';
import {AdminUpdatePersonalClientDto} from './dto/admin-update-client.dto';
import {AdminUpdateInfluencerPersonalDto} from './dto/admin-update-influencer-personal.dto';
import {AdminUpdateInfluencerInstagramDto} from './dto/admin-update-influencer-instagram.dto';
import {Invoices} from '../invoice/schemas/invoices.schema';
import {AdminUpdateInfluencerInvoiceDto} from './dto/admin-update-influencer-invoice.dto';
import {Payment} from '../payment/schemas/payment.entity';
import {AdminUpdateClientPayment} from './dto/admin-update-client-payment.update';
import sendMail from '../services/sendMail';
import {AdminUpdateCampaignDto} from './dto/admin-update-promo.dto';
import {AdminSendWhatsappMessageDto} from './dto/admin-send-whatsapp-message.dto';
import {PromosService} from '../promos/promos.service';
import {PromosCopies} from './schemas/promos-copies.schema';
import {AdminUpdateInfluencerFullAccountDto} from './dto/admin-update-influencer-full-account.dto';
import {ProposalCampaign} from '../proposal-system/schemas/proposal-campaign.schema';
import {AdminUpdateFullCampaignDto} from './dto/admin-update-full-campaign';
import axios from 'axios';

const fs = require('fs');
const PDFDocument = require('pdfkit');
const bcrypt = require('bcryptjs');
import * as process from 'node:process';
import {AdminSendMailToInfluencerDto} from './dto/admin-send-mail-to-influencer.dto';
import {AppGateway} from '../websocket/app.gateway';
import {
    AccountObjectForCreateNewPromoRequestMessage, createNewPromoRequestHTMLMessage,
    createNewPromoRequestTextMessage,
} from '../utils/new-promo-message';
import {AddSocialMediasDto} from '../profile/dto/add-social-medias.dto';
import {AdminImportXlsxInfluencersDto, CountryObj} from "./dto/admin-import-xlsx-influencers";
import {ScrapersService} from "../scrapers/scrapers.service";
import any = jasmine.any;

@Injectable()
export class AdminService {
    private readonly logger = new Logger();

    constructor(
        @InjectModel(Promos.name)
        private promosModel: mongoose.Model<Promos>,
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
        @InjectModel(Invoices.name)
        private invoicesModel: mongoose.Model<Invoices>,
        @InjectModel(Payment.name)
        private paymentModel: mongoose.Model<Payment>,
        @InjectModel(PromosCopies.name)
        private promosCopiesModel: mongoose.Model<PromosCopies>,
        @InjectModel(ProposalCampaign.name)
        private proposalCampaignModel: mongoose.Model<ProposalCampaign>,
        private readonly promosService: PromosService,
        private readonly appGateway: AppGateway,
    ) {
    }

    async createPDF(data: any) {
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream('invoice.pdf');
        doc.pipe(writeStream);

        // Header
        doc.fontSize(20).text('INVOICE', 50, 50);

        // Sender's details
        doc.fontSize(10).text(data.fromCompanyName, 50, 100);
        doc.text(data.address, 50, 115);
        doc.text(data.townCountry, 50, 130);
        doc.text('Chamber of Commerce: ' + data.chamberOfCommerce, 50, 145);
        doc.text('Email Address: ' + data.email, 50, 160);
        doc.text('Phone number: ' + data.phone, 50, 175);

        // Date and Invoice Number
        doc.text(`DATE: ${data.date}`, 400, 100);
        doc.text(`INVOICE NO. ${data.invoiceNo}`, 400, 115);

        // Bill To
        doc.text('BILL TO', 50, 240);
        doc.text(data.companyName, 50, 255);
        // Table headers
        doc.text('DESCRIPTION', 50, 350);
        doc.text('TOTAL', 250, 350);

        // Table content
        doc.text('Instagram Promotion', 50, 365);
        doc.text(data.total + '€', 250, 365);

        // Payment details
        doc.text('SUBTOTAL:', 50, 400);
        doc.text(data.subtotal + '€', 250, 400);
        doc.text('BALANCE DUE:', 50, 415);
        doc.text(data.balanceDue + '€', 250, 415);

        // Payment method and terms
        doc.text('Payment Terms: Within 7 business days', 50, 465);

        doc.end();

        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve('invoice.pdf'));
            writeStream.on('error', reject);
        });
    }

    async adminGetClients() {
        try {
            const clients = await this.clientModel.find();

            const clientsData = await Promise.all(
                clients.map(async (client) => {
                    const clientOngoingCampaigns = await this.promosModel
                        .find({clientId: client.id})
                        .sort({createdAt: -1});
                    const clientCompletedCampaigns = await this.promosCopiesModel
                        .find({clientId: client.id})
                        .sort({createdAt: -1});

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
                        internalNote: client?.internalNote || '',
                    };
                }),
            );

            return {
                code: 200,
                data: clientsData,
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
                {$set: {isProposalClient: newStatus}},
                {new: true},
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
                    ...data,
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

            const influencerIds = socialMediaAccounts.map((acc) => acc.influencerId);
            const usernames = socialMediaAccounts.map((acc) => acc.account.instagramUsername);

            const latestInvoices = await this.invoicesModel
                .find({influencerId: {$in: influencerIds}})
                .sort({createdAt: -1})
                .lean()
                .exec();

            const promoData = await this.promosModel
                .aggregate([
                    {$unwind: '$selectInfluencers'},
                    {
                        $match: {
                            'selectInfluencers.instagramUsername': {$in: usernames},
                        },
                    },
                    {
                        $group: {
                            _id: '$selectInfluencers.instagramUsername',
                            campaignsCompleted: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                {$eq: ['$selectInfluencers.confirmation', 'accept']},
                                                {$eq: ['$selectInfluencers.closePromo', 'close']},
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },
                            campaignsDenied: {
                                $sum: {
                                    $cond: [{$ne: ['$selectInfluencers.confirmation', 'accept']}, 1, 0],
                                },
                            },
                        },
                    },
                ])
                .exec();

            const invoiceMap = Object.fromEntries(
                latestInvoices.map((inv) => [inv.influencerId.toString(), inv]),
            );
            const promoMap = Object.fromEntries(promoData.map((promo) => [promo._id, promo]));

            socialMediaAccounts.forEach((acc) => {
                acc.latestInvoice = invoiceMap[acc.influencerId] || 'No Invoice';
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
                    ...data,
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
                (account) => account.instagramUsername === data.instagramUsername,
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
                },
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

    async adminGetOneInfluencerInstaAccount(
        influencerId: string,
        socialMedia: string,
        instagramUsername: string,
    ) {
        try {
            const influencer = await this.influencerModel.findOne({_id: influencerId}).lean().exec();

            if (!influencer) {
                return {
                    status: 404,
                    message: 'Influencer not found',
                };
            }

            const socialMediaAccount = influencer[socialMedia].find(
                (account) => account.instagramUsername === instagramUsername,
            );

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
            const invoices = await this.invoicesModel.find().sort({createdAt: -1}).lean().exec();

            if (!invoices || invoices.length === 0) {
                return {
                    status: 404,
                    message: 'No invoices found',
                };
            }

            const validInvoices = invoices.filter((invoice) => {
                try {
                    return Object.values(invoice).every(
                        (value) => typeof value !== 'string' || this.isValidUTF8(value),
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
                    ...data,
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
            };
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
            const payments = await this.paymentModel.find().sort({createdAt: -1}).lean().exec();

            if (!payments || payments.length === 0) {
                return {
                    status: 404,
                    message: 'No payments found',
                };
            }

            const result = await Promise.all(
                payments.map(async (payment) => {
                    const user = await this.clientModel.findOne({_id: payment.userId}).lean().exec();
                    return {
                        ...payment,
                        companyName: user.company,
                    };
                }),
            );

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
                    ...data,
                },
            );

            const user = await this.clientModel.findOne({_id: data.userId}).lean().exec();

            await this.clientModel.findOneAndUpdate(
                {_id: data.userId},
                {
                    company: data.companyName,
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
            };
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

            await this.createPDF(data)
                .then(async (path) => {
                    const emailToSend = user.email;

                    await sendMail(
                        emailToSend,
                        'Invoice',
                        `<p>Hello,</p>
          <p>Please find attached the invoice for your SoundInfluencers campaign.</p><br/>
          <p> To monitor the progress of your campaign, please visit the <a href="https://go.soundinfluencers.com/account/client/ongoing-promos">"Ongoing Promo"</a>  section in the homepage in <a href="https://go.soundinfluencers.com">go.soundinfluencers.com</a></p><br/>
          <p>Best regards,
          SoundInfluencers Team</p>`,
                        'pdf',
                        path as string,
                    );
                })
                .catch((error) => {
                    console.error('Error creating PDF:', error);
                });
            return {
                code: 201,
                message: 'ok',
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

            const campaignsCopies = await this.promosCopiesModel
                .find()
                .sort({createdAt: -1})
                .lean()
                .exec();

            if (
                (!campaigns || campaigns.length === 0) &&
                (!campaignsCopies || campaignsCopies.length === 0)
            ) {
                return {
                    status: 404,
                    message: 'No promos found',
                };
            }

            const resultCampaigns = await Promise.all(
                campaigns.map(async (campaign) => {
                    let totalFollowers = 0;

                    if (Array.isArray(campaign.selectInfluencers) && !campaign.isCopy) {
                        const influencersSocialMediaAccountsUsernames = campaign.selectInfluencers.map(
                            (influencer) => influencer.socialMediaUsername,
                        );

                        const socialMediaField = campaign.socialMedia;

                        const influencers = await this.influencerModel
                            .find({
                                [`${socialMediaField}.instagramUsername`]: {
                                    $in: influencersSocialMediaAccountsUsernames,
                                },
                            })
                            .lean()
                            .exec();

                        campaign.selectInfluencers.forEach((campaignInfluencer) => {
                            const influencer = influencers.find((inf) =>
                                inf[socialMediaField].some(
                                    (acc) => acc.instagramUsername === campaignInfluencer.socialMediaUsername,
                                ),
                            );

                            if (influencer) {
                                const socialMediaAccount = influencer[socialMediaField].find(
                                    (acc) => acc.instagramUsername === campaignInfluencer.socialMediaUsername,
                                );

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
                }),
            );
            const resultCampaignsCopies = await Promise.all(
                campaignsCopies.map(async (campaign) => {
                    return {
                        ...campaign,
                        amount: campaign.campaignPrice || (campaign as any).amount,
                        userId: campaign.clientId || (campaign as any).userId,
                        statusPromo: campaign.statusCampaign || (campaign as any).statusPromo,
                        verifyPromo: campaign.verifyCampaign || (campaign as any).verifyPromo,
                        createdAt: campaign.createdAt,
                    };
                }),
            );

            const dataToReturn = [...resultCampaigns, ...resultCampaignsCopies].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );

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
            let promo =
                (await this.promosModel.findOne({_id: promoId})) ||
                (await this.promosCopiesModel.findOne({_id: promoId}));

            if (!promo) {
                return {
                    status: 404,
                    message: 'Promo not found',
                };
            }

            (await this.promosModel.deleteOne({_id: promoId})) ||
            (await this.promosCopiesModel.deleteOne({_id: promoId}));

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
            let campaign =
                (await this.promosModel.findOne({_id: campaignId})) ||
                (await this.promosCopiesModel.findOne({_id: campaignId}));

            if (!campaign) {
                return {code: 404, message: 'Promo not found'};
            }

            const influencerFromSelectInfluencers = campaign.selectInfluencers.find(
                (influencer) => influencer._id.toString() === selectInfluencersAccountId,
            );

            if (!influencerFromSelectInfluencers) {
                return {code: 404, message: 'Influencer not found in promo'};
            }

            const influencerAccount = await this.influencerModel
                .findOne({_id: influencerFromSelectInfluencers.influencerId})
                .lean()
                .exec();

            if (!influencerAccount) {
                return {code: 404, message: 'Influencer account not found'};
            }

            const socialMediaAccFromInfModel = influencerAccount[
                influencerFromSelectInfluencers.socialMedia
                ]?.find(
                (acc) =>
                    acc.instagramUsername === influencerFromSelectInfluencers.socialMediaUsername ||
                    acc.instagramUsername === (influencerFromSelectInfluencers as any).instagramUsername,
            );

            const price = socialMediaAccFromInfModel?.price;
            if (!price) {
                return {code: 400, message: 'Price not found for influencer'};
            }

            const oldConfirmation = influencerFromSelectInfluencers.confirmation;
            const oldClosePromo = influencerFromSelectInfluencers.closePromo;
            const oldBalance = influencerAccount.balance;

            influencerFromSelectInfluencers.confirmation = 'accept';
            influencerFromSelectInfluencers.closePromo = 'close';
            await campaign.save();

            let balance = parseInt(influencerAccount.balance.replace('€', '').trim(), 10);
            if (isNaN(balance)) balance = 0;

            const reward = parseInt(price.replace('€', '').trim(), 10);
            balance += reward;
            const updatedBalance = `${balance}`;

            const updateBalanceResult = await this.influencerModel.findOneAndUpdate(
                {_id: influencerFromSelectInfluencers.influencerId},
                {balance: updatedBalance},
            );

            if (!updateBalanceResult) {
                influencerFromSelectInfluencers.confirmation = oldConfirmation;
                influencerFromSelectInfluencers.closePromo = oldClosePromo;
                await campaign.save();

                return {
                    code: 500,
                    message: 'Failed to update influencer balance, reverted campaign changes',
                };
            }

            const res = await axios.post(
                `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
                {
                    influencerId: influencerAccount._id,
                    campaignId: new mongoose.Types.ObjectId(campaignId),
                    campaignName: campaign.campaignName,
                    updatedCampaignAction: {
                        actionNumber: 5,
                        networkUsername: influencerFromSelectInfluencers.socialMediaUsername,
                        socialMedia: influencerFromSelectInfluencers.socialMedia,
                        rewardForInfluencer: reward,
                    },
                },
            );

            if (res.data.code !== 200) {
                await this.influencerModel.findOneAndUpdate(
                    {_id: influencerFromSelectInfluencers.influencerId},
                    {balance: oldBalance},
                );

                influencerFromSelectInfluencers.confirmation = oldConfirmation;
                influencerFromSelectInfluencers.closePromo = oldClosePromo;
                await campaign.save();

                return {code: 500, message: 'Failed to update influencer history, reverted all changes'};
            }

            return {code: 200, message: 'Promo closed for influencer successfully'};
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
            const influencerData = await this.influencerModel
                .findOne({
                    [`${influencer.socialMedia}.instagramUsername`]:
                        influencer.socialMediaUsername || (influencer as any).instagramUsername,
                })
                .lean()
                .exec();

            if (influencerData && influencerData[influencer.socialMedia]) {
                const socialMediaAccountProfile = influencerData[influencer.socialMedia].find(
                    (profile: any) =>
                        profile.instagramUsername === influencer.socialMediaUsername ||
                        profile.instagramUsername === (influencer as any).instagramUsername,
                );

                if (socialMediaAccountProfile) {
                    const followersCount = socialMediaAccountProfile.followersNumber;
                    const price = socialMediaAccountProfile.price;
                    const publicPrice = socialMediaAccountProfile.publicPrice;

                    const cleanedPrice = price.replace(/[^\d]/g, '');
                    const cleanedPublicPrice = publicPrice.replace(/[^\d]/g, '');

                    totalFollowers += parseInt(followersCount);

                    selectInfluencers = selectInfluencers.map((influencer) => {
                        if (
                            influencer.socialMediaUsername === socialMediaAccountProfile.instagramUsername ||
                            (influencer as any).instagramUsername === socialMediaAccountProfile.instagramUsername
                        ) {
                            return {
                                _id: influencer._id,
                                influencerId: influencer.influencerId,
                                socialMediaUsername:
                                    influencer.socialMediaUsername || (influencer as any).instagramUsername,
                                confirmation: influencer.confirmation,
                                socialMedia: influencer.socialMedia,
                                closePromo: 'close',
                                price: cleanedPrice,
                                publicPrice: cleanedPublicPrice,
                                selectedCampaignContentItem:
                                    influencer.selectedCampaignContentItem || (influencer as any).selectedVideo,
                                followersNumber: parseInt(followersCount),
                                dateRequest: influencer.dateRequest || '',
                                postLink: influencer.postLink || '',
                                screenshot: influencer.screenshot || '',
                                impressions: influencer.impressions || '',
                                like: influencer.like || '',
                                rating: influencer.rating || null,
                                adminChecked: false,
                            };
                        }
                        return influencer;
                    });
                } else {
                    console.log(`No matching Instagram profile found for ${influencer.socialMediaUsername}`);
                    return {
                        status: 404,
                        message:
                            'No matching Instagram profile found for influencer' + influencer.socialMediaUsername,
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
                'Campaign Public Link',
                `Hello,
            Here is the public link to campaign: ${publicLink}
            Best regards,
            SoundInfluencers Team`,
            );
            return {
                code: 201,
                message: 'ok',
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

            // key type for map: 'account.influencerId' or 'account.influencerId-account._id'
            // first means that account was connected when campaign was created
            // second means that account was connected after that by admin
            let influencersMap: Map<
                string,
                {
                    message: string | null;
                    firstName: string;
                    accounts: AccountObjectForCreateNewPromoRequestMessage[];
                }
            > = new Map();

            for (const addedAccount of campaign.selectInfluencers) {
                const normalizedUsername =
                    addedAccount?.socialMediaUsername?.trim() ||
                    addedAccount?.instagramUsername?.trim() ||
                    '';

                const accSocialMedia =
                    addedAccount?.socialMedia ||
                    (campaign.socialMedia !== 'multipromo' && campaign.socialMedia);

                campaignToReturn.totalFollowers += addedAccount?.followersNumber ?? 0;
                campaignToReturn.totalImpressions += parseInt(
                    addedAccount.impressions?.replace(/[\s,]/g, '') || '0',
                );
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

                if (!campaign.isCopy) {
                    const isOriginalAccount =
                        new Date(addedAccount.createdAt).getTime() === new Date(campaign.createdAt).getTime();

                    const key = isOriginalAccount
                        ? addedAccount.influencerId
                        : `${addedAccount.influencerId}-${addedAccount._id}`;

                    if (!influencersMap.has(key)) {
                        const influencer =
                            (await this.influencerModel.findById(addedAccount.influencerId).lean().exec()) ||
                            null

                        const account = influencer[addedAccount.socialMedia].find(acc => acc.instagramUsername === addedAccount.socialMediaUsername) ?? null

                        influencersMap.set(key, {
                            message: null,
                            firstName: account?.firstName ?? "Unknown",
                            accounts: [
                                {
                                    pageName: addedAccount.socialMediaUsername,
                                    reward: `${(account as any).initialPrice ?? addedAccount.price?.replace(/\D/g, '')}${(account as any).currency ?? "EUR"}`,
                                    socialMedia: addedAccount.socialMedia,
                                    contentLink: addedAccount.selectedCampaignContentItem?.videoLink ?? '',
                                    description: addedAccount.selectedCampaignContentItem?.postDescription,
                                    storyTag: addedAccount.selectedCampaignContentItem?.storyTag,
                                    storyLink: addedAccount.selectedCampaignContentItem?.storyLink,
                                    specialRequests: addedAccount.selectedCampaignContentItem?.specialWishes,
                                },
                            ],
                        });
                    } else {
                        const influencerData = influencersMap.get(key);
                        if (influencerData) {
                            influencerData.accounts.push({
                                pageName: addedAccount.socialMediaUsername,
                                reward: `${addedAccount.initialPrice ?? addedAccount.price?.replace(/\D/g, '')}${addedAccount.currency ?? "EUR"}`,
                                socialMedia: addedAccount.socialMedia,
                                contentLink: addedAccount.selectedCampaignContentItem?.videoLink ?? '',
                                description: addedAccount.selectedCampaignContentItem?.postDescription,
                                storyTag: addedAccount.selectedCampaignContentItem?.storyTag,
                                storyLink: addedAccount.selectedCampaignContentItem?.storyLink,
                                specialRequests: addedAccount.selectedCampaignContentItem?.specialWishes,
                            });
                        }
                    }
                }

                campaignToReturn.addedAccounts.push(addedAccount);
            }

            if (!campaign.isCopy) {
                for (const account of campaignToReturn?.addedAccounts) {
                    const isOriginalAccount =
                        new Date(account.createdAt).getTime() === new Date(campaignToReturn.createdAt).getTime();

                    const key = isOriginalAccount
                        ? account.influencerId
                        : `${account.influencerId}-${account._id}`;

                    const infMapItem = influencersMap.get(key);

                    if (!infMapItem) continue;

                    account.message =
                        infMapItem.message ??
                        createNewPromoRequestTextMessage({
                            firstName: infMapItem.firstName,
                            accountsAndDetails: infMapItem.accounts,
                        });
                }
            }

            campaignToReturn.addedAccounts.sort((a, b) => {
                const aContentId = a.selectedCampaignContentItemId;
                const bContentId = b.selectedCampaignContentItemId;

                const aIndex = Array.isArray(campaign.campaignContent)
                    ? campaign.campaignContent.findIndex(
                        (content) => content?._id?.toString() === aContentId?.toString(),
                    )
                    : Array.isArray(campaign.videos)
                        ? campaign.videos.findIndex(
                            (video) => video?._id?.toString() === aContentId?.toString(),
                        )
                        : -1;

                const bIndex = Array.isArray(campaign.campaignContent)
                    ? campaign.campaignContent.findIndex(
                        (content) => content?._id?.toString() === bContentId?.toString(),
                    )
                    : Array.isArray(campaign.videos)
                        ? campaign.videos.findIndex(
                            (video) => video?._id?.toString() === bContentId?.toString(),
                        )
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
                addedInfluencers,
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
                    message: 'Bad Request',
                };
            }

            let campaign;

            if (!isProposalCampaign) {
                campaign =
                    (await this.promosModel.findById(campaignId)) ||
                    (await this.promosCopiesModel.findById(campaignId));
            } else {
                campaign = await this.proposalCampaignModel.findById(campaignId);
            }

            if (!campaign) {
                return {
                    code: 404,
                    message: 'No campaign found',
                };
            }

            campaign.campaignName = campaignName.trim() ?? campaign.campaignName;
            campaign.isPriceHidden = isPriceHidden ?? campaign.isPriceHidden;
            campaign.isCpmAndResultHidden = isCpmAndResultHidden ?? campaign.isCpmAndResultHidden;
            campaign.hiddenColumns = hiddenColumns || [];
            campaign.campaignContent =
                campaignContent ?? campaign?.campaignContent ?? campaign?.videos ?? [];

            if (!isProposalCampaign) {
                campaign.campaignPrice = campaignPrice || campaign.campaignPrice;
            } else {
                campaign.price = campaignPrice || campaign.price;
                campaign.publicPrice = campaignPrice || campaign.publicPrice;
            }

            const selectInfluencerIds = new Set(
                campaign.selectInfluencers.map((account) => account._id.toString()),
            );
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
                    account.dateRequest = thisAccountFromData?.dateRequest ?? (account.dateRequest || 'ASAP');
                    account.postLink = thisAccountFromData?.postLink ?? (account.postLink || '');
                    account.screenshot = thisAccountFromData?.screenshot ?? (account.screenshot || '');
                    account.like = thisAccountFromData?.like ?? (account.like || '');
                    account.impressions = thisAccountFromData?.impressions ?? (account.impressions || '');
                    account.rating = thisAccountFromData?.rating ?? (account.rating || undefined);
                    account.adminChecked =
                        thisAccountFromData?.adminChecked ?? (account.adminChecked || undefined);
                }

                return true;
            });

            if (!isProposalCampaign) {
                await Promise.all(
                    addedInfluencers.map(async (newInfluencer) => {
                        const id = newInfluencer._id.toString();
                        if (!selectInfluencerIds.has(id)) {
                            const response = await axios.post(
                                `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
                                {
                                    influencerId: newInfluencer.influencerId,
                                    campaignId: new mongoose.Types.ObjectId(campaignId),
                                    campaignName: campaignName,
                                    updatedCampaignAction: {
                                        actionNumber: 4,
                                        networkUsername: newInfluencer.socialMediaUsername,
                                        socialMedia: newInfluencer.socialMedia,
                                        rewardForInfluencer: parseInt(newInfluencer.price),
                                    },
                                },
                            );

                            if (response.data.code === 200) {
                                campaign.selectInfluencers.push({
                                    _id: new Types.ObjectId(),
                                    influencerId: newInfluencer.influencerId,
                                    socialMediaUsername: newInfluencer.socialMediaUsername,
                                    selectedCampaignContentItem: newInfluencer.selectedCampaignContentItemId,
                                    socialMedia: newInfluencer.socialMedia,
                                    dateRequest: newInfluencer.dateRequest ?? 'ASAP',
                                    postLink: newInfluencer.postLink ?? '',
                                    screenshot: newInfluencer.screenshot ?? '',
                                    like: newInfluencer.like ?? '',
                                    impressions: newInfluencer.impressions ?? '',
                                    followersNumber: newInfluencer.followersNumber ?? 0,
                                    price: newInfluencer.price ?? '0',
                                    publicPrice: newInfluencer.publicPrice ?? '0',
                                });
                            } else {
                                throw new Error(
                                    `Error adding influencer ${newInfluencer.socialMediaUsername} (${newInfluencer.socialMedia}) to campaign ${campaignName}`,
                                );
                            }
                        }
                    }),
                );
            } else {
                for (const newInfluencer of addedInfluencers) {
                    const id = newInfluencer._id.toString();
                    if (!selectInfluencerIds.has(id)) {
                        const aggregationPipeline = [
                            {$unwind: `$${newInfluencer.socialMedia}`},
                            {
                                $match: {
                                    $expr: {
                                        $eq: [
                                            {$trim: {input: `$${newInfluencer.socialMedia}.instagramUsername`}},
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
                            const formattedGenres = this.promosService.returnMusicStyles(
                                result[0].musicStyle,
                                result[0].musicStyleOther,
                                result[0].musicSubStyles,
                            );

                            campaign.totalFollowers += parseInt(result[0].followersNumber);
                            campaign.selectInfluencers.push({
                                _id: new Types.ObjectId(),
                                influencerId: result[0].influencerId,
                                socialMediaUsername: newInfluencer.socialMediaUsername,
                                selectedCampaignContentItem: newInfluencer.selectedCampaignContentItemId,
                                socialMedia: newInfluencer.socialMedia,
                                dateRequest: newInfluencer.dateRequest ?? 'ASAP',
                                postLink: newInfluencer.postLink ?? '',
                                screenshot: newInfluencer.screenshot ?? '',
                                like: newInfluencer.like ?? '',
                                impressions: newInfluencer.impressions ?? '',
                                rating: newInfluencer.rating ?? undefined,
                                adminChecked: newInfluencer.adminChecked ?? undefined,
                                followersNumber: newInfluencer.followersNumber ?? 0,
                                price: newInfluencer.price ?? '0',
                                publicPrice: newInfluencer.publicPrice ?? '0',
                                genres: formattedGenres || [],
                                countries: result[0].countries,
                            });
                        }
                    }
                }
            }

            campaign.markModified('selectInfluencers');
            await campaign.save();

            return {
                code: 200,
                message: 'Campaign updated',
            };
        } catch (err) {
            this.logger.error(
                `Error saving campaign: ${err}`,
                err instanceof Error ? err.stack : undefined,
            );
            return {
                code: 500,
                message: err.message || 'Internal server error',
            };
        }
    }

    async adminUpdateCampaignUpdateFromCampaignsPage(data: AdminUpdateCampaignDto) {
        try {
            if (!data) {
                return {
                    status: 400,
                    message: 'Not enough arguments',
                };
            }

            let checkCampaign =
                (await this.promosModel.findOne({_id: data._id})) ||
                (await this.promosCopiesModel.findOne({_id: data._id}));

            if (!checkCampaign) {
                return {
                    code: 404,
                    message: 'Promo not found',
                };
            }

            const updatedCampaign =
                (await this.promosModel.findOneAndUpdate(
                    {_id: data._id},
                    {
                        ...data,
                    },
                )) ||
                (await this.promosCopiesModel.findOneAndUpdate(
                    {_id: data._id},
                    {
                        ...data,
                    },
                ));

            return {
                code: 200,
                message: 'Campaign updated',
            };
        } catch (err) {
            console.error(err);
            return {
                status: 500,
                message: err,
            };
        }
    }

    async adminGivePartialRefundToClient(userId: string, partialRefund: number, campaignId: string) {
        try {
            let campaign =
                (await this.promosModel.findOne({_id: campaignId})) ||
                (await this.promosCopiesModel.findOne({_id: campaignId}));

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

    async adminAddInfluencerToTempList(
        campaignId: string,
        socialMediaUsername: string,
        socialMedia: string,
    ) {
        if (!campaignId || !socialMediaUsername) {
            return {
                code: 400,
                message: 'Not enough arguments',
            };
        }

        try {
            let campaign =
                (await this.promosModel.findOne({_id: campaignId})) ||
                (await this.promosCopiesModel.findOne({_id: campaignId})) ||
                (await this.proposalCampaignModel.findOne({_id: campaignId}));

            if (!campaign) {
                return {
                    code: 404,
                    message: 'Campaign not found',
                };
            }

            const influencer = await this.influencerModel.findOne({
                [`${socialMedia}.instagramUsername`]: {$regex: `^${socialMediaUsername}$`, $options: 'i'},
            });

            if (!influencer) {
                return {
                    code: 404,
                    message: 'Influencer not found',
                };
            }

            const socialMediaAccount = influencer[socialMedia].find(
                (acc) => acc.instagramUsername === socialMediaUsername,
            );

            if (!socialMediaAccount)
                return {
                    code: 404,
                    message: 'Influencer not found',
                };

            const influencerObj = {
                _id: new Types.ObjectId(),
                influencerId: influencer._id,
                socialMediaUsername: socialMediaAccount.instagramUsername,
                followersNumber: socialMediaAccount.followersNumber ?? 0,
                price: socialMediaAccount.price,
                publicPrice: socialMediaAccount.publicPrice,
                socialMedia: socialMedia,
                confirmation: 'wait',
                selectedCampaignContentItemId: null,
                selectedCampaignContentItem: {
                    _id: '',
                    videoLink: '',
                    postDescription: '',
                    storyTag: '',
                    swipeUpLink: '',
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

    async adminSendWhatsAppMessageToInfluencer(data: AdminSendWhatsappMessageDto) {
        try {
            if (!data.message) {
                return {
                    code: 400,
                    message: 'Invalid message',
                };
            }

            const influencer = await this.influencerModel.findOne({_id: data.influencerId});

            if (!influencer) {
                return {
                    code: 404,
                    message: 'Influencer not found',
                };
            }

            const phoneNumber = influencer.phone?.replace(/\D/g, '');
            if (!phoneNumber) {
                return {
                    code: 400,
                    message: 'Phone number is missing for this influencer',
                };
            }

            const res = await axios.post(`https://api.botassium.com/webhook/GPAqBGdAB94vzfxNaZg2`, {
                action: 'send-message',
                type: 'text',
                content: data.message,
                phone: phoneNumber,
            });

            if (res.status === 200) {
                this.appGateway.sendWhatsappMessageStatusUpdate(data.socketId, {
                    phone: phoneNumber,
                    status: 'sent',
                    usernames: [data.networkUsername],
                    campaignId: data.campaignId,
                    date: new Date().toLocaleString(),
                });
                return {
                    code: 200,
                    message: 'Message sent successfully',
                };
            } else {
                this.appGateway.sendWhatsappMessageStatusUpdate(data.socketId, {
                    phone: phoneNumber,
                    status: 'error',
                    usernames: [data.networkUsername],
                    campaignId: data.campaignId,
                    date: new Date().toLocaleString(),
                });
                this.logger.error(`Failed to send WhatsApp message:`);
                return {
                    code: 500,
                    message: 'Error occurred',
                };
            }
        } catch (err) {
            this.logger.error(
                `Failed to send WhatsApp message:`,
                err instanceof Error ? err.stack : undefined,
            );
            return {
                code: 500,
                message: 'Internal server error',
                error: err.message || err,
            };
        }
    }

    async adminSendWhatsAppMessageToEachInfluencer(campaignId: string, socketId: string) {
        try {
            if (!campaignId) {
                return {code: 400, message: 'Invalid Campaign Id'};
            }

            const campaign = await this.promosModel.findById(campaignId);
            if (!campaign) {
                return {code: 404, message: 'Campaign not found'};
            }

            const errorsList: string[] = [];
            const successList: string[] = [];

            const influencerMap: Map<
                string,
                {
                    phone: string;
                    firstName: string;
                    accounts: {
                        username: string;
                        socialMedia: string;
                        reward: string;
                        selectedCampaignContentItemId: string;
                    }[];
                }
            > = new Map();

            for (const item of campaign.selectInfluencers) {
                const influencerFromDb = await this.influencerModel.findById(item.influencerId);

                if (!influencerFromDb?.phone?.trim()) {
                    errorsList.push(`Can't find ${item.socialMediaUsername}'s phone number!`);
                    continue;
                }

                const phone = influencerFromDb.phone.replace(/\D/g, '');
                const firstName = influencerFromDb.firstName ?? 'there';

                if (!influencerMap.has(phone)) {
                    influencerMap.set(phone, {phone, firstName, accounts: []});
                }

                influencerMap.get(phone)!.accounts.push({
                    username: item.socialMediaUsername,
                    socialMedia: item.socialMedia,
                    reward: item.price,
                    selectedCampaignContentItemId: item.selectedCampaignContentItem,
                });
            }

            const messagesToSend = Array.from(influencerMap.values());

            if (messagesToSend.length === 0) {
                throw new Error('No influencers to message.');
            }

            for (let i = 0; i < messagesToSend.length; i++) {
                if (i !== 0) {
                    const delayMs = Math.floor(Math.random() * (15 - 5 + 1) + 5) * 1000;
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }

                const {phone, firstName, accounts} = messagesToSend[i];

                const accountsAndDetails = accounts.map((account) => {
                    const contentItem = campaign.campaignContent.find(
                        (item) => item._id.toString() === account.selectedCampaignContentItemId,
                    );

                    if (!contentItem) {
                        this.logger.error(
                            `Can't find campaignContentItem with id ${account.selectedCampaignContentItemId} for ${account.username}`,
                            new Error().stack,
                        );
                    }

                    return {
                        pageName: account.username,
                        reward: account.reward,
                        socialMedia: account.socialMedia,
                        contentLink: contentItem?.videoLink ?? '',
                        description: contentItem?.postDescription,
                        storyTag: contentItem?.storyTag,
                        storyLink: contentItem?.swipeUpLink,
                        specialRequests: contentItem?.specialWishes,
                    };
                });

                const messageContent = createNewPromoRequestTextMessage({
                    firstName,
                    accountsAndDetails,
                });

                try {
                    await axios.post('https://api.botassium.com/webhook/GPAqBGdAB94vzfxNaZg2', {
                        action: 'send-message',
                        type: 'text',
                        content: messageContent,
                        phone,
                    });

                    successList.push(`Message sent successfully to ${phone}!`);

                    this.appGateway.sendWhatsappMessageStatusUpdate(socketId, {
                        phone,
                        status: 'sent',
                        usernames: accounts.map((a) => a.username),
                        campaignId,
                        date: new Date().toLocaleString(),
                    });
                } catch (err: any) {
                    errorsList.push(`Error sending message to ${phone}!`);

                    this.appGateway.sendWhatsappMessageStatusUpdate(socketId, {
                        phone,
                        status: 'error',
                        error: err.message,
                        usernames: accounts.map((a) => a.username),
                        campaignId,
                        date: new Date().toLocaleString(),
                    });
                }
            }

            return {
                code: 200,
                successList,
                errorList: errorsList,
            };
        } catch (err) {
            this.logger.error(
                `Failed to send WhatsApp messages for each influencer: ${err}`,
                err instanceof Error ? err.stack : undefined,
            );
            return {
                code: 500,
                message: 'Internal server error',
                error: err.message || null,
            };
        }
    }

    async adminConvertCampaignToMultipromo(campaignId: string) {
        try {
            const updated = await this.promosModel.findByIdAndUpdate(
                campaignId,
                {
                    $set: {
                        socialMedia: 'multipromo',
                        shareLink: `${process.env.SERVER_CLIENT}/promo-share/${campaignId}/multipromo`,
                    },
                },
                {new: true},
            );

            if (!updated) {
                return {code: 404, message: 'Campaign not found'};
            }

            return {
                code: 200,
                message: 'Campaign converted to multipromo',
            };
        } catch (err) {
            this.logger.error(`Failed to convert campaign ${campaignId}`, err);
            return {
                code: 500,
                message: 'Internal server error',
                error: err?.message || null,
            };
        }
    }

    async adminSendMailToInfluencer(data: AdminSendMailToInfluencerDto) {
        try {
            const {campaignId, selectInfluencersAccountId} = data;

            const campaign = await this.promosModel.findById(campaignId).lean();

            if (!campaign) {
                return {
                    code: 404,
                    message: `Campaign ${campaignId} not found`,
                };
            }

            const selectInfluencersItem = campaign.selectInfluencers.find(
                (item) => item._id.toString() === selectInfluencersAccountId,
            );

            if (!selectInfluencersItem) {
                throw new Error(`Can't find selectInfluencers account ${selectInfluencersAccountId}`);
            }

            const influencer = await this.influencerModel.findById(selectInfluencersItem.influencerId).lean();

            if (!influencer) {
                this.logger.error(
                    `Can't find influencer ${selectInfluencersItem.influencerId}`,
                    new Error().stack,
                );
                return {
                    code: 404,
                    message: `Influencer not found`,
                };
            }

            if (!influencer.email) {
                this.logger.error(
                    `Invalid email address: ${influencer._id} - ${influencer.firstName} - ${influencer.email}`,
                    new Error().stack,
                );
                return {
                    code: 422,
                    message: 'Invalid email address',
                };
            }

            const influencerAccounts = campaign.selectInfluencers.filter(
                (acc) => acc.influencerId === selectInfluencersItem.influencerId,
            );

            const isSameDate = (a: Date, b: Date): boolean =>
                new Date(a).getTime() === new Date(b).getTime();

            const originalAccounts = influencerAccounts.filter((acc) =>
                isSameDate(acc.createdAt, campaign.createdAt),
            );

            const laterAccounts = influencerAccounts.filter((acc) =>
                !isSameDate(acc.createdAt, campaign.createdAt),
            );

            const mapToPromoAccountObject = (
                acc: any,
                campaignContent: any,
            ): AccountObjectForCreateNewPromoRequestMessage => ({
                pageName: acc.socialMediaUsername,
                reward: acc.price,
                socialMedia: acc.socialMedia,
                contentLink: campaignContent?.videoLink ?? '',
                description: campaignContent?.postDescription,
                storyTag: campaignContent?.storyTag,
                storyLink: campaignContent?.swipeUpLink,
                specialRequests: campaignContent?.specialWishes,
            });

            if (originalAccounts.length > 0) {
                const promoObjects = originalAccounts.map((acc) => {
                    const content = campaign.campaignContent.find(
                        (c) => c._id.toString() === acc.selectedCampaignContentItem,
                    );
                    return mapToPromoAccountObject(acc, content);
                });

                const message = createNewPromoRequestHTMLMessage({
                    firstName: influencer.firstName,
                    accountsAndDetails: promoObjects,
                });

                await sendMail(influencer.email, 'New Promo Request', message, 'html');
            }

            for (const acc of laterAccounts) {
                const content = campaign.campaignContent.find(
                    (c) => c._id.toString() === acc.selectedCampaignContentItem,
                );

                const message = createNewPromoRequestHTMLMessage({
                    firstName: influencer.firstName,
                    accountsAndDetails: [mapToPromoAccountObject(acc, content)],
                });

                await sendMail(influencer.email, 'New Promo Request', message, 'html');
            }

            return {
                code: 201,
                message: 'Mail(s) sent!',
            };
        } catch (err) {
            this.logger.error(
                `Failed to send email to influencer: ${err}`,
                err instanceof Error ? err.stack : undefined,
            );
            return {
                code: 500,
                message: 'Internal server error',
                error: err.message || null,
            };
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

            const instagram = influencer.instagram.find(
                (insta) => insta.instagramUsername === instagramUsername,
            );

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

    async adminAddNewBrandsToInfluencerAccount(data: AddSocialMediasDto) {
        let errors = [];

        if (!data) {
            errors.push('Not enough arguments');
            return {
                code: 400,
                message: 'Not enough arguments',
                errors,
            };
        }

        const influencer = await this.influencerModel.findOne({_id: data.influencerId});

        if (!influencer) {
            errors.push('User not found');
            return {
                code: 404,
                message: 'User not found',
                errors,
            };
        }

        const socialNetworks = [
            'instagram',
            'tiktok',
            'spotify',
            'soundcloud',
            'facebook',
            'youtube',
            'press',
        ];

        for (const network of socialNetworks) {
            const accounts = data[network] || [];
            const usernames = accounts.map((item) => item.instagramUsername);

            const networkFilter = {
                [`${network}.instagramUsername`]: {$in: usernames},
                isDeleted: {$ne: true},
            };

            const isUsernameUsed = await this.influencerModel.exists(networkFilter);
            if (isUsernameUsed) {
                errors.push(`This ${network} username already exists`);
                return {
                    code: 409,
                    message: `This ${network} username already exists`,
                    errors,
                };
            }
        }

        for (const network of socialNetworks) {
            const accounts = data[network] || [];
            const socialMediaAccounts = influencer[network] || [];

            try {
                for (const account of accounts) {
                    const sanitizedPrice = parseFloat(String(account.price).replace(/[^\d.-]/g, '')) || 0;
                    const sanitizedInitialPrice = parseInt(String(account.initialPrice).replace(/[^\d.-]/g, '')) || 0
                    const publicPrice = (sanitizedPrice * 2).toString();
                    const accountId = new mongoose.Types.ObjectId();

                    socialMediaAccounts.push({
                        ...account,
                        ...(account.profileCategory === "creator" && {
                            creatorCategories: account.creatorCategories ?? [],
                        }),
                        followersNumber: account.followersNumber.replace(/[.,]/g, ''),
                        publicPrice: publicPrice,
                        currency: account.currency ?? "EUR",
                        initialPrice: sanitizedInitialPrice,
                        isHidden: false,
                        isDeleted: false,
                        isVerified: true,
                        _id: accountId,
                    });

                    influencer[network] = socialMediaAccounts;
                }
            } catch (err) {
                console.error('Error adding social media account:', err);
                errors.push(`Error adding ${network} account. ${err}`);
            }
        }

        if (errors.length > 0) {
            return {
                code: 500,
                message: 'Internal server error',
                errors,
            };
        } else {
            await influencer.save();
            return {
                code: 200,
                message: 'Social media accounts added successfully',
            };
        }
    }

    async adminImportXlsxInfluencers(data: AdminImportXlsxInfluencersDto) {
        if (!data.influencers) return {
            code: 400,
            message: 'Empty accounts array',
        }

        try {
            const accountsFromDataMap: Map<
                string,
                {
                    email: string;
                    password: string;
                    phone: string;
                    firstName: string;
                    username: string;
                    link: string;
                    price: number;
                    followersNumber: number;
                    engagementRate: number | string | null;
                    averageViews: number | null;
                    countries: CountryObj[];
                    creatorCategories?: string[];
                }[]
            > = new Map();

            let createdCount = 0;
            let updatedCount = 0;
            let errors = [];

            for (const account of data.influencers) {
                const {email} = account;

                if (!accountsFromDataMap.has(email)) {
                    accountsFromDataMap.set(email, [account]);
                } else {
                    accountsFromDataMap.get(email)!.push(account);
                }
            }

            for (const [email, accountsFromData] of accountsFromDataMap.entries()) {
                try {
                    const influencerInDatabase = await this.influencerModel.findOne({email: email});

                    const accountsToSave = accountsFromData.map(item => ({
                        _id: new Types.ObjectId(),
                        profileCategory: "creator" as const,
                        musicStyle: "Techno",
                        musicSubStyles: ["Hard, Peak", "Melodic, Minimal", "Tech House", "Melodic, Afro"],
                        musicStyleOther: ["House", "EDM", "D&B", "Bass", "Psy, Trance", "Dubstep"],
                        instagramUsername: item.username,
                        instagramLink: item.link,
                        followersNumber: item.followersNumber.toString(),
                        logo: "https://dl.dropboxusercontent.com/scl/fi/c5ibdvebsopuz6ydi5l3t/2025-07-29T15-50-59.661Zdefault-avatar-profile-icon-social-600nw-1677509740.webp?rlkey=55mdiffm86fhrks7263e8sfrr&dl=0",
                        price: item.price.toString(),
                        publicPrice: (item.price * 2).toString(),
                        currency: "EUR",
                        initialPrice: item.price,
                        countries: item.countries,
                        categories: [],
                        engagementRate: item.engagementRate !== null ? Number(item.engagementRate) : null,
                        averageViews: item.averageViews ?? null,
                        creatorCategories: item.creatorCategories || [],
                        isHidden: false,
                        isDeleted: false,
                        isVerified: true
                    }));

                    if (influencerInDatabase) {
                        const existingTiktokAccounts = influencerInDatabase.tiktok || [];

                        const newUniqueAccounts = accountsToSave.filter(newAcc => {
                            return !existingTiktokAccounts.some(existingAcc =>
                                existingAcc.instagramUsername === newAcc.instagramUsername
                            );
                        });

                        if (newUniqueAccounts.length > 0) {
                            influencerInDatabase.tiktok.push(...newUniqueAccounts);
                            await influencerInDatabase.save();
                            updatedCount += newUniqueAccounts.length;
                        }
                    } else {
                        await this.influencerModel.create({
                            _id: new Types.ObjectId(),
                            email: email,
                            phone: accountsFromData[0]?.phone || "",
                            password: bcrypt.hashSync(accountsFromData[0].password),
                            firstName: accountsFromData[0].firstName,
                            role: "influencer",
                            balance: "0",
                            statusVerify: "accept",
                            instagram: [],
                            tiktok: accountsToSave,
                            spotify: [],
                            soundcloud: [],
                            facebook: [],
                            youtube: [],
                            press: []
                        })
                        createdCount += accountsToSave.length;
                    }
                } catch (err) {
                    this.logger.warn(`${err}`, err instanceof Error ? err.stack : new Error().stack);
                    errors.push(`[${email}] - [${accountsFromData.map(acc => accountsFromData[accountsFromData.length - 1].username === acc.username ? `${acc.username}` : `${acc.username}, `)}] Error adding social media accounts:`, err);
                }
            }

            return {
                code: 201,
                message: "Successfully imported",
                createdCount,
                updatedCount,
                errors
            }
        } catch (err) {
            this.logger.error(
                `Unexpected error: ${err}`,
                err instanceof Error ? err.stack : new Error().stack,
            )
            return {
                code: 500,
                message: 'Internal server error',
            }
        }
    }

    async adminAddCreatedAtFieldToSelectInfluencersInCampaign() {
        const campaigns = await this.promosModel.find({
            'selectInfluencers.createdAt': {$exists: false},
        });

        for (const campaign of campaigns) {
            const campaignCreatedAt = campaign.createdAt ? new Date(campaign.createdAt) : new Date();

            for (let i = 0; i < campaign.selectInfluencers.length; i++) {
                const influencer = campaign.selectInfluencers[i];
                if (!influencer.createdAt) {
                    await this.promosModel.updateOne(
                        {_id: campaign._id, 'selectInfluencers._id': influencer._id},
                        {$set: {'selectInfluencers.$.createdAt': campaignCreatedAt}},
                    );
                }
            }
        }

        this.logger.debug(`Added 'createdAt' field to ${campaigns.length} campaigns`);
    }

    async adminDeleteYesterdayAccounts() {
        try {
            const start = new Date("2025-08-18T00:00:00.000Z");
            const end = new Date("2025-08-18T23:59:59.999Z");

            const result = await this.influencerModel.deleteMany({
                createdAt: {$gte: start, $lte: end},
            });

            return {
                code: 200,
                message: `Deleted ${result.deletedCount} accounts created on 2025-08-18`,
            };
        } catch (err) {
            this.logger.error(
                `Unexpected error: ${err}`,
                err instanceof Error ? err.stack : new Error().stack,
            );
            return {
                code: 500,
                message: 'Internal server error',
            };
        }
    }
}
