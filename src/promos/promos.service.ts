import {Injectable} from "@nestjs/common";
import {CreatePromosDto} from "./dto/create-promo.dto";
import {CreatePromosEstimateDto} from "./dto/create-promo-estimate.dto";
import {InjectModel} from "@nestjs/mongoose";
import {Promos, SelectInfluencers} from "./schemas/promo.schema";
import mongoose from "mongoose";
import {Client} from "src/auth/schemas/client.schema";
import {Influencer} from "src/auth/schemas/influencer.schema";
import {Offers} from "./schemas/offers.schema";
import sendMail from "src/utils/sendMail";
import {DropboxService} from "src/services/Dropbox.service";
import {PromosCopies} from "../admin/schemas/promos-copies.schema";
import axios from "axios";
import * as process from "node:process";
import {GetSelectedSocialAccountsDto} from "./dto/get-selected-social-accounts.dto";
import {encryptAndEncode} from "../utils/crypt";

mongoose.Promise = global.Promise;

@Injectable()
export class PromosService {
    constructor(
        @InjectModel(Promos.name)
        private promosModel: mongoose.Model<Promos>,
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
        @InjectModel(Offers.name)
        private offersModel: mongoose.Model<Offers>,
        @InjectModel(PromosCopies.name)
        private promosCopiesModel: mongoose.Model<PromosCopies>,
    ) {
    }

    async createPromo(data: CreatePromosDto) {
        if (!data) {
            return {
                status: 400,
                message: "Not enough arguments",
            };
        }

        const processedCampaignContent = data.campaignContent.map((item) => {
            return {
                ...item,
                _id: new mongoose.Types.ObjectId(),
            };
        });

        const processedInfluencers = await Promise.all(
            data.selectInfluencers.map(async (influencer) => {
                const dateRequest = influencer.dateRequest;

                const influencerData = await this.influencerModel.findOne({
                    _id: influencer.influencerId,
                });

                const socialMediaAccount = influencerData[data.socialMedia].find(
                    (account) => account.instagramUsername === influencer.socialMediaUsername
                );

                if (socialMediaAccount) {
                    return {
                        ...influencer,
                        _id: new mongoose.Types.ObjectId(),
                        price: socialMediaAccount.price,
                        publicPrice: socialMediaAccount.publicPrice,
                        followersNumber: parseInt(socialMediaAccount.followersNumber),
                        selectedCampaignContentItem: (() => {
                            const matchedItem = processedCampaignContent.find(campaignContentItem =>
                                campaignContentItem.videoLink === influencer.selectedCampaignContentItem
                            );
                            return matchedItem ? matchedItem._id.toString() : null;
                        })(),
                        dateRequest,
                        socialMedia: data.socialMedia,
                    };
                }
            })
        );

        let result;

        try {
            const campaignId = new mongoose.Types.ObjectId();
            result = await this.promosModel.create({
                ...data,
                _id: campaignId,
                campaignContent: processedCampaignContent,
                selectInfluencers: processedInfluencers,
                paymentType: !data.paymentType ? "payment" : data.paymentType,
                paymentStatus: "wait",
                statusCampaign: "wait",
                verifyCampaign: "wait",
                shareLink: `${process.env.SERVER_CLIENT}/promo-share/${campaignId}/${data.socialMedia}`,
            });
        } catch (err) {
            return {
                code: 500,
                message: err.message,
            };
        }

        let dataClient;

        try {
            dataClient = await this.clientModel.findOne({_id: data.clientId});
            if (+dataClient.balance <= data.campaignPrice) {
                await this.clientModel.findOneAndUpdate(
                    {_id: data.clientId},
                    {balance: "0"}
                );
            }
        } catch (err) {
            return {
                code: 500,
                message: err.message,
            };
        }

        const emailStartContent = () => {
            if (data.socialMedia === 'spotify' || data.socialMedia === 'soundcloud') {
                return `
                    <p>Hi,</p>
<p>The Client ${dataClient.firstName} has requested the following post for this list of influencers on the ${data.socialMedia}:</p>
<p><strong>Post Details:</strong></p>
<p><strong>Campaign Name: ${data.campaignName}</strong></p>
                    `;
            } else if (data.socialMedia === 'press') {
                return `
                    <p>Hi,</p>
<p>The client ${dataClient.firstName} has requested the following article for inclusion in this list of magazines in the press:</p>
<p><strong>Post Details:</strong></p>
<p><strong>Campaign Name: ${data.campaignName}</strong></p>`
            } else {
                return `
                    <p>Hi,</p>
<p>The Client ${dataClient.firstName} has requested the following post for this list of influencers on the ${data.socialMedia}:</p>
<p><strong>Post Details:</strong></p>
<p><strong>Campaign Name: ${data.campaignName}</strong></p>
                    `;
            }
        };

        const emailVideoContent = () => {
            if (data.socialMedia === 'spotify' || data.socialMedia === 'soundcloud') {
                return processedCampaignContent.map((campaignContentItem, index) => `
                    <p><strong>Song/Playlist ${index + 1}:</strong></p>
                    <ul>
                        <li><strong>Track/Playlist Title:</strong> ${campaignContentItem.postDescription}</li>
                        <li><strong>Track/Playlist Link:</strong> ${campaignContentItem.videoLink}</li>
                        <li><strong>Special Wishes:</strong> ${campaignContentItem.specialWishes}</li>
                    </ul>
                    <p><strong>Selected Influencers:</strong></p>
    <ul>
        ${data.selectInfluencers
                    .filter(influencer => influencer.selectedCampaignContentItem === campaignContentItem._id.toString())
                    .map(influencer => `<li>${data.socialMedia} username: ${influencer.socialMediaUsername}</li>`)
                    .join('')}
    </ul>
                `).join('');
            } else if (data.socialMedia === 'press') {
                return processedCampaignContent.map((campaignContentItem, index) => `
                    <p><strong>Article ${index + 1}:</strong></p>
                    <ul>
                        <li><strong>Link to Music, Events, News:</strong> ${campaignContentItem.videoLink}</li>
                        <li><strong>Link to Artwork & Press Shots:</strong> ${campaignContentItem.postDescription}</li>
                        <li><strong>Link To Press Release:</strong> ${campaignContentItem.storyTag}</li>
                        <li><strong>Special Wishes:</strong> ${campaignContentItem.specialWishes}</li>
                    </ul>
                    <p><strong>Selected Influencers:</strong></p>
    <ul>
        ${data.selectInfluencers
                    .filter(influencer => influencer.selectedCampaignContentItem === campaignContentItem._id.toString())
                    .map(influencer => `<li>${data.socialMedia} username: ${influencer.socialMediaUsername}</li>`)
                    .join('')}
    </ul>
                `).join('');
            } else {
                return processedCampaignContent.map((campaignContentItem, index) => `
                    <p><strong>Video ${index + 1}:</strong></p>
                    <ul>
                        <li><strong>Link:</strong> ${campaignContentItem.videoLink}</li>
                        <li><strong>Post Description:</strong> ${campaignContentItem.postDescription}</li>
                        <li><strong>Story Tag:</strong> ${campaignContentItem.storyTag}</li>
                        <li><strong>Swipe Up Link:</strong> ${campaignContentItem.swipeUpLink}</li>
                        <li><strong>Special Wishes:</strong> ${campaignContentItem.specialWishes}</li>
                        <p><strong>Selected Influencers:</strong></p>
    <ul>
        ${processedInfluencers
                    .filter(influencer => influencer.selectedCampaignContentItem === campaignContentItem._id.toString())
                    .map(influencer => `<li>${data.socialMedia} username: ${influencer.socialMediaUsername}</li>`)
                    .join('')}
    </ul>
                    </ul>
                `).join('');
            }
        }

        const emailContent = `
${emailStartContent()}
${emailVideoContent()}
<p>Payment Method Used: ${result.paymentType}</p>
<p>
    <a style="font-weight: 600" href="${process.env.SERVER}/promos/verify-promo?promoId=${result._id}&status=accept">
        Approve
    </a> 
    <a style="font-weight: 600" href="${process.env.SERVER}/promos/verify-promo?promoId=${result._id}&status=cancel">
        Decline
    </a>
</p>`;

        await sendMail(
            // "nazarkozynets030606@zohomail.eu",
            "admin@soundinfluencers.com",
            "soundinfluencers",
            emailContent,
            "html"
        );

        return {
            code: 201,
            result,
        };
    }

