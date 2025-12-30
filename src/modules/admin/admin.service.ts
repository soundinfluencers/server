import {BadRequestException, ConflictException, Injectable, Logger, NotFoundException} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Campaign, CampaignContentItem} from '../../database/schemas/campaign/campaign.schema';
import mongoose, {Types} from 'mongoose';
import {AdminUpdatePersonalClientDto} from './dto/admin-update-client.dto';
import {AdminUpdateInfluencerPersonalDto} from './dto/admin-update-influencer-personal.dto';
import {AdminUpdateInfluencerInstagramDto} from './dto/admin-update-influencer-instagram.dto';
import {Invoices} from '../invoice/schemas/invoices.schema';
import {AdminUpdateInfluencerInvoiceDto} from './dto/admin-update-influencer-invoice.dto';
import {Payment} from '../payment/schemas/payment.entity';
import {AdminUpdateClientPayment} from './dto/admin-update-client-payment.update';
import {AdminUpdateCampaignDto} from './dto/admin-update-promo.dto';
import {AdminSendWhatsappMessageDto} from './dto/admin-send-whatsapp-message.dto';
import {AdminUpdateInfluencerFullAccountDto} from './dto/admin-update-influencer-full-account.dto';
import {AdminUpdateFullCampaignDto} from './dto/admin-update-full-campaign';
import axios from 'axios';
import * as process from 'node:process';
import {AdminSendMailToInfluencerDto} from './dto/admin-send-mail-to-influencer.dto';
import {AppGateway} from '../websocket/app.gateway';
import sendMail from "../../integrations/nodemailer/nodemailer";
import {
    AccountObjectForCreateNewPromoRequestMessage, createNewPromoRequestHTMLMessage,
    createNewPromoRequestTextMessage
} from "../../common/utils/new-promo-message";
import {Client} from "../../database/schemas/users/client.schema";
import {Influencer} from "../../database/schemas/users/influencer.schema";
import {CompletedCampaign} from "../../database/schemas/campaign/completed-campaign.schema";
import {returnMusicStyles} from "../../common/utils/genres";
import {AddSocialMediasDto} from "../profile/dto/update-influencer.dto";
import {ProposalCampaign} from "../../database/schemas/campaign/proposal-campaign.schema";

const fs = require('fs');
const PDFDocument = require('pdfkit');
const bcrypt = require('bcryptjs');

@Injectable()
export class AdminService {
    private readonly logger = new Logger();

    constructor(
        @InjectModel(Campaign.name)
        private campaignsModel: mongoose.Model<Campaign>,
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
        @InjectModel(Invoices.name)
        private invoicesModel: mongoose.Model<Invoices>,
        @InjectModel(Payment.name)
        private paymentModel: mongoose.Model<Payment>,
        @InjectModel(CompletedCampaign.name)
        private completedCampaignModel: mongoose.Model<CompletedCampaign>,
        @InjectModel(ProposalCampaign.name)
        private proposalCampaignModel: mongoose.Model<ProposalCampaign>,
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
                    const clientOngoingCampaigns = await this.campaignsModel
                        .find({clientId: client.id})
                        .sort({createdAt: -1});
                    const clientCompletedCampaigns = await this.completedCampaignModel
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

            const promoData = await this.campaignsModel
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
            const [campaigns, campaignsCopies] = await Promise.all([
                this.campaignsModel.find().sort({createdAt: -1}).lean().exec(),
                this.completedCampaignModel.find().sort({createdAt: -1}).lean().exec(),
            ]);

            if ((!campaigns?.length) && (!campaignsCopies?.length)) {
                return {
                    status: 404,
                    message: 'No promos found',
                };
            }

            const resultCampaigns = await Promise.all(
                campaigns.map(async (campaign) => {
                    let totalFollowers = 0;

                    if (Array.isArray(campaign.selectInfluencers) && !campaign.isCopy) {
                        campaign.selectInfluencers.forEach((item) => {
                            const followersCount = item.followersNumber ?? 0;
                            totalFollowers += followersCount || 0;

                            const cleanedPrice = item.price?.replace(/\D/g, '') ?? "0";
                            const cleanedPublicPrice = item.publicPrice?.replace(/\D/g, '') ?? "0";

                            Object.assign(item, {
                                price: parseInt(cleanedPrice, 10) || 0,
                                publicPrice: parseInt(cleanedPublicPrice, 10) || 0,
                            });
                        });
                    }

                    return {
                        _id: campaign._id,
                        campaignName: campaign.campaignName,
                        userId: campaign.clientId,
                        selectInfluencers: campaign.selectInfluencers,
                        amount: campaign.campaignPrice || (campaign as any).amount,
                        socialMedia: campaign.socialMedia ?? 'instagram',
                        totalFollowers,
                        statusPromo: campaign.statusCampaign,
                        verifyPromo: campaign.verifyCampaign,
                        shareLink: campaign.shareLink,
                        isCopy: campaign.isCopy ?? true,
                        createdAt: campaign.createdAt,
                    };
                }),
            );

            const resultCampaignsCopies = campaignsCopies.map((campaign) => ({
                _id: campaign._id,
                campaignName: campaign.campaignName,
                userId: campaign.clientId || (campaign as any).userId,
                selectInfluencers: campaign.selectInfluencers,
                amount: campaign.campaignPrice || (campaign as any).amount,
                socialMedia: campaign.socialMedia ?? 'instagram',
                statusPromo: campaign.statusCampaign || (campaign as any).statusPromo,
                verifyPromo: campaign.verifyCampaign || (campaign as any).verifyPromo,
                shareLink: campaign.shareLink,
                isCopy: campaign.isCopy ?? true,
                createdAt: campaign.createdAt,
            }));

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
                (await this.campaignsModel.findOne({_id: promoId})) ||
                (await this.completedCampaignModel.findOne({_id: promoId}));

            if (!promo) {
                return {
                    status: 404,
                    message: 'Promo not found',
                };
            }

            (await this.campaignsModel.deleteOne({_id: promoId})) ||
            (await this.completedCampaignModel.deleteOne({_id: promoId}));

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
                (await this.campaignsModel.findOne({_id: campaignId})) ||
                (await this.completedCampaignModel.findOne({_id: campaignId}));

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

        const campaign = await this.campaignsModel.findOne({_id: campaignId}).lean().exec();

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
                                accountId: socialMediaAccountProfile._id ?? null,
                                socialMediaUsername:
                                    influencer.socialMediaUsername || (influencer as any).instagramUsername,
                                confirmation: influencer.confirmation,
                                socialMedia: influencer.socialMedia,
                                closePromo: 'close',
                                price: cleanedPrice,
                                publicPrice: cleanedPublicPrice,
                                selectedContent:
                                    influencer.selectedContent || (influencer as any).selectedVideo,
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

        await this.completedCampaignModel.create({
            ...campaign,
            _id: campaign._id,
            campaignContent: campaign.campaignContent || (campaign as any).videos,
            campaignPrice: campaign.campaignPrice || (campaign as any).amount,
            statusCampaign: 'finally',
            selectInfluencers: selectInfluencers,
            totalFollowers: totalFollowers,
            isCopy: true,
        });

        await this.campaignsModel.deleteOne({_id: campaignId});

        return {
            status: 201,
            message: 'Promo closed successfully',
        };
    }

    async adminReopenCampaign(campaignId: string) {
        if (!campaignId) {
            return {
                code: 400,
                message: 'Not enough arguments',
            };
        }

        const campaign = await this.completedCampaignModel.findOne({ _id: campaignId }).lean().exec();

        if (!campaign) {
            return {
                code: 404,
                message: 'Campaign not found',
            };
        }

        const session = await this.campaignsModel.db.startSession();
        session.startTransaction();

        try {
            const campaignToCreate: Campaign = {
                ...campaign,
                statusCampaign: 'work',
                isCopy: false,
            };

            const [createdCampaign] = await this.campaignsModel.create([campaignToCreate], { session });

            const newShareLink = `${process.env.SERVER_CLIENT}/promo-share/${createdCampaign._id}/${createdCampaign.socialMedia}`;

            await this.campaignsModel.findByIdAndUpdate(
                createdCampaign._id,
                { shareLink: newShareLink },
                { session },
            );

            await this.completedCampaignModel.deleteOne({ _id: campaignId }, { session });

            await session.commitTransaction();
            session.endSession();

            return { code: 201, campaignId: createdCampaign._id };
        } catch (err) {
            await session.abortTransaction();
            session.endSession();

            this.logger.error(
                `Error reopening campaign ${campaign.campaignName} (${campaignId}): ${err}`,
                err instanceof Error ? err.stack : new Error().stack,
            );

            return { code: 500, message: 'Internal server error' };
        }
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
                campaign = await this.campaignsModel.findOne({_id: campaignId}).lean().exec();
                if (!campaign) {
                    campaign = await this.completedCampaignModel.findOne({_id: campaignId}).lean().exec();
                }
            } else {
                campaign = await this.proposalCampaignModel.findOne({_id: campaignId}).lean().exec();
            }

            if (!campaign) {
                return {status: 404, message: 'Promo not found'};
            }