    async createPromosForEstimate(data: CreatePromosEstimateDto, isPO: boolean = false) {
        return {
            code: 400,
            message: 'Server error',
        }
        // if (!data || !Array.isArray(data.selectInfluencers)) {
        //     return {
        //         code: 400,
        //         message: "Invalid data: selectInfluencers must be a valid array",
        //     };
        // }

//         const processedInfluencers = await Promise.all(
//             data.selectInfluencers.map(async (influencer) => {
//                 try {
//                     const selectedVideo = influencer.selectedVideo;
//                     const dateRequest = influencer.dateRequest;
//
//                     const influencerData = await this.influencerModel.findOne({
//                         _id: influencer.influencerId,
//                     });
//
//                     if (!influencerData) {
//                         return {
//                             ...influencer,
//                             price: '0',
//                             publicPrice: '0',
//                             followersNumber: 0,
//                             selectedVideo,
//                             dateRequest,
//                         };
//                     }
//
//                     const socialMediaAccount = influencerData[data.socialMedia]?.find(
//                         (account) => account.instagramUsername === influencer.instagramUsername
//                     );
//
//                     return socialMediaAccount
//                         ? {
//                             ...influencer,
//                             price: socialMediaAccount.price,
//                             publicPrice: socialMediaAccount.publicPrice,
//                             followersNumber: parseInt(socialMediaAccount.followersNumber),
//                             selectedVideo,
//                             dateRequest,
//                         }
//                         : {
//                             ...influencer,
//                             price: '0',
//                             publicPrice: '0',
//                             followersNumber: 0,
//                             selectedVideo,
//                             dateRequest,
//                         };
//                 } catch (error) {
//                     console.error('Error processing influencer:', influencer, error);
//                     throw error;
//                 }
//             })
//         );
//
//         if (!isPO && processedInfluencers.length > 0) {
//             const result = await this.promosModel.create({
//                 ...data,
//                 selectInfluencers: processedInfluencers,
//                 paymentType: !data.paymentType ? "payment" : data.paymentType,
//                 paymentStatus: "wait",
//                 statusPromo: "estimate",
//                 isPO: false,
//             });
//
//             const dataClient = await this.clientModel.findOne({_id: data.userId});
//
//             await sendMail(
//                 // "nazarkozynets030606@zohomail.eu",
//                 "admin@soundinfluencers.com",
//                 "soundinfluencers",
//                 `<p>Hi</p>
//                 <p>The Client ${dataClient.firstName} has requested a campaign on this network without providing any content</p>
//                 <p>Influencers Chosen:</p><br/>
//                 ${data.selectInfluencers
//                     .map((item) => `<p>Instagram name: ${item.instagramUsername}</p>`)
//                     .join('')}<br/>
//                 <p>Email: ${dataClient.email}</p>
//                 <p>Phone Number: ${dataClient.phone}</p>
//                 `,
//                 "html"
//             );
//
//             return {
//                 code: 201,
//                 result,
//             };
//         } else if (isPO && processedInfluencers.length > 0) {
//             const result = await this.promosModel.create({
//                 ...data,
//                 selectInfluencers: processedInfluencers,
//                 paymentType: !data.paymentType ? "payment" : data.paymentType,
//                 paymentStatus: "wait",
//                 statusPromo: "estimate",
//                 isPO: true,
//             });
//
//             const dataClient = await this.clientModel.findOne({_id: data.userId});
//             if (+dataClient.balance <= data.amount) {
//                 await this.clientModel.findOneAndUpdate(
//                     {_id: data.userId},
//                     {balance: "0"}
//                 );
//             }
//
//             await sendMail(
//                 // "nazarkozynets030606@zohomail.eu",
//                 "admin@soundinfluencers.com",
//                 "soundinfluencers",
//                 `<p>Hi,</p>
// <p>The Client ${dataClient.firstName} has requested the following post for this list of influencers:</p>
// <p><strong>Post Details:</strong></p>
// ${data.videos.map((video, index) => `
//     <p><strong>Video ${index + 1}:</strong></p>
//     <ul>
//         <li><strong>Link:</strong> ${video.videoLink}</li>
//         <li><strong>Post Description:</strong> ${video.postDescription}</li>
//         <li><strong>Story Tag:</strong> ${video.storyTag}</li>
//         <li><strong>Swipe Up Link:</strong> ${video.swipeUpLink}</li>
//         <li><strong>Special Wishes:</strong> ${video.specialWishes}</li>
//     </ul>
// `).join('')}
// <p><strong>Selected Influencers:</strong></p>
// <ul>
//     ${data.selectInfluencers.map(
//                     (item) => `<li>Instagram name: ${item.instagramUsername}</li>`
//                 ).join('')}
// </ul>
// <p>Payment Method Used: ${result.paymentType}</p>`,
//                 "html"
//             );
//
//             return {
//                 code: 201,
//                 result,
//             };
//         }
    }

    async updateEstimatePromo(promoId: string, isPoNeed: string) {
        try {
            const findPromo = await this.promosModel.findOne({_id: promoId}).lean().exec();

            if (!findPromo) {
                return {status: 404, message: 'Promo not found'};
            }

            let updateFields: any = {
                statusCampaign: findPromo.statusCampaign,
                verifyCampaign: findPromo.verifyCampaign
            };

            const isPoNeedBool = isPoNeed === 'true';

            const paymentType = findPromo.paymentType.trim().toLowerCase();
            const statusCampaign = findPromo.statusCampaign.trim().toLowerCase();

            if (isPoNeedBool === true && paymentType === 'po request') {
                if (statusCampaign === 'po waiting') {
                    updateFields.statusCampaign = 'wait';
                    updateFields.verifyCampaign = 'accept';
                }
            } else if (isPoNeedBool === false && paymentType === 'po request') {
                if (statusCampaign === 'estimate') {
                    updateFields.statusCampaign = 'po waiting';
                }
            } else if (statusCampaign === 'estimate' && paymentType !== 'po request') {
                updateFields.statusCampaign = 'wait';
                updateFields.verifyCampaign = 'accept';
            }

            if (updateFields.statusCampaign !== findPromo.statusCampaign || updateFields.verifyCampaign !== findPromo.verifyCampaign) {
                await this.promosModel.findOneAndUpdate(
                    {_id: promoId},
                    updateFields
                );
            }

            return {status: 200, message: 'estimate Promo status updated successfully'};
        } catch (err) {
            console.error('Error updating promo status:', err);
            return {status: 500, message: err.message};
        }
    }

    async verifyCampaign(campaignId: string, status: string) {
        if (!campaignId || !status) {
            return {
                status: 400,
                message: "Not enough arguments",
            };
        }

        try {
            const checkCampaign = await this.promosModel.findOne({_id: campaignId}).lean();

            if (!checkCampaign) {
                return {
                    code: 404,
                    message: "Campaign not found",
                };
            }

            try {
                const updateFields = {
                    verifyCampaign: (checkCampaign as any)?.verifyCampaign,
                    verifyPromo: (checkCampaign as any)?.verifyPromo
                };
                if ((checkCampaign as any).verifyPromo !== undefined) {
                    updateFields.verifyPromo = status;
                }
                if (checkCampaign.verifyCampaign !== undefined) {
                    updateFields.verifyCampaign = status;
                }

                await this.promosModel.updateOne(
                    {_id: campaignId},
                    {$set: updateFields}
                );
            } catch (err) {
                console.error('Error updating promo status:', err);
                return {
                    code: 500,
                    message: err,
                };
            }

            if (status === "accept" && checkCampaign.statusCampaign === "wait") {
                const checkCampaign = await this.promosModel.findById(campaignId);
                const influencersIds = checkCampaign.selectInfluencers.map((item) => item.influencerId);

                const influencers = await this.influencerModel.find({_id: {$in: influencersIds}});

                if (!influencers) {
                    return {
                        code: 404,
                        message: "Influencers not found",
                    };
                }

                let dataToSaveInfluencersHistory = [];

                for (let influencer of influencers) {
                    const influencerSocialMediaAccounts = influencer[checkCampaign.socialMedia].map((account) => {
                        if (checkCampaign.selectInfluencers.some((influencerData) => influencerData.socialMediaUsername === account.instagramUsername || (influencerData as any).instagramUsername === account.instagramUsername)) {
                            dataToSaveInfluencersHistory.push({
                                influencerId: influencer._id,
                                campaignId: new mongoose.Types.ObjectId(checkCampaign._id),
                                campaignName: checkCampaign.campaignName,
                                updatedCampaignAction: {
                                    actionNumber: 0,
                                    networkUsername: account.instagramUsername,
                                    rewardForInfluencer: parseInt(account.price),
                                },
                            });
                        }

                        return account.instagramUsername;
                    });

                    const influencerSelectedCampaignContent = checkCampaign.campaignContent.filter((campaignContentItem) => {
                        return checkCampaign.selectInfluencers.some((influencerData) => {
                            return influencerData.selectedCampaignContentItem === campaignContentItem._id.toString() && influencerSocialMediaAccounts.includes(influencerData.socialMediaUsername);
                        });
                    });

                    if (influencerSelectedCampaignContent.length > 0) {
                        const accountNames = influencer[checkCampaign.socialMedia]
                            .filter(account => influencerSelectedCampaignContent.some(campaignContentItem => {
                                return checkCampaign.selectInfluencers.some(influencerData => influencerData.selectedCampaignContentItem === campaignContentItem._id.toString() && influencerData.socialMediaUsername === account.instagramUsername);
                            }))
                            .map(account => account.instagramUsername)
                            .join(', ');

                        const emailToInfluencer = `
<p>Hi,</p>
<p>You have received a new promo request on your account for the following:</p>
<p><strong>${accountNames} - Instagram Post & Story</strong></p>
<p><strong>Post Details:</strong></p>
${influencerSelectedCampaignContent.map((campaignContentItem, index) => `
    <p><strong>Video ${index + 1}:</strong></p>
    <ul>
        <li><strong>Link:</strong> ${campaignContentItem.videoLink || 'No link provided'}</li>
        <li><strong>Post Description:</strong> ${campaignContentItem.postDescription || 'No description provided'}</li>
        <li><strong>Story Tag:</strong> ${campaignContentItem.storyTag || 'No story tag provided'}</li>
        <li><strong>Swipe Up Link:</strong> ${campaignContentItem.swipeUpLink || 'No post link provided'}</li>
        <li><strong>Special Requests:</strong> ${campaignContentItem.specialWishes || 'None'}</li>
    </ul>
`).join('')}      
<p>Access your account to accept or deny it here: https://go.soundinfluencers.com/account/influencer/new-promos</p>     
<p>Thanks,</p>
<p>Soundinfluencers Team</p>
`;

                        // await sendMail(influencer.email, "soundinfluencers", emailToInfluencer, "html");
                        await sendMail("nazarkozynets030606@zohomail.eu", "soundinfluencers", emailToInfluencer, "html");
                    }
                }

                try {
                    for (const item of dataToSaveInfluencersHistory) {
                        await axios.post(`${process.env.SERVER}/influencer-actions-history/upsert/campaign`, item);
                    }
                } catch (err) {
                    return {
                        code: 500,
                        message: err,
                    };
                }

                return {
                    code: 200,
                    message: "promo verified",
                };
            }
        } catch (err) {
            return {
                code: 500,
                message: err,
            };
        }
    }

    async getOffers(socialMedia: string) {
        try {
            const offers = await this.offersModel.find({socialMedia}).lean();

            const offersWithAvatars = await Promise.all(
                offers.map(async (offer: any) => {
                    // Process the top-level connectInfluencer array
                    const connectInfluencerWithAvatars = await Promise.all(
                        (offer.connectInfluencer || []).map(async (influencer: any) => {
                            if (!influencer.influencerId || !influencer.instagramUsername) {
                                return influencer;
                            }

                            try {
                                const avatar = await this.getInfluencerAvatarById(
                                    influencer.influencerId,
                                    influencer.instagramUsername
                                );

                                return {
                                    ...influencer,
                                    avatar,
                                };
                            } catch (error) {
                                return influencer;
                            }
                        })
                    );

                    // Process the musicStyles array
                    const musicStylesWithAvatars = await Promise.all(
                        (offer.musicStyles || []).map(async (style: any) => {
                            const connectInfluencersWithAvatars = await Promise.all(
                                (style.connectInfluencer || []).map(async (influencer: any) => {
                                    if (!influencer.influencerId || !influencer.instagramUsername) {
                                        return influencer;
                                    }

                                    try {
                                        const avatar = await this.getInfluencerAvatarById(
                                            influencer.influencerId,
                                            influencer.instagramUsername
                                        );

                                        return {
                                            ...influencer,
                                            avatar,
                                        };
                                    } catch (error) {
                                        return influencer;
                                    }
                                })
                            );

                            return {
                                ...style,
                                connectInfluencer: connectInfluencersWithAvatars,
                            };
                        })
                    );

                    return {
                        ...offer,
                        connectInfluencer: connectInfluencerWithAvatars,
                        musicStyles: musicStylesWithAvatars,
                    };
                })
            );

            return {
                code: 200,
                offers: offersWithAvatars,
            };
        } catch (err) {
            console.error('Error fetching offers:', err);

            return {
                code: 500,
                message: err,
            };
        }
    }

    async getOffersForCreateCampaignPage(socialMedia: string) {
        try {
            const offers = await this.offersModel.find({socialMedia}).lean();

            const processedOffers = await Promise.all(
                offers.map(async (offer: any) => {
                    let processedOffer = {
                        id: offer.id,
                        followers: offer.followers,
                        network: offer.network,
                        story: offer.story, 
                        musicStylesAccounts: []
                    };
                    
                    if (offer.musicStyles && offer.musicStyles.length > 0) {
                        processedOffer.musicStylesAccounts = offer.musicStyles.map((style) => {
                            return {
                                genre: style.genres[0],
                                price: style.price,
                                accounts: style.connectInfluencer.map((item) => {
                                    return {
                                        instagramUsername: item.instagramUsername,
                                        influencerId: item.influencerId || (item as any)._id,
                                    };
                                }),
                            };
                        });
                    }

                    if (offer.connectInfluencer && offer.connectInfluencer.length > 0) {
                        processedOffer.musicStylesAccounts.push({
                            genre: "Techno (Melodic)",
                            price: offer.price,
                            accounts: offer.connectInfluencer.map((item) => {
                                return {
                                    instagramUsername: item.instagramUsername,
                                    influencerId: item.influencerId || (item as any)._id,
                                };
                            }),
                        });
                    }
                    
                    return processedOffer;
                })
            );

            return {
                code: 200,
                offers: processedOffers,
            };
        } catch (err) {
            console.error('Error fetching offers:', err);

            return {
                code: 500,
                message: err,
            };
        }
    }

    async getInfluencerAvatarById(influencerId: string, instagramName: string) {
        const influencer = await this.influencerModel.findOne({
            _id: new mongoose.Types.ObjectId(influencerId),
        })

        if (!influencer) {
            throw new Error(`Influencer with ID ${influencerId} not found`);
        }

        const instagramAccount = influencer.instagram?.find(
            (item) => item.instagramUsername === instagramName
        );
        return instagramAccount?.logo || null;
    }

    async checkUploadStatus(fileName: string): Promise<boolean> {
        const dropboxService = new DropboxService();
        return await dropboxService.isFileUploaded(fileName);
    }

    async clientCompletedCampaignsHistory(id: string) {
        try {
            if (!id) {
                return {
                    status: 400,
                    message: "Not enough arguments",
                };
            }

            const checkUser = await this.clientModel.findById(id);
            if (!checkUser) {
                return {
                    code: 404,
                    message: "User not found",
                };
            }

            const campaigns = await this.promosCopiesModel
                .find({
                    $or: [
                        {clientId: id, statusCampaign: "finally"},
                        {userId: id, statusPromo: "finally"},
                    ]
                })
                .lean();

            const campaignsToReturn = await Promise.all(
                campaigns.map(async (item) => {
                    const clientId = item.clientId || (item as any).userId;
                    const clientName = await this.clientModel.findById(clientId);
                    if (!clientName) return {...item, client: "No Data"};
                    return {...item, client: clientName.firstName};
                })
            );

            return {
                code: 200,
                promos: campaignsToReturn,
            };
        } catch (err) {
            console.log(err);
            return {
                code: 500,
                message: err,
            };
        }
    }

    async clientGetOngoingCampaigns(id: string) {
        try {
            if (!id) {
                return {
                    status: 400,
                    message: "Not enough arguments",
                };
            }

            const checkClient = await this.clientModel.findById(id);

            if (!checkClient) {
                return {
                    code: 404,
                    message: "User not found",
                };
            }

            const campaigns = await this.promosModel
                .find({
                    $or: [
                        {clientId: id, statusCampaign: {$in: ["work", "wait", "estimate", "po waiting"]}},
                        {userId: id, statusPromo: {$in: ["work", "wait", "estimate", "po waiting"]}},
                    ],
                })
                .lean();

            const campaignToReturn = await Promise.all(
                campaigns.map(async (item) => {
                    const clientId = item.clientId || (item as any).userId;
                    const clientName = await this.clientModel.findById(clientId);
                    if (!clientName) return {...item, client: "No Date"};
                    return {
                        ...item,
                        client: clientName.firstName,
                        brand: clientName.company,
                    };
                })
            );

            return {
                code: 200,
                promos: campaignToReturn,
            };
        } catch (err) {
            console.log(err);
            return {
                code: 500,
                message: err,
            };
        }
    }