            const campaignToReturn: any = {
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

            const influencerIds = campaign.selectInfluencers.map(acc => acc.influencerId);
            const influencers = await this.influencerModel.find({_id: {$in: influencerIds}}).lean().exec();
            const influencerMap = new Map(influencers.map(inf => [inf._id.toString(), inf]));

            type ContentItemWithIndex = { item: CampaignContentItem; index: number };
            const campaignContentMap: Map<string, ContentItemWithIndex> = new Map(
                (campaign.campaignContent || []).map((c, idx) => [c._id.toString(), {item: c, index: idx}])
            );

            const videosMap: Map<string, any> = new Map(
                (campaign.videos || []).map((v, idx) => [v._id.toString(), {item: v, index: idx}])
            );

            const influencersMap = new Map<
                string,
                { message: string | null; firstName: string; accounts: any[] }
            >();

            for (const addedAccount of campaign.selectInfluencers) {
                const normalizedUsername =
                    addedAccount?.socialMediaUsername?.trim() || addedAccount?.instagramUsername?.trim() || '';
                const accSocialMedia = addedAccount?.socialMedia || (campaign.socialMedia !== 'multipromo' && campaign.socialMedia);

                campaignToReturn.totalFollowers += addedAccount?.followersNumber ?? 0;
                campaignToReturn.totalImpressions += parseInt(addedAccount.impressions?.replace(/[\s,]/g, '') || '0');
                campaignToReturn.totalLikes += parseInt(addedAccount.like?.replace(/[\s,]/g, '') || '0');

                const selectedCampaignContentItemId =
                    addedAccount?.selectedContent?.campaignContentItemId?.toString() ??
                    addedAccount.selectedCampaignContentItem ??
                    (Array.isArray(campaign?.videos)
                        ? campaign.videos.find(v => v.videoLink === addedAccount?.selectedVideo)?._id?.toString()
                        : null) ?? null;
                const selectedPostDescriptionId = addedAccount?.selectedContent?.postDescriptionId?.toString() ?? undefined;

                let selectedCampaignContentItem = null;
                if (selectedCampaignContentItemId) {
                    const contentItem =
                        campaignContentMap.get(selectedCampaignContentItemId)?.item ||
                        videosMap.get(selectedCampaignContentItemId)?.item ||
                        null;

                    if (contentItem) {
                        selectedCampaignContentItem = {
                            _id: contentItem._id,
                            videoLink: contentItem.videoLink,
                            postDescriptions: contentItem.postDescriptions || [{
                                description: contentItem.postDescription,
                            }],
                            storyTag: contentItem.storyTag || null,
                            storyLink: contentItem.swipeUpLink || null,
                            specialWishes: contentItem.specialWishes,
                            socialMedia: contentItem.socialMedia || 'instagram',
                            socialMediaGroup: contentItem.socialMediaGroup || 'main',
                        };
                    }
                }

                addedAccount.selectedCampaignContentItemId = selectedCampaignContentItemId;
                addedAccount.selectedCampaignContentItem = selectedCampaignContentItem;
                addedAccount.socialMedia = accSocialMedia;
                addedAccount.socialMediaUsername = normalizedUsername;

                if (selectedPostDescriptionId) addedAccount.selectedPostDescriptionId = selectedPostDescriptionId;

                if (!campaign.isCopy && !isProposal) {
                    const isOriginalAccount =
                        new Date(addedAccount.createdAt).getTime() === new Date(campaign.createdAt).getTime();
                    const key = isOriginalAccount ? addedAccount.influencerId : `${addedAccount.influencerId}-${addedAccount._id}`;

                    if (!influencersMap.has(key)) {
                        const influencer = influencerMap.get(addedAccount.influencerId.toString()) || null;
                        const account = influencer?.[addedAccount.socialMedia]?.find(
                            acc => acc.instagramUsername === addedAccount.socialMediaUsername
                        ) ?? null;

                        influencersMap.set(key, {
                            message: null,
                            firstName: influencer?.firstName ?? '',
                            accounts: [
                                {
                                    pageName: addedAccount.socialMediaUsername,
                                    dateRequest: addedAccount.dateRequest,
                                    reward: `${account?.initialPrice ?? addedAccount.price?.replace(/\D/g, '')}${account?.currency ?? 'EUR'}`,
                                    socialMedia: addedAccount.socialMedia,
                                    contentLink: addedAccount.selectedCampaignContentItem?.videoLink ?? '',
                                    description: addedAccount.selectedCampaignContentItem?.postDescriptions?.find(i => i._id.toString() === selectedPostDescriptionId)?.description ?? null,
                                    storyTag: addedAccount.selectedCampaignContentItem?.storyTag,
                                    storyLink: addedAccount.selectedCampaignContentItem?.storyLink,
                                    specialRequests: addedAccount.selectedCampaignContentItem?.specialWishes,
                                },
                            ],
                        });
                    } else {
                        influencersMap.get(key)?.accounts.push({
                            pageName: addedAccount.socialMediaUsername,
                            dateRequest: addedAccount.dateRequest,
                            reward: `${addedAccount.initialPrice ?? addedAccount.price?.replace(/\D/g, '')}${addedAccount.currency ?? 'EUR'}`,
                            socialMedia: addedAccount.socialMedia,
                            contentLink: addedAccount.selectedCampaignContentItem?.videoLink ?? '',
                            description: addedAccount.selectedCampaignContentItem?.postDescriptions?.find(i => i._id.toString() === selectedPostDescriptionId)?.description ?? null,
                            storyTag: addedAccount.selectedCampaignContentItem?.storyTag,
                            storyLink: addedAccount.selectedCampaignContentItem?.storyLink,
                            specialRequests: addedAccount.selectedCampaignContentItem?.specialWishes,
                        });
                    }
                }

                campaignToReturn.addedAccounts.push(addedAccount);
            }

            if (!campaign.isCopy) {
                for (const account of campaignToReturn.addedAccounts) {
                    const isOriginalAccount =
                        new Date(account.createdAt).getTime() === new Date(campaignToReturn.createdAt).getTime();
                    const key = isOriginalAccount ? account.influencerId : `${account.influencerId}-${account._id}`;
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
                const aIndex = campaignContentMap.get(a.selectedCampaignContentItemId)?.index ??
                    videosMap.get(a.selectedCampaignContentItemId)?.index ?? -1;
                const bIndex = campaignContentMap.get(b.selectedCampaignContentItemId)?.index ??
                    videosMap.get(b.selectedCampaignContentItemId)?.index ?? -1;
                return aIndex - bIndex;
            });

            return {status: 200, campaign: campaignToReturn};
        } catch (err) {
            console.error(err);
            return {status: 500, message: err.message || 'Internal server error'};
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
                    (await this.campaignsModel.findById(campaignId)) ||
                    (await this.completedCampaignModel.findById(campaignId));
            } else {
                campaign = await this.proposalCampaignModel.findById(campaignId);
            }