    async clientGetOngoingOrPastCampaign(campaignId: string, clientId: string) {
        try {
            if (!campaignId) {
                return {
                    status: 400,
                    message: "Not enough arguments",
                };
            }

            const checkUser = await this.clientModel.findById(clientId);
            if (!checkUser) {
                return {
                    code: 404,
                    message: "User not found",
                };
            }

            let campaign = await this.promosModel.findById(campaignId).lean();
            let totalFollowers = 0;

            if (!campaign) {
                const campaignCopy = await this.promosCopiesModel.findById(campaignId).lean();
                if (campaignCopy) {
                    totalFollowers = campaignCopy.totalFollowers || 0;
                    campaign = campaignCopy;
                } else {
                    return {
                        code: 404,
                        message: "Promo not found",
                    };
                }
            }

            const clientData = await this.clientModel.findById(clientId);

            const selectInfluencersWithDetails = await Promise.all(
                campaign.selectInfluencers.map(async (influencerItem) => {
                    const influencerData = await this.influencerModel.findById(influencerItem.influencerId);

                    if (!influencerData) {
                        return {
                            ...influencerItem,
                            firstName: "",
                        };
                    }

                    const socialMediaAccount = influencerData[campaign.socialMedia].find(
                        (item) => item.instagramUsername === (influencerItem.socialMediaUsername || (influencerItem as any).instagramUsername)
                    );

                    if (!campaign.isCopy) totalFollowers += parseInt(socialMediaAccount.followersNumber);
                    let followersNumber = !campaign.isCopy ? socialMediaAccount.followersNumber : influencerItem.followersNumber;

                    return {
                        ...influencerItem,
                        selectedCampaignContentItem: influencerItem.selectedCampaignContentItem || (influencerItem as any).selectedVideo,
                        selectedCampaignContentItemObj: campaign.campaignContent ? campaign.campaignContent.find((campaignContentItem) => campaignContentItem._id.toString() === influencerItem.selectedCampaignContentItem) : (campaign as any).videos ? (campaign as any).videos.find((video) => video.videoLink === (influencerItem as any).selectedVideo) : null,
                        socialMediaUsername: influencerItem.socialMediaUsername || (influencerItem as any).instagramUsername,
                        firstName: influencerData.firstName,
                        followersNumber: followersNumber,
                        logo: socialMediaAccount.logo,
                    };
                })
            );

            return {
                code: 200,
                campaign: {
                    ...campaign,
                    selectInfluencers: selectInfluencersWithDetails,
                    brand: clientData ? clientData.company : "No Data",
                    client: clientData ? clientData.firstName : "No Data",
                    dateRequest: campaign.createdAt,
                    campaignContent: campaign.campaignContent || (campaign as any).videos,
                    paymentStatus: campaign.paymentStatus,
                    paymentType: campaign.paymentType,
                    amount: campaign.campaignPrice || (campaign as any).amount || 0,
                    campaignName: campaign.campaignName,
                    totalFollowers: totalFollowers,
                },
            };
        } catch (err) {
            console.log(err);
            return {
                code: 500,
                message: err.message || "Internal Server Error",
            };
        }
    }

    async influencerCompletedCampaignsHistory(influencerId: string) {
        try {
            if (!influencerId) {
                return {
                    status: 400,
                    message: "Not enough arguments",
                };
            }

            const checkInfluencer = await this.influencerModel.findOne({_id: influencerId});
            if (!checkInfluencer) {
                return {
                    code: 404,
                    message: "User not found",
                };
            }

            const [campaigns, finishedCampaigns] = await Promise.all([
                this.promosModel.find({selectInfluencers: {$elemMatch: {influencerId, closePromo: "close"}}}).lean(),
                this.promosCopiesModel.find({
                    selectInfluencers: {
                        $elemMatch: {
                            influencerId,
                            closePromo: "close"
                        }
                    }
                }).lean()
            ]);

            const allCampaigns = [...campaigns, ...finishedCampaigns];

            const campaignsToReturn = await Promise.all(
                allCampaigns.flatMap(async (campaignItem) => {
                    if (!campaignItem.selectInfluencers) return [];
                    const client = await this.clientModel.findById(campaignItem.clientId || (campaignItem as any).userId);

                    return campaignItem.selectInfluencers.flatMap((influencerItem) => {
                        if (influencerItem.influencerId.toString() !== influencerId || influencerItem.closePromo !== 'close') return [];

                        if (influencerItem.selectedCampaignContentItem) {
                            return [{
                                socialMediaUsername: influencerItem.socialMediaUsername || (influencerItem as any).instagramUsername,
                                createdAt: campaignItem.createdAt,
                                socialMedia: campaignItem.socialMedia,
                                campaignId: campaignItem._id,
                                statusCampaign: campaignItem.statusCampaign || (campaignItem as any).statusPromo,
                                campaignName: campaignItem.campaignName,
                                selectedCampaignContentItem: influencerItem.selectedCampaignContentItem
                            }]
                        } else if ((influencerItem as any).selectedVideo) {
                            return [{
                                socialMediaUsername: influencerItem.socialMediaUsername || (influencerItem as any).instagramUsername,
                                createdAt: campaignItem.createdAt,
                                socialMedia: campaignItem.socialMedia,
                                campaignId: campaignItem._id,
                                statusCampaign: campaignItem.statusCampaign || (campaignItem as any).statusPromo,
                                campaignName: campaignItem.campaignName,
                                selectedCampaignContentItem: (influencerItem as any).selectedVideo
                            }];
                        }

                        return [];
                    })
                }).filter(Boolean)
            );

            return {
                code: 200,
                promos: campaignsToReturn.flat(),
            };
        } catch (err) {
            console.log(err);
            return {
                code: 500,
                message: err,
            };
        }
    };

    async influencerPastCampaignOne(influencerId: string, campaignId: string, socialMediaUsername: string, selectedCampaignContentItem: string) {
        if (!influencerId || !campaignId || !socialMediaUsername || !selectedCampaignContentItem) {
            return {
                status: 400,
                message: "Not enough arguments",
            };
        }

        try {
            const influencer = await this.influencerModel.findById(influencerId);
            if (!influencer) {
                return {
                    code: 404,
                    message: "Influencer not found",
                };
            }

            let campaign = await this.promosCopiesModel.findOne({
                _id: campaignId,
                selectInfluencers: {
                    $elemMatch: {
                        influencerId: influencerId,
                        $or: [
                            {socialMediaUsername: socialMediaUsername},
                            {instagramUsername: socialMediaUsername},
                        ],
                    },
                },
            }).lean().exec();

            if (!campaign) {
                campaign = await this.promosModel.findOne({
                    _id: campaignId,
                    selectInfluencers: {
                        $elemMatch: {
                            influencerId: influencerId,
                            $or: [
                                {socialMediaUsername: socialMediaUsername},
                                {instagramUsername: socialMediaUsername},
                            ],
                        },
                    },
                }).lean().exec() as any;

                if (!campaign) {
                    return {
                        code: 404,
                        message: "Campaign not found",
                    };
                }
            }

            const client = await this.clientModel.findById(campaign.clientId || (campaign as any).userId);

            if (!client) {
                return {
                    code: 404,
                    message: "Client not found",
                };
            }

            const selectedAccount = campaign.selectInfluencers.find((influencerItem) => {
                return influencerItem.influencerId.toString() === influencerId
                    && (influencerItem.socialMediaUsername === socialMediaUsername || (influencerItem as any).instagramUsername === socialMediaUsername);
            });

            if (!selectedAccount) {
                return {
                    code: 404,
                    message: "Not found",
                };
            }

            let contentItem = {};
            if (selectedAccount.selectedCampaignContentItem) {
                contentItem = campaign.campaignContent.find((item) => item._id.toString() === selectedCampaignContentItem);
            } else if ((selectedAccount as any).selectedVideo) {
                contentItem = (campaign as any).videos.find((video) => video.videoLink === selectedCampaignContentItem);
            }

            if (!contentItem) {
                return {
                    code: 404,
                    message: "Campaign content not found",
                };
            }

            return {
                code: 200,
                promo: {
                    campaignName: campaign.campaignName,
                    influencerId: influencerId,
                    socialMediaUsername: selectedAccount.socialMediaUsername || (selectedAccount as any).instagramUsername,
                    dateRequest: selectedAccount.dateRequest,
                    client: client?.company || client?.firstName || "No information",
                    socialMedia: campaign.socialMedia,
                    videoLink: (contentItem as any).videoLink,
                    postDescription: (contentItem as any).postDescription,
                    storyTag: (contentItem as any).storyTag,
                    swipeUpLink: (contentItem as any).swipeUpLink,
                    specialWishes: (contentItem as any).specialWishes,
                }
            };
        } catch (err) {
            return {
                code: 500,
                message: err,
            };
        }
    };