            if (!campaign) {
                return {
                    code: 404,
                    message: 'No campaign found',
                };
            }

            // Обновление основных данных кампании
            campaign.campaignName = campaignName.trim() ?? campaign.campaignName;
            campaign.isPriceHidden = isPriceHidden ?? campaign.isPriceHidden;
            campaign.isCpmAndResultHidden = isCpmAndResultHidden ?? campaign.isCpmAndResultHidden;
            campaign.hiddenColumns = hiddenColumns || [];
            campaign.campaignContent = campaignContent;

            // Обновление цены
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
                    account.selectedContent = thisAccountFromData.selectedContent;
                    account.dateRequest = thisAccountFromData?.dateRequest ?? (account.dateRequest || 'ASAP');
                    account.postLink = thisAccountFromData?.postLink ?? (account.postLink || '');
                    account.screenshot = thisAccountFromData?.screenshot ?? (account.screenshot || '');
                    account.like = thisAccountFromData?.like ?? (account.like || '');
                    account.impressions = thisAccountFromData?.impressions ?? (account.impressions || '');
                    account.rating = thisAccountFromData?.rating ?? (account.rating || undefined);
                    account.adminChecked = thisAccountFromData?.adminChecked ?? (account.adminChecked || undefined);
                }

                return true;
            });

            if (!isProposalCampaign) {
                await Promise.all(
                    addedInfluencers.map(async (newInfluencer) => {
                        const id = newInfluencer._id.toString();

                        // Проверка на существование аккаунта в обьекте кампании из базы данных (если нет - добавить)
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
                                    accountId: null,
                                    socialMediaUsername: newInfluencer.socialMediaUsername,
                                    selectedContent: newInfluencer.selectedContent,
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

                    // Проверка на существование аккаунта в обьекте кампании из базы данных (если нет - добавить)
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
                            const formattedGenres = returnMusicStyles(
                                result[0].musicStyle,
                                result[0].musicStyleOther,
                                result[0].musicSubStyles,
                            );

                            campaign.totalFollowers += parseInt(result[0].followersNumber);
                            campaign.selectInfluencers.push({
                                _id: new Types.ObjectId(),
                                influencerId: result[0].influencerId,
                                socialMediaUsername: newInfluencer.socialMediaUsername,
                                selectedContent: newInfluencer.selectedContent,
                                socialMedia: newInfluencer.socialMedia,
                                dateRequest: newInfluencer.dateRequest ?? 'ASAP',
                                postLink: newInfluencer.postLink ?? '',
                                screenshot: newInfluencer.screenshot ?? '',
                                like: newInfluencer.like ?? '',
                                impressions: newInfluencer.impressions ?? '',
                                rating: newInfluencer.rating ?? undefined,
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
                (await this.campaignsModel.findOne({_id: data._id})) ||
                (await this.completedCampaignModel.findOne({_id: data._id}));

            if (!checkCampaign) {
                return {
                    code: 404,
                    message: 'Promo not found',
                };
            }

            const updatedCampaign =
                (await this.campaignsModel.findOneAndUpdate(
                    {_id: data._id},
                    {
                        ...data,
                    },
                )) ||
                (await this.completedCampaignModel.findOneAndUpdate(
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
                (await this.campaignsModel.findOne({_id: campaignId})) ||
                (await this.completedCampaignModel.findOne({_id: campaignId}));

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
                (await this.campaignsModel.findOne({_id: campaignId})) ||
                (await this.completedCampaignModel.findOne({_id: campaignId})) ||
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
                selectedContent: null,
                selectedCampaignContentItemId: null,
                selectedPostDescriptionId: null,
                selectedCampaignContentItem: {
                    _id: '',
                    videoLink: '',
                    postDescription: '',
                    storyTag: '',
                    swipeUpLink: '',
                    specialWishes: '',
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

            const campaign = await this.campaignsModel.findById(campaignId);
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
                        selectedContent: {
                            campaignContentItemId: Types.ObjectId;
                            postDescriptionId: Types.ObjectId;
                        };
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
                    selectedContent: item.selectedContent,
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
                        (item) => item._id.toString() === account.selectedContent.campaignContentItemId.toString(),
                    );
                    const postDescription = contentItem.postDescriptions.find(pd => pd._id.toString() === account.selectedContent.postDescriptionId.toString())?.description ?? "";

                    if (!contentItem) {
                        this.logger.error(
                            `Can't find campaignContentItem with id ${account.selectedContent.campaignContentItemId} for ${account.username}`,
                            new Error().stack,
                        );
                    }

                    return {
                        pageName: account.username,
                        reward: account.reward,
                        socialMedia: account.socialMedia,
                        contentLink: contentItem?.videoLink ?? '',
                        description: postDescription,
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
                errorsList,
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
            const updated = await this.campaignsModel.findByIdAndUpdate(
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

            const campaign = await this.campaignsModel.findById(campaignId).lean();

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
                description: null,
                storyTag: campaignContent?.storyTag,
                storyLink: campaignContent?.swipeUpLink,
                specialRequests: campaignContent?.specialWishes,
            });

            if (originalAccounts.length > 0) {
                const promoObjects = originalAccounts.map((acc) => {
                    const content = campaign.campaignContent.find(
                        (c) => c._id === acc.selectedContent.campaignContentItemId,
                    );
                    return mapToPromoAccountObject(acc, {
                        ...content,
                        postDescription: content.postDescriptions.find(pd => pd._id === acc.selectedContent.postDescriptionId)?.description ?? ""
                    });
                });

                const message = createNewPromoRequestHTMLMessage({
                    firstName: influencer.firstName,
                    accountsAndDetails: promoObjects,
                });

                await sendMail(influencer.email, 'New Promo Request', message, 'html');
            }

            for (const acc of laterAccounts) {
                const content = campaign.campaignContent.find(
                    (c) => c._id === acc.selectedContent.campaignContentItemId,
                );

                const message = createNewPromoRequestHTMLMessage({
                    firstName: influencer.firstName,
                    accountsAndDetails: [mapToPromoAccountObject(acc, {
                        ...content,
                        postDescription: content.postDescriptions.find(pd => pd._id === acc.selectedContent.postDescriptionId)?.description ?? ""
                    })],
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
                (insta) => insta.username === instagramUsername,
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

    // async adminImportXlsxInfluencers(data: AdminImportXlsxInfluencersDto) {
    //     if (!data.influencers) return {
    //         code: 400,
    //         message: 'Empty accounts array',
    //     }
    //
    //     try {
    //         const accountsFromDataMap: Map<
    //             string,
    //             {
    //                 email: string;
    //                 password: string;
    //                 phone: string;
    //                 firstName: string;
    //                 username: string;
    //                 link: string;
    //                 price: number;
    //                 initialPrice: number;
    //                 currency: string;
    //                 followersNumber: number;
    //                 engagementRate: number | string | null;
    //                 averageViews: number | null;
    //                 countries: CountryObj[];
    //                 creatorCategories?: string[];
    //             }[]
    //         > = new Map();
    //
    //         let createdCount = 0;
    //         let updatedCount = 0;
    //         let errors = [];
    //
    //         for (const account of data.influencers) {
    //             const {email} = account;
    //
    //             if (!accountsFromDataMap.has(email)) {
    //                 accountsFromDataMap.set(email, [account]);
    //             } else {
    //                 accountsFromDataMap.get(email)!.push(account);
    //             }
    //         }
    //
    //         for (const [email, accountsFromData] of accountsFromDataMap.entries()) {
    //             try {
    //                 const influencerInDatabase = await this.influencerModel.findOne({email: email});
    //
    //                 const accountsToSave: SocialAccount[] = accountsFromData.map(item => ({
    //                     _id: new Types.ObjectId(),
    //                     profileCategory: InfluencerProfileCategory.creator,
    //                     musicGenres: [
    //                         {genre: 'Techno', subGenres: ["Hard, Peak", "Melodic, Minimal"]},
    //                         {genre: 'House', subGenres: ["Tech House", "Melodic, Afro"]},
    //                         {genre: "EDM", subGenres: []},
    //                         {genre: "D&B", subGenres: []},
    //                         {genre: "Bass", subGenres: []},
    //                         {genre: "Psy, Trance", subGenres: []},
    //                         {genre: "Dubstep", subGenres: []},
    //                     ],
    //                     username: item.username,
    //                     profileLink: item.link,
    //                     followers: item.followersNumber,
    //                     logoUrl: "https://dl.dropboxusercontent.com/scl/fi/c5ibdvebsopuz6ydi5l3t/2025-07-29T15-50-59.661Zdefault-avatar-profile-icon-social-600nw-1677509740.webp?rlkey=55mdiffm86fhrks7263e8sfrr&dl=0",
    //                     price: item.price,
    //                     publicPrice: (item.price * 2),
    //                     currency: item.currency,
    //                     initialPrice: item.initialPrice,
    //                     countries: item.countries,
    //                     categories: [],
    //                     engagementRate: item.engagementRate !== null ? Number(item.engagementRate) : null,
    //                     averageViews: item.averageViews ?? null,
    //                     creatorCategories: item.creatorCategories || [],
    //                     isHidden: false,
    //                     isDeleted: false,
    //                     isVerified: true,
    //                     refreshToken: null
    //                 }));
    //
    //                 if (influencerInDatabase) {
    //                     const existingTiktokAccounts = influencerInDatabase.tiktok || [];
    //
    //                     const newUniqueAccounts = accountsToSave.filter(newAcc => {
    //                         return !existingTiktokAccounts.some(existingAcc =>
    //                             existingAcc.username === newAcc.username
    //                         );
    //                     });
    //
    //                     if (newUniqueAccounts.length > 0) {
    //                         influencerInDatabase.tiktok.push(...newUniqueAccounts);
    //                         await influencerInDatabase.save();
    //                         updatedCount += newUniqueAccounts.length;
    //                     }
    //                 } else {
    //                     try {
    //                         await this.influencerModel.create({
    //                             _id: new Types.ObjectId(),
    //                             email: email,
    //                             phone: accountsFromData[0]?.phone || "",
    //                             password: bcrypt.hashSync(accountsFromData[0].password),
    //                             firstName: accountsFromData[0].firstName,
    //                             role: "influencer",
    //                             balance: "0",
    //                             statusVerify: "accept",
    //                             instagram: [],
    //                             tiktok: accountsToSave,
    //                             spotify: [],
    //                             soundcloud: [],
    //                             facebook: [],
    //                             youtube: [],
    //                             press: []
    //                         })
    //                     } catch (e) {
    //                         this.logger.warn(`Error creating influencer with email: ${email}`, e instanceof Error ? e.stack : new Error().stack);
    //                     }
    //                     createdCount += accountsToSave.length;
    //                 }
    //             } catch (err) {
    //                 this.logger.warn(`${err}`, err instanceof Error ? err.stack : new Error().stack);
    //                 errors.push(`[${email}] - [${accountsFromData.map(acc => accountsFromData[accountsFromData.length - 1].username === acc.username ? `${acc.username}` : `${acc.username}, `)}] Error adding social media accounts:`, err);
    //             }
    //         }
    //
    //         return {
    //             code: 201,
    //             message: "Successfully imported",
    //             createdCount,
    //             updatedCount,
    //             errors
    //         }
    //     } catch (err) {
    //         this.logger.error(
    //             `Unexpected error: ${err}`,
    //             err instanceof Error ? err.stack : new Error().stack,
    //         )
    //         return {
    //             code: 500,
    //             message: 'Internal server error',
    //         }
    //     }
    // }

    async adminUpdateCampaignsUpToDate() {
        const campaigns = await this.campaignsModel.find().lean();
        if (!campaigns?.length) return {code: 500, message: 'Ongoing campaigns not found'};

        const influencersMap = new Map<string, {
            _id: Types.ObjectId;
            instagramUsername: string;
            socialMedia: string
        }[]>();

        for (const campaign of campaigns) {
            const videoLinkMap = new Map<string, { _id: Types.ObjectId; description: string }[]>();
            const contentIdToVideoLink = new Map<string, string>();
            const oldContentIdToPostDescriptions = new Map<string, Types.ObjectId[]>();

            // 1. Собираем все postDescriptions по videoLink
            for (const contentItem of (campaign.campaignContent ?? [])) {
                const videoLink = contentItem.videoLink;
                contentIdToVideoLink.set(contentItem._id.toString(), videoLink);

                if (!videoLinkMap.has(videoLink)) {
                    videoLinkMap.set(videoLink, []);
                }

                const postDescriptions: { _id: Types.ObjectId; description: string }[] = [];
                if (Array.isArray(contentItem.postDescriptions) && contentItem.postDescriptions.length) {
                    for (const pd of contentItem.postDescriptions) {
                        const newId = pd._id ? new Types.ObjectId(pd._id) : new Types.ObjectId();
                        postDescriptions.push({
                            _id: newId,
                            description: pd.description ?? '',
                        });
                    }
                } else {
                    const newId = new Types.ObjectId();
                    postDescriptions.push({
                        _id: newId,
                        description: (contentItem as any).postDescription ?? '',
                    });
                }

                // Сохраняем для старого _id все новые _id postDescriptions
                oldContentIdToPostDescriptions.set(contentItem._id.toString(), postDescriptions.map(pd => pd._id));

                // Добавляем к videoLinkMap
                videoLinkMap.get(videoLink)!.push(...postDescriptions);
            }

            // 2. Создаём новые CampaignContentItem
            const videoLinkToContentId = new Map<string, Types.ObjectId>();
            const updatedContent: any[] = [];

            for (const [videoLink, postDescriptions] of videoLinkMap.entries()) {
                const contentItemId = new Types.ObjectId();
                videoLinkToContentId.set(videoLink, contentItemId);

                updatedContent.push({
                    _id: contentItemId,
                    videoLink,
                    postDescriptions,
                    storyTag: campaign.campaignContent.find(c => c.videoLink === videoLink)?.storyTag,
                    swipeUpLink: campaign.campaignContent.find(c => c.videoLink === videoLink)?.swipeUpLink,
                    specialWishes: campaign.campaignContent.find(c => c.videoLink === videoLink)?.specialWishes,
                    socialMedia: campaign.socialMedia,
                    socialMediaGroup: 'main',
                });
            }

            // 3. Обновляем инфлюенсеров с корректным selectedContent
            const updatedInfluencers: any[] = [];
            for (const acc of (campaign.selectInfluencers ?? [])) {
                const key = `${acc.influencerId?.toString?.() ?? acc.influencerId}|${acc.socialMedia}`;
                let accounts = influencersMap.get(key);

                if (!accounts) {
                    try {
                        const aggr = await this.influencerModel.aggregate([
                            {$match: {_id: new Types.ObjectId(acc.influencerId), statusVerify: 'accept'}},
                            {$unwind: `$${acc.socialMedia}`},
                            {$match: {[`${acc.socialMedia}.isVerified`]: true}},
                            {$sort: {[`${acc.socialMedia}.createdAt`]: -1}},
                            {
                                $project: {
                                    _id: `$${acc.socialMedia}._id`,
                                    instagramUsername: `$${acc.socialMedia}.instagramUsername`
                                }
                            },
                        ]);
                        accounts = (aggr ?? []).map((a: any) => ({
                            _id: a._id,
                            instagramUsername: a.instagramUsername,
                            socialMedia: acc.socialMedia
                        }));
                    } catch (e) {
                        accounts = [];
                        this.logger.warn(`Failed to aggregate accounts for influencer ${acc.influencerId} on ${acc.socialMedia}: ${e?.message ?? e}`);
                    }
                    influencersMap.set(key, accounts);
                }

                const account = accounts.find(it => it.instagramUsername === acc.socialMediaUsername) ?? null;

                // Точный mapping старого selectedCampaignContentItem → новый postDescriptionId
                let selectedContent: null | {
                    campaignContentItemId: Types.ObjectId;
                    postDescriptionId: Types.ObjectId | null
                } = null;
                if ((acc as any).selectedCampaignContentItem) {
                    const oldContentIdStr = (acc as any).selectedCampaignContentItem.toString();
                    const videoLink = contentIdToVideoLink.get(oldContentIdStr);
                    const newContentItem = updatedContent.find(c => c.videoLink === videoLink);

                    if (newContentItem) {
                        // Берём именно тот postDescription, который был в старом CampaignContentItem
                        const oldPostDescIds = oldContentIdToPostDescriptions.get(oldContentIdStr) ?? [];
                        const postDescriptionId = oldPostDescIds[0] ?? newContentItem.postDescriptions[0]?._id ?? null;

                        selectedContent = {
                            campaignContentItemId: newContentItem._id,
                            postDescriptionId,
                        };
                    }
                }

                updatedInfluencers.push({
                    _id: acc._id,
                    influencerId: acc.influencerId,
                    accountId: account?._id ?? null,
                    socialMedia: acc.socialMedia,
                    socialMediaUsername: acc.socialMediaUsername,
                    confirmation: acc.confirmation,
                    price: acc.price,
                    publicPrice: acc.publicPrice,
                    selectedContent,
                    dateRequest: acc.dateRequest,
                    closePromo: acc.closePromo,
                    postLink: acc.postLink,
                    screenshot: acc.screenshot,
                    impressions: acc.impressions,
                    like: acc.like,
                    rating: acc.rating,
                    adminChecked: acc.adminChecked,
                    followersNumber: acc.followersNumber,
                    createdAt: acc.createdAt,
                    updatedAt: acc.updatedAt,
                });
            }

            const resOfUpdate = await this.campaignsModel.updateOne(
                {_id: campaign._id},
                {$set: {campaignContent: updatedContent, selectInfluencers: updatedInfluencers}},
            );

            this.logger.log(`${resOfUpdate.modifiedCount ?? 0} updated for campaign "${campaign.campaignName}"`);
        }
    }


    async adminUpdateProposalCampaignsUpToDate() {
        const campaigns = await this.proposalCampaignModel.find().lean();
        if (!campaigns?.length) return {code: 500, message: 'Proposal campaigns not found'};

        const influencersMap = new Map<string, {
            _id: Types.ObjectId;
            instagramUsername: string;
            socialMedia: string
        }[]>();

        for (const campaign of campaigns) {
            const videoLinkMap = new Map<string, { _id: Types.ObjectId; description: string }[]>();
            const contentIdToVideoLink = new Map<string, string>();
            const oldContentIdToPostDescriptions = new Map<string, Types.ObjectId[]>();

            // 1. Собираем все postDescriptions по videoLink
            for (const contentItem of (campaign.campaignContent ?? [])) {
                const videoLink = contentItem.videoLink;
                contentIdToVideoLink.set(contentItem._id.toString(), videoLink);

                if (!videoLinkMap.has(videoLink)) {
                    videoLinkMap.set(videoLink, []);
                }

                const postDescriptions: { _id: Types.ObjectId; description: string }[] = [];
                if (Array.isArray(contentItem.postDescriptions) && contentItem.postDescriptions.length) {
                    for (const pd of contentItem.postDescriptions) {
                        const newId = pd._id ? new Types.ObjectId(pd._id) : new Types.ObjectId();
                        postDescriptions.push({_id: newId, description: pd.description ?? ''});
                    }
                } else {
                    const newId = new Types.ObjectId();
                    postDescriptions.push({_id: newId, description: (contentItem as any).postDescription ?? ''});
                }

                oldContentIdToPostDescriptions.set(contentItem._id.toString(), postDescriptions.map(pd => pd._id));
                videoLinkMap.get(videoLink)!.push(...postDescriptions);
            }

            // 2. Создаём новые CampaignContentItem
            const videoLinkToContentId = new Map<string, Types.ObjectId>();
            const updatedContent: any[] = [];
            for (const [videoLink, postDescriptions] of videoLinkMap.entries()) {
                const contentItemId = new Types.ObjectId();
                videoLinkToContentId.set(videoLink, contentItemId);

                updatedContent.push({
                    _id: contentItemId,
                    videoLink,
                    postDescriptions,
                    storyTag: campaign.campaignContent.find(c => c.videoLink === videoLink)?.storyTag,
                    swipeUpLink: campaign.campaignContent.find(c => c.videoLink === videoLink)?.swipeUpLink,
                    specialWishes: campaign.campaignContent.find(c => c.videoLink === videoLink)?.specialWishes,
                    socialMedia: campaign.socialMedia,
                    socialMediaGroup: 'main',
                });
            }

            // 3. Обновляем инфлюенсеров с корректным selectedContent
            const updatedInfluencers: any[] = [];
            for (const acc of (campaign.selectInfluencers ?? [])) {
                const key = `${acc.influencerId?.toString?.() ?? acc.influencerId}|${acc.socialMedia}`;
                let accounts = influencersMap.get(key);

                if (!accounts) {
                    try {
                        const aggr = await this.influencerModel.aggregate([
                            {$match: {_id: new Types.ObjectId(acc.influencerId.toString()), statusVerify: 'accept'}},
                            {$unwind: `$${acc.socialMedia}`},
                            {$match: {[`${acc.socialMedia}.isVerified`]: true}},
                            {$sort: {[`${acc.socialMedia}.createdAt`]: -1}},
                            {
                                $project: {
                                    _id: `$${acc.socialMedia}._id`,
                                    instagramUsername: `$${acc.socialMedia}.instagramUsername`
                                }
                            },
                        ]);
                        accounts = (aggr ?? []).map((a: any) => ({
                            _id: a._id,
                            instagramUsername: a.instagramUsername,
                            socialMedia: acc.socialMedia
                        }));
                    } catch (e) {
                        accounts = [];
                        this.logger.warn(`Failed to aggregate accounts for influencer ${acc.influencerId} on ${acc.socialMedia}: ${e?.message ?? e}`);
                    }
                    influencersMap.set(key, accounts);
                }

                const account = accounts.find(it => it.instagramUsername === acc.socialMediaUsername) ?? null;

                let selectedContent: null | {
                    campaignContentItemId: Types.ObjectId;
                    postDescriptionId: Types.ObjectId | null
                } = null;
                if ((acc as any).selectedCampaignContentItem) {
                    const oldContentIdStr = (acc as any).selectedCampaignContentItem.toString();
                    const videoLink = contentIdToVideoLink.get(oldContentIdStr);
                    const newContentItem = updatedContent.find(c => c.videoLink === videoLink);

                    if (newContentItem) {
                        const oldPostDescIds = oldContentIdToPostDescriptions.get(oldContentIdStr) ?? [];
                        const postDescriptionId = oldPostDescIds[0] ?? newContentItem.postDescriptions[0]?._id ?? null;

                        selectedContent = {
                            campaignContentItemId: newContentItem._id,
                            postDescriptionId,
                        };
                    }
                }

                updatedInfluencers.push({
                    _id: acc._id,
                    influencerId: acc.influencerId,
                    accountId: account?._id ?? null,
                    socialMedia: acc.socialMedia,
                    socialMediaUsername: acc.socialMediaUsername,
                    confirmation: acc.confirmation,
                    price: acc.price,
                    publicPrice: acc.publicPrice,
                    selectedContent,
                    dateRequest: acc.dateRequest,
                    closePromo: acc.closePromo,
                    postLink: acc.postLink,
                    screenshot: acc.screenshot,
                    impressions: acc.impressions,
                    like: acc.like,
                    followersNumber: acc.followersNumber,
                    genres: acc.genres ?? [],
                    countries: acc.countries ?? [],
                });
            }

            const resOfUpdate = await this.proposalCampaignModel.updateOne(
                {_id: campaign._id},
                {$set: {campaignContent: updatedContent, selectInfluencers: updatedInfluencers}},
            );

            this.logger.log(`${resOfUpdate.modifiedCount ?? 0} updated for proposal campaign "${campaign.campaignName}"`);
        }
    }

    async checkIdInEachAccount(batchSize = 100): Promise<void> {
        let skip = 0;
        let processed = 0;

        const socialMediaFields = [
            'instagram',
            'tiktok',
            'spotify',
            'soundcloud',
            'facebook',
            'youtube',
            'press',
        ];

        while (true) {
            const influencers = await this.influencerModel
                .find({}, socialMediaFields.join(' '))
                .skip(skip)
                .limit(batchSize)
                .lean();

            if (influencers.length === 0) break;

            for (const influencer of influencers) {
                let modified = false;

                for (const field of socialMediaFields) {
                    const accounts = influencer[field] || [];

                    for (const acc of accounts) {
                        // если _id отсутствует
                        if (!acc._id) {
                            acc._id = new Types.ObjectId();
                            modified = true;
                        }
                        // если _id строка — конвертируем в ObjectId
                        else if (typeof acc._id === 'string') {
                            try {
                                // Проверяем, можно ли безопасно конвертировать
                                if (Types.ObjectId.isValid(acc._id)) {
                                    acc._id = new Types.ObjectId(acc._id);
                                    modified = true;
                                } else {
                                    // если строка невалидна — создаём новый id
                                    acc._id = new Types.ObjectId();
                                    modified = true;
                                }
                            } catch {
                                acc._id = new Types.ObjectId();
                                modified = true;
                            }
                        }
                    }
                }

                if (modified) {
                    await this.influencerModel.updateOne(
                        {_id: influencer._id},
                        {
                            $set: Object.fromEntries(
                                socialMediaFields.map((f) => [f, influencer[f]]),
                            ),
                        },
                    );
                }

                processed++;
            }

            this.logger.log(`Processed ${processed} influencers so far...`);
            skip += batchSize;
        }

        this.logger.log('✅ Finished checking all influencer accounts.');
    }
}