    async clientPastCampaignOne(clientId: string, campaignId: string) {
        try {
            if (!clientId || !campaignId) {
                return {
                    status: 400,
                    message: "Not enough arguments",
                };
            }

            const checkClient = await this.clientModel.findById(clientId);

            if (!checkClient) {
                return {
                    code: 404,
                    message: "User not found",
                };
            }

            let result = await this.promosCopiesModel.findOne({_id: campaignId}).lean();

            if (!result) {
                return {
                    code: 404,
                    message: "not found",
                };
            }

            return {
                code: 200,
                promo: {
                    ...result,
                    client: checkClient?.company || checkClient?.firstName || "No information",
                },
            };
        } catch (err) {
            console.log(err);
            return {
                code: 500,
                message: err,
            };
        }
    }

    async influencerGetNewCampaigns(influencerId: string) {
        try {
            if (!influencerId) {
                return {
                    status: 400,
                    message: "Not enough arguments",
                };
            }

            const checkInfluencer = await (async () => {
                const influencer = await this.influencerModel.findOne({
                    _id: influencerId,
                });

                if (influencer) {
                    return influencer;
                }
            })();

            if (!checkInfluencer) {
                return {
                    code: 404,
                    message: "Influencer not found",
                };
            }

            const campaigns = await this.promosModel
                .find({
                    selectInfluencers: {
                        $elemMatch: {influencerId: influencerId, confirmation: "wait"},
                    },
                    $or: [
                        {verifyPromo: "accept"},
                        {verifyCampaign: "accept"},
                    ],
                })
                .lean();

            if (!campaigns) {
                return {
                    code: 404,
                    message: "Campaigns not found",
                };
            }

            const allSocialMediaAccounts = campaigns.flatMap((item) => {
                return item.selectInfluencers.flatMap((acc) => {
                    if (acc.confirmation !== 'wait' || acc.influencerId.toString() !== influencerId) return [];

                    const {selectInfluencers, ...newObject} = item;
                    const {_id, ...newObjectSocialMediaAccount} = acc;

                    if (acc.selectedCampaignContentItem) {
                        const selectedCampaignContentItem = item.campaignContent.find((item) => item._id.toString() === acc.selectedCampaignContentItem);

                        return {
                            selectInfluencersId: acc._id,
                            influencerId: newObjectSocialMediaAccount.influencerId,
                            campaignName: newObject.campaignName,
                            videoLink: selectedCampaignContentItem.videoLink,
                            postDescription: selectedCampaignContentItem.postDescription,
                            storyTag: selectedCampaignContentItem.storyTag,
                            swipeUpLink: selectedCampaignContentItem.swipeUpLink,
                            specialWishes: selectedCampaignContentItem.specialWishes,
                            socialMediaUsername: newObjectSocialMediaAccount.socialMediaUsername || (newObjectSocialMediaAccount as any).instagramUsername,
                            userId: newObject.clientId || (newObject as any).userId,
                            dateRequest: newObjectSocialMediaAccount.dateRequest,
                            createdAt: newObject.createdAt,
                            socialMedia: newObject.socialMedia,
                            campaignId: newObject._id,
                        };
                    } else if ((acc as any).selectedVideo) {
                        const selectedVideoObj = (item as any).videos.find((video) => video.videoLink === (acc as any).selectedVideo);

                        return [{
                            selectInfluencersId: acc._id,
                            influencerId: newObjectSocialMediaAccount.influencerId,
                            campaignName: newObject.campaignName,
                            videoLink: selectedVideoObj.videoLink,
                            postDescription: selectedVideoObj.postDescription,
                            storyTag: selectedVideoObj.storyTag,
                            swipeUpLink: selectedVideoObj.swipeUpLink,
                            specialWishes: selectedVideoObj.specialWishes,
                            socialMediaUsername: newObjectSocialMediaAccount.socialMediaUsername || (newObjectSocialMediaAccount as any).instagramUsername,
                            userId: newObject.clientId || (newObject as any).userId,
                            dateRequest: newObjectSocialMediaAccount.dateRequest,
                            createdAt: newObject.createdAt,
                            socialMedia: newObject.socialMedia,
                            campaignId: newObject._id,
                        }];
                    }

                    return [];
                });
            }).filter(Boolean);

            const filteredByInfluencerId = allSocialMediaAccounts.filter((item) => (item as any).influencerId.toString() === influencerId);

            const campaignsWithClientName = await Promise.all(
                filteredByInfluencerId.map(async (item) => {
                    const client = await this.clientModel.findById((item as any).clientId || (item as any).userId);
                    const clientName = client.company || client.firstName || "No information";

                    return {
                        ...item,
                        client: clientName,
                    };
                })
            );

            return {
                code: 200,
                promos: campaignsWithClientName.flat().sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime()),
            };
        } catch (err) {
            console.log(err);
            return {
                code: 500,
                message: err,
            };
        }
    }

    async influencerUpdateResponseNewCampaign(
        influencerId: string,
        socialMediaUsername: string,
        campaignId: string,
        campaignResponse: string,
        selectInfluencersId: string
    ) {
        if (!influencerId || !socialMediaUsername || !campaignId || !campaignResponse) {
            return {
                status: 400,
                message: "Not enough arguments",
            };
        }

        try {
            const findNewCampaign = await this.promosModel
                .findById(campaignId)
                .lean()
                .exec();

            if (!findNewCampaign) {
                return {
                    code: 404,
                    message: "Promo not found",
                };
            }

            if (campaignResponse === "accept") {
                const price = parseInt(findNewCampaign.selectInfluencers.find(influencer => influencer.socialMediaUsername === socialMediaUsername || (influencer as any).instagramUsername === socialMediaUsername).price.replace(/\D/g, ''));

                const resultOfSavingHistory = await axios.post(`${process.env.SERVER}/influencer-actions-history/upsert/campaign`, {
                    influencerId: influencerId,
                    campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                    campaignName: findNewCampaign.campaignName,
                    updatedCampaignAction: {
                        actionNumber: 1,
                        networkUsername: socialMediaUsername,
                        rewardForInfluencer: price,
                    },
                });

                if (resultOfSavingHistory.data.code !== 200) {
                    console.error('Error saving history:', resultOfSavingHistory.data.message);
                    return {
                        code: 500,
                        message: 'Internal Server Error',
                    }
                }

                const updateNewPromo = await this.promosModel.findOneAndUpdate(
                    {
                        _id: campaignId,
                        selectInfluencers: {
                            $elemMatch: {
                                _id: new mongoose.Types.ObjectId(selectInfluencersId),
                            },
                        },
                    },
                    {
                        $set: {
                            ...(findNewCampaign.statusCampaign ? {'statusCampaign': 'work'} : {'statusPromo': 'work'}),
                            'selectInfluencers.$.confirmation': campaignResponse,
                        }
                    },
                );

                const checkUserInfluencer = await this.influencerModel.findById(influencerId);
                const checkUserClient = await this.clientModel.findById(findNewCampaign.clientId || (findNewCampaign as any).userId);

                await sendMail(
                    "nazarkozynets030606@zohomail.eu",
                    // "admin@soundinfluencers.com",
                    "soundinfluencers",
                    `<p>${checkUserInfluencer.email} accepted the offer for ${checkUserClient.email}'s campaign</p>
                <p>Details:</p><br/>
                <p>Promo ID: ${findNewCampaign._id}</p>
                <p>Client Name: ${checkUserClient.firstName}</p>
                <p>Campaign Content: ${findNewCampaign.campaignContent ? findNewCampaign.campaignContent
                        .map((campaignContentItem) => `<a href="${campaignContentItem.videoLink}">${campaignContentItem.videoLink}</a>`)
                        .join(", ") : (findNewCampaign as any).videos.map((video) => `<a href="${video.videoLink}">${video.videoLink}</a>`)
                        .join(", ")}</p>`,
                    "html"
                );

                return {
                    code: 200,
                    updateNewPromo,
                };
            } else {
                const price = parseInt(findNewCampaign.selectInfluencers.find(influencer => influencer.socialMediaUsername === socialMediaUsername || (influencer as any).instagramUsername === socialMediaUsername).price.replace(/\D/g, ''));

                const resultOfSavingHistory = await axios.post(`${process.env.SERVER}/influencer-actions-history/upsert/campaign`, {
                    influencerId: influencerId,
                    campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                    campaignName: findNewCampaign.campaignName,
                    updatedCampaignAction: {
                        actionNumber: 2,
                        networkUsername: socialMediaUsername,
                        rewardForInfluencer: price,
                    },
                });

                if (resultOfSavingHistory.data.code !== 200) {
                    console.error('Error saving history:', resultOfSavingHistory.data.message);
                    return {
                        code: 500,
                        message: 'Internal Server Error',
                    }
                }

                const updatePromo = await this.promosModel.findOneAndUpdate(
                    {
                        _id: campaignId,
                        selectInfluencers: {
                            $elemMatch: {
                                _id: new mongoose.Types.ObjectId(selectInfluencersId),
                            },
                        },
                    },
                    {
                        $set: {
                            "selectInfluencers.$.confirmation": campaignResponse,
                            partialRefund: findNewCampaign.partialRefund + price,
                        },
                    },
                    {new: true}
                );

                const checkUserInfluencer = await this.influencerModel.findById(influencerId);
                const checkUserClient = await this.clientModel.findById(findNewCampaign.clientId || (findNewCampaign as any).userId);

                await sendMail(
                    "nazarkozynets030606@zohomail.eu",
                    // "admin@soundinfluencers.com",
                    "soundinfluencers",
                    `<p>${checkUserInfluencer.email} declined the offer for ${checkUserClient.email}'s campaign</p>
                <p>Details:</p><br/>
                <p>Promo ID: ${findNewCampaign._id}</p>
                <p>Client Name: ${checkUserClient.firstName}</p>
                <p>Campaign Content: ${findNewCampaign.campaignContent ? findNewCampaign.campaignContent
                        .map((campaignContentItem) => `<a href="${campaignContentItem.videoLink}">${campaignContentItem.videoLink}</a>`)
                        .join(", ") : (findNewCampaign as any).videos.map((video) => `<a href="${video.videoLink}">${video.videoLink}</a>`)
                        .join(", ")}</p>`,
                    "html"
                );

                return {
                    code: 200,
                    updatePromo,
                };
            }
        } catch (err) {
            console.log(err);
            return {
                code: 500,
                message: err.message || "Internal Server Error",
            };
        }
    }

    async influencerGetOngoingCampaigns(influencerId: string) {
        try {
            if (!influencerId) {
                return {
                    status: 400,
                    message: "Not enough arguments",
                };
            }

            const checkInfluencer = await this.influencerModel.findOne({
                _id: influencerId,
            });

            if (!checkInfluencer) {
                return {
                    code: 404,
                    message: "User not found",
                };
            }

            const campaigns = await this.promosModel
                .find({
                    selectInfluencers: {
                        $elemMatch: {
                            influencerId: influencerId,
                            confirmation: "accept",
                            closePromo: "wait",
                        },
                    },
                    $or: [
                        {statusPromo: "work"},
                        {statusCampaign: "work"},
                    ]
                })
                .lean();

            const allSocialMediaAccounts = campaigns.flatMap((item) => {
                return item.selectInfluencers.map((acc) => {
                    if (acc.confirmation === 'accept' && acc.closePromo === 'wait' && acc.influencerId.toString() === influencerId) {
                        return {
                            selectInfluencersId: acc._id,
                            instagramUsername: acc.socialMediaUsername || (acc as any).instagramUsername,
                            clientId: item.clientId,
                            promoId: item._id,
                            campaignName: item.campaignName,
                            socialMedia: item.socialMedia,
                            confirmation: acc.confirmation,
                            closePromo: acc.closePromo,
                            createdAt: item.createdAt,
                            influencerId: acc.influencerId,
                            selectedCampaignContentItem: acc.selectedCampaignContentItem,
                        };
                    }

                    return null;
                });
            }).filter(Boolean);

            const campaignsName = await Promise.all(
                allSocialMediaAccounts.map(async (item) => {
                    const client = await this.clientModel.findById(item.clientId);
                    const clientName = !client ? "No Date" : client.company;

                    return {
                        ...item,
                        client: clientName,
                        date: item.createdAt,
                    };
                })
            );

            return {
                code: 200,
                promos: campaignsName,
            };
        } catch (err) {
            console.log(err);
            return {
                code: 500,
                message: err,
            };
        }
    }

    async influencerGetOngoingCampaign(
        influencerId: string,
        campaignId: string,
        socialMediaUsername: string,
        selectInfluencersId: string
    ) {
        if (!influencerId || !campaignId || !socialMediaUsername) {
            return {
                status: 400,
                message: "Not enough arguments",
            };
        }

        const influencer = await this.influencerModel.findById(influencerId);
        if (!influencer) {
            return {
                code: 404,
                message: "Influencer not found",
            };
        }

        const campaign = await this.promosModel.findOne({
            _id: campaignId,
            selectInfluencers: {
                $elemMatch: {
                    influencerId: influencerId,
                    confirmation: "accept",
                    $or: [
                        {socialMediaUsername: socialMediaUsername},
                        {instagramUsername: socialMediaUsername},
                    ],
                },
            },
        }).lean();

        if (!campaign) {
            return {
                code: 404,
                message: "Promo not found",
            };
        }

        const client = await this.clientModel.findById(campaign.clientId || (campaign as any).userId);

        if (!client) {
            return {
                code: 404,
                message: "Client not found",
            };
        }

        const selectedInfluencerData = await Promise.all(
            campaign.selectInfluencers.map(async (item) => {
                if (item._id.toString() === selectInfluencersId) {
                    if (campaign.campaignContent) {
                        let selectedCampaignContentItem = campaign.campaignContent.find((campaignContentItem) => item.selectedCampaignContentItem === campaignContentItem._id.toString());

                        if (selectedCampaignContentItem) {
                            return {
                                selectInfluencersId: item._id,
                                dateRequest: item.dateRequest,
                                videoLink: selectedCampaignContentItem?.videoLink || "",
                                postDescription: selectedCampaignContentItem?.postDescription || "",
                                storyTag: selectedCampaignContentItem?.storyTag || "",
                                swipeUpLink: selectedCampaignContentItem?.swipeUpLink || "",
                                specialWishes: selectedCampaignContentItem?.specialWishes || "",
                            };
                        }
                    } else if ((campaign as any).videos) {
                        let selectedVideo = (campaign as any).videos.find((video) => (item as any).selectedVideo === video.videoLink);

                        if (selectedVideo) {
                            return {
                                dateRequest: item.dateRequest,
                                videoLink: selectedVideo.videoLink || "",
                                postDescription: selectedVideo.postDescription || "",
                                storyTag: selectedVideo.storyTag || "",
                                swipeUpLink: selectedVideo.swipeUpLink || "",
                                specialWishes: selectedVideo.specialWishes || "",
                            };
                        }
                    }
                } else {
                    return null;
                }
            })
        );

        const filteredSelectedInfluencerData = selectedInfluencerData.filter(data => data !== null);

        if (filteredSelectedInfluencerData !== null) {
            try {
                return {
                    code: 200,
                    promo: {
                        socialMedia: campaign.socialMedia,
                        client: client.company,
                        socialNetworkUsername: socialMediaUsername,
                        videoLink: filteredSelectedInfluencerData[0].videoLink || (filteredSelectedInfluencerData as any).videoLink,
                        postDescription: filteredSelectedInfluencerData[0].postDescription || (filteredSelectedInfluencerData as any).postDescription,
                        storyTag: filteredSelectedInfluencerData[0].storyTag || (filteredSelectedInfluencerData as any).storyTag,
                        swipeUpLink: filteredSelectedInfluencerData[0].swipeUpLink || (filteredSelectedInfluencerData as any).swipeUpLink,
                        specialWishes: filteredSelectedInfluencerData[0].specialWishes || (filteredSelectedInfluencerData as any).specialWishes,
                        dateRequest: filteredSelectedInfluencerData[0].dateRequest || (filteredSelectedInfluencerData as any).dateRequest,
                        selectInfluencersId: filteredSelectedInfluencerData[0].selectInfluencersId || null,
                        campaignName: campaign.campaignName,
                    },
                };
            } catch (err) {
                console.log(err, "Error influencerGetOngoingCampaign", new Date());
                return {
                    code: 500,
                    message: err,
                };
            }
        } else {
            return {
                code: 404,
                message: "Selected influencer not found",
            };
        }
    }

    async influencerUpdateOngoingCampaign(
        influencerId: string,
        socialMediaUsername: string,
        campaignId: string,
        selectInfluencersId: string,
        data: any,
    ) {
        if (!influencerId || !campaignId || !socialMediaUsername) {
            return {
                code: 400,
                message: "Not enough arguments",
            };
        }

        try {
            const findNewCampaign = await this.promosModel
                .findOne({
                    _id: campaignId,
                    selectInfluencers: {
                        $elemMatch: {
                            influencerId: influencerId,
                            $or: [
                                {socialMediaUsername: socialMediaUsername},
                                {instagramUsername: socialMediaUsername},
                            ],
                        },
                    },
                })
                .lean()
                .exec();

            if (!findNewCampaign) {
                return {
                    code: 404,
                    message: "not found",
                };
            }

            const dataSocialMediaAccount = findNewCampaign.selectInfluencers.find(
                (item) =>
                    item._id.toString() === selectInfluencersId
            );

            const paymentGo = async () => {
                const checkInfluencer =
                    await this.influencerModel.findById(influencerId);

                const currentSocialMediaAccount = checkInfluencer[dataSocialMediaAccount.socialMedia].find(
                    (item) => item.instagramUsername === socialMediaUsername
                );

                await this.influencerModel.findOneAndUpdate(
                    {_id: influencerId},
                    {
                        balance: String(
                            Number(checkInfluencer.balance) +
                            (+currentSocialMediaAccount.price.replace(/[^\d]/g, ""))
                        ),
                    }
                );
            };

            let updateNewCampaign;
            try {
                updateNewCampaign = await (async () => {
                    if ((findNewCampaign.socialMedia === 'spotify' || findNewCampaign.socialMedia === 'soundcloud')) {
                        if (data.screenshot === '' || data.screenshot === null) {
                            console.error(`Screenshot is empty (Updating spotify campaign: ${campaignId})`);
                            return {
                                code: 400,
                                message: 'Screenshot is empty',
                            };
                        }

                        const isPromoAlreadyClosed = dataSocialMediaAccount.closePromo === "close";

                        const resultOfSavingHistory = await axios.post(`${process.env.SERVER}/influencer-actions-history/upsert/campaign`, {
                            influencerId: influencerId,
                            campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                            campaignName: findNewCampaign.campaignName,
                            updatedCampaignAction: {
                                actionNumber: 3,
                                networkUsername: socialMediaUsername,
                                rewardForInfluencer: parseInt(findNewCampaign.selectInfluencers.find(influencer => influencer.socialMediaUsername === socialMediaUsername || (influencer as any).instagramUsername === socialMediaUsername).price.replace(/\D/g, '')),
                            },
                        });

                        if (resultOfSavingHistory.data.code !== 200) {
                            console.error('Error saving history:', resultOfSavingHistory.data.message);
                            return {
                                code: 500,
                                message: 'Internal Server Error',
                            }
                        }

                        try {
                            await this.promosModel.findOneAndUpdate(
                                {
                                    _id: campaignId,
                                    selectInfluencers: {
                                        $elemMatch: {
                                            influencerId: influencerId,
                                            $or: [
                                                {socialMediaUsername: socialMediaUsername},
                                                {instagramUsername: socialMediaUsername},
                                            ]
                                        },
                                    },
                                },
                                {
                                    $set: Object.fromEntries(
                                        Object.entries({
                                            ...dataSocialMediaAccount,
                                            ...data,
                                            closePromo: "close",
                                        }).map(([key, value]) => [`selectInfluencers.$.${key}`, value])
                                    ),
                                }
                            );

                            if (!isPromoAlreadyClosed) await paymentGo();

                            return {
                                code: 200,
                            }
                        } catch (err) {
                            console.error('Error updating promo:', err);
                            return {
                                code: 500,
                                message: 'Internal Server Error',
                            };
                        }
                    } else if (findNewCampaign.socialMedia === "press") {
                        if (data.postLink === '' || data.postLink === null) return {
                            code: 400,
                            message: `Post link is empty (Updating press campaign: ${campaignId})`,
                        };

                        const isPromoAlreadyClosed = dataSocialMediaAccount.closePromo === "close";

                        const resultOfSavingHistory = await axios.post(`${process.env.SERVER}/influencer-actions-history/upsert/campaign`, {
                            influencerId: influencerId,
                            campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                            campaignName: findNewCampaign.campaignName,
                            updatedCampaignAction: {
                                actionNumber: 3,
                                networkUsername: socialMediaUsername,
                                rewardForInfluencer: parseInt(findNewCampaign.selectInfluencers.find(influencer => influencer.socialMediaUsername === socialMediaUsername || (influencer as any).instagramUsername === socialMediaUsername).price.replace(/\D/g, '')),
                            },
                        });

                        if (resultOfSavingHistory.data.code !== 200) {
                            console.error('Error saving history:', resultOfSavingHistory.data.message);
                            return {
                                code: 500,
                                message: 'Internal Server Error',
                            }
                        }

                        try {
                            await this.promosModel.findOneAndUpdate(
                                {
                                    _id: campaignId,
                                    selectInfluencers: {
                                        $elemMatch: {
                                            influencerId: influencerId,
                                            $or: [
                                                {socialMediaUsername: socialMediaUsername},
                                                {instagramUsername: socialMediaUsername},
                                            ],
                                        },
                                    },
                                },
                                {
                                    $set: Object.fromEntries(
                                        Object.entries({
                                            ...dataSocialMediaAccount,
                                            ...data,
                                            closePromo: "close",
                                        }).map(([key, value]) => [`selectInfluencers.$.${key}`, value])
                                    ),
                                }
                            );

                            if (!isPromoAlreadyClosed) await paymentGo();

                            return {
                                code: 200,
                            }
                        } catch (err) {
                            console.error('Error updating promo:', err);
                            return {
                                code: 500,
                                message: 'Internal Server Error',
                            };
                        }
                    } else if (
                        data.postLink &&
                        data.impressions &&
                        data.like &&
                        data.screenshot
                    ) {
                        const isPromoAlreadyClosed = dataSocialMediaAccount.closePromo === "close";

                        const resultOfSavingHistory = await axios.post(`${process.env.SERVER}/influencer-actions-history/upsert/campaign`, {
                            influencerId: influencerId,
                            campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                            campaignName: findNewCampaign.campaignName,
                            updatedCampaignAction: {
                                actionNumber: 3,
                                networkUsername: socialMediaUsername,
                                rewardForInfluencer: parseInt(findNewCampaign.selectInfluencers.find(influencer => influencer.socialMediaUsername === socialMediaUsername || (influencer as any).instagramUsername === socialMediaUsername).price.replace(/\D/g, '')),
                            },
                        });

                        if (resultOfSavingHistory.data.code !== 200) {
                            console.error('Error saving history:', resultOfSavingHistory.data.message);
                            return {
                                code: 500,
                                message: 'Internal Server Error',
                            }
                        }

                        try {
                            await this.promosModel.findOneAndUpdate(
                                {
                                    _id: campaignId,
                                    selectInfluencers: {
                                        $elemMatch: {
                                            _id: new mongoose.Types.ObjectId(selectInfluencersId),
                                        },
                                    },
                                },
                                {
                                    $set: Object.fromEntries(
                                        Object.entries({
                                            ...dataSocialMediaAccount,
                                            ...data,
                                            closePromo: "close",
                                        }).map(([key, value]) => [`selectInfluencers.$.${key}`, value])
                                    ),
                                }
                            );

                            if (!isPromoAlreadyClosed) await paymentGo();

                            return {
                                code: 200,
                            }
                        } catch (err) {
                            console.error('Error updating promo:', err);
                            return {
                                code: 500,
                                message: 'Internal Server Error',
                            };
                        }
                    }
                })();
            } catch (err) {
                console.error('Error updating promo:', err);
                return {
                    code: 500,
                    message: 'Internal Server Error',
                };
            }

            if (!updateNewCampaign || updateNewCampaign.code === 500) {
                return {
                    code: 500,
                    message: 'Internal Server Error',
                };
            }

            let checkCampaign = true;
            findNewCampaign.selectInfluencers.forEach((item) => {
                if (item.confirmation === "refusing") return;
                if (((data.socialMedia === 'spotify' || data.socialMedia === 'soundcloud') && (data.screenshot || item.screenshot)) || item.closePromo === "close") {
                    if (item.closePromo === "close") return;
                } else if ((data.socialMedia === "press" && (data.postLink || item.postLink)) || item.closePromo === "close") {
                    if (item.closePromo === "close") return;
                } else if (item.socialMediaUsername === socialMediaUsername || (item as any).instagramUsername === socialMediaUsername) {
                    if (
                        data.postLink &&
                        data.impressions &&
                        data.like &&
                        data.screenshot
                    ) {
                        return;
                    }
                } else if (
                    item.postLink &&
                    item.impressions &&
                    item.like &&
                    item.screenshot
                ) {
                    return;
                } else {
                    checkCampaign = false;
                }
            });

            if (checkCampaign) {
                let totalFollowers = 0;

                const selectInfluencers = await Promise.all(
                    findNewCampaign.selectInfluencers.map(async (item) => {
                        const checkInfluencer = await this.influencerModel.findById(item.influencerId);
                        const currentAccount = checkInfluencer[item.socialMedia]?.find(
                            (fin) => fin.instagramUsername === item.socialMediaUsername || fin.instagramUsername === (item as any).instagramUsername
                        );

                        if (!currentAccount) {
                            throw new Error(`Instagram data not found for influencerId: ${item.influencerId}`);
                        }

                        totalFollowers += parseInt(currentAccount.followersNumber);

                        return {
                            ...item,
                            postLink: item.postLink || data.postLink,
                            impressions: item.impressions || data.impressions,
                            like: item.like || data.like,
                            screenshot: item.screenshot || data.screenshot,
                            confirmation: "accept",
                            closePromo: "close",
                            followersNumber: parseInt(currentAccount.followersNumber),
                        };
                    })
                );

                try {
                    await this.promosCopiesModel.create({
                        ...findNewCampaign,
                        _id: findNewCampaign._id,
                        statusCampaign: "finally",
                        verifyCampaign: "accept",
                        isCopy: true,
                        totalFollowers: totalFollowers,
                        selectInfluencers: selectInfluencers,
                    });
                } catch (err) {
                    throw new Error(`Error creating promo copy: ${err}`);
                }

                try {
                    await this.promosModel.deleteOne({_id: campaignId});
                } catch (err) {
                    throw new Error(`Error deleting promo: ${err}`);
                }
            }

            return {
                code: 200,
            };
        } catch (err) {
            return {
                code: 500,
                message: err,
            };
        }
    }

    async uploadDropBox(file: any) {
        const dropboxService = new DropboxService();
        const screenshotUrl = await dropboxService.uploadFile(file.buffer, file.originalname);
        return {
            code: 200,
            data: screenshotUrl,
        };
    }

    async getCampaignByPublicShareLink(campaignId: string, socialMedia: string) {
        try {
            if (!campaignId) {
                return {
                    status: 400,
                    message: "Not enough arguments",
                };
            }

            if (!mongoose.Types.ObjectId.isValid(campaignId)) {
                return {
                    status: 400,
                    message: "Invalid campaignId format",
                };
            }

            let campaign = await this.promosModel
                .findOne({
                    _id: new mongoose.Types.ObjectId(campaignId),
                    socialMedia: socialMedia,
                })
                .lean();

            if (!campaign) {
                try {
                    campaign = await this.promosCopiesModel
                        .findOne({
                            _id: new mongoose.Types.ObjectId(campaignId),
                            socialMedia: socialMedia,
                        })
                        .lean();
                } catch (err) {
                    console.error("Error fetching promo copy by public share link:", err);
                }
            }

            if (!campaign) {
                return {
                    code: 404,
                    message: "Promo not found",
                };
            }

            return {
                code: 200,
                campaign: {
                    ...campaign,
                    selectInfluencers: campaign.selectInfluencers.map((item) => {
                        return {
                            ...item,
                            socialMediaUsername: item.socialMediaUsername || (item as any).instagramUsername,
                            selectedCampaignContentItem: item.selectedCampaignContentItem || (item as any).selectedVideo,
                            selectedCampaignContentItemObj: campaign.campaignContent ? campaign.campaignContent.find((campaignContentItem) => campaignContentItem._id.toString() === item.selectedCampaignContentItem) : (campaign as any).videos ? (campaign as any).videos.find((video) => video.videoLink === (item as any).selectedVideo) : null,
                        };
                    }),
                    amount: campaign.campaignPrice || (campaign as any).amount || 0,
                    campaignContent: campaign.campaignContent || (campaign as any).videos,
                },
            };
        } catch (err) {
            console.error("Error fetching promo by public share link:", err);

            return {
                code: 500,
                message: "An error occurred while fetching the promo.",
            };
        }
    }

    async migrateClosedPromosToPromosCopies() {
        const closedCampaigns = await this.promosModel.find({statusCampaign: 'finally'}).lean().exec();

        if (!closedCampaigns) {
            return {
                code: 404,
                message: 'No closed promos found',
            };
        }

        for (const campaign of closedCampaigns) {
            let totalFollowers = 0

            const selectInfluencers = await Promise.all(
                campaign.selectInfluencers.map(async (item) => {
                    const influencer = await this.influencerModel.findById(item.influencerId);
                    const socialMediaAccount = influencer.instagram.find(
                        (insta) => insta.instagramUsername === item.socialMediaUsername
                    );

                    if (!socialMediaAccount) {
                        console.error(
                            `Instagram account not found for influencerId: ${item.influencerId}, instagramUsername: ${item.socialMediaUsername}`
                        );
                        return {
                            ...item,
                            price: 0,
                            publicPrice: 0,
                            followersNumber: 0,
                        };
                    }

                    const followersNumber = parseInt(socialMediaAccount.followersNumber || '0', 10);
                    const price = parseInt(socialMediaAccount.price || '0', 10);
                    const publicPrice = parseInt(socialMediaAccount.publicPrice || '0', 10);

                    totalFollowers += followersNumber;

                    return {
                        ...item,
                        price: price,
                        publicPrice: publicPrice,
                        followersNumber: followersNumber,
                    };
                })
            );

            await this.promosCopiesModel.create({
                ...campaign,
                statusCampaign: 'finally',
                verifyCampaign: 'accept',
                isCopy: true,
                totalFollowers: totalFollowers,
                selectInfluencers: selectInfluencers,
                socialMedia: 'instagram',
                amount: campaign.campaignPrice,
            });

            await this.promosModel.deleteOne({_id: campaign._id});
        }
    }

    async getSelectedSocialMediaAccountsForCampaignStrategy(data: GetSelectedSocialAccountsDto) {
        if (!data) {
            return {
                code: 400,
                message: 'Not enough arguments',
            };
        }

        try {
            const {selectedAccounts, socialMedia} = data;
            const dataToSend = {
                totalFollowers: 0,
                selectedAccounts: [],
            };

            for (const item of selectedAccounts) {
                const influencer = await this.influencerModel.findById(item.influencerId);
                if (!influencer) {
                    throw new Error(`Influencer with ID ${item.influencerId} not found`);
                }

                const account = influencer[socialMedia].find(
                    (socialMediaAccount) => socialMediaAccount.instagramUsername === item.instagramUsername
                );
                if (!account) {
                    throw new Error(`Social media account with username ${item.instagramUsername} not found`);
                }

                const followersNumber = parseInt(account.followersNumber);
                dataToSend.totalFollowers += followersNumber;

                dataToSend.selectedAccounts.push(account);
            }

            if (dataToSend.selectedAccounts.length === 0) {
                return {
                    code: 404,
                    message: 'No social media accounts found',
                };
            }

            return {
                code: 200,
                data: dataToSend,
            };
        } catch (err) {
            console.error('Error fetching selected social media accounts for campaign strategy:', err);

            return {
                code: 500,
                message: 'Error fetching selected social media accounts for campaign strategy',
            };
        }
    }

    async addIdsToContentItems() {
        const promos = await this.promosModel.find().lean().exec();

        const bulkOps = promos.map((promo, index) => {
            console.log(`Processing promo ${index + 1} ${promo.campaignName} of ${promos.length}`);
            if (!promo.campaignContent) return;

            promo.campaignContent = promo.campaignContent.map(contentItem => ({
                ...contentItem,
                _id: new mongoose.Types.ObjectId(),
            }));

            if (promo.selectInfluencers) {
                promo.selectInfluencers = promo.selectInfluencers.map(influencer => {
                    if (influencer.selectedCampaignContentItem) {
                        const contentItem = promo.campaignContent.find(contentItem =>
                            contentItem.videoLink === influencer.selectedCampaignContentItem
                        );
                        if (contentItem) {
                            influencer.selectedCampaignContentItem = contentItem._id.toString();
                        }
                    }
                    return influencer;
                });
            }

            return {
                updateOne: {
                    filter: {_id: promo._id},
                    update: {
                        $set: {
                            campaignContent: promo.campaignContent,
                            selectInfluencers: promo.selectInfluencers
                        }
                    }
                }
            };
        }).filter(op => op !== null);

        if (bulkOps.length > 0) {
            await this.promosModel.bulkWrite(bulkOps);
        }
    }

    async updateOffer() {
        try {
            const offer = await this.offersModel.findOne({id: 27.5});

            if (!offer) {
                console.error('Offer not found');
                return;
            }

            if (Array.isArray(offer.connectInfluencer)) {
                offer.connectInfluencer = offer.connectInfluencer.map(influencer => ({
                    instagramUsername: influencer.instagramUsername,
                    influencerId: influencer.influencerId || (influencer as any)._id,
                }));
            }

            await offer.save();

            console.log('Offer updated:', offer);
        } catch (err) {
            console.error('Error updating offer:', err);
        }
    }
}