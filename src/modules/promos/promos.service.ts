import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Campaign, CampaignContentItem, SelectInfluencers} from '../campaigns/schemas/campaign.schema';
import mongoose, {ClientSession} from 'mongoose';
import {CompletedCampaign} from '../campaigns/schemas/completed-campaign.schema';
import axios from 'axios';
import * as process from 'node:process';
import {CampaignStatusType} from "../../common/types/client/campaign.types";
import {SocialMediaType} from "../../common/types/social-media.types";
import sendMail from "../../integrations/nodemailer/nodemailer";
import {DropboxService} from "../../integrations/dropbox/dropbox";
import {Client} from "../../database/schemas/users/client.schema";
import {Influencer} from "../../database/schemas/users/influencer.schema";
import {
    InfluencerGetPastPromoQueryDto, InfluencerUpdatePromoReqQueryDto,
    InfluencerUpdatePromoResponseUpdateDto
} from "./dto/influencer-get-promos.dto";
import {
    InfluencerConfirmationStatusType,
    InfluencerPromo, InfluencerPromoClosedStatusType,
    InfluencerPromoRequest,
} from "../../common/types/influencer/promo.types";

mongoose.Promise = global.Promise;

@Injectable()
export class PromosService {
    private readonly logger = new Logger();

    constructor(
        @InjectModel(Campaign.name)
        private campaignModel: mongoose.Model<Campaign>,
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
        @InjectModel(CompletedCampaign.name)
        private completedCampaignModel: mongoose.Model<CompletedCampaign>,
    ) {
    }
    // TODO: add logic for getting completed promo or ongoing (through strategy)

    async checkUploadStatus(fileName: string): Promise<boolean> {
        const dropboxService = new DropboxService();
        return await dropboxService.isFileUploaded(fileName);
    }

    // Returns influencer past promo (find by id, selectInfluencersId)
    async influencerPastPromoOne(data: InfluencerGetPastPromoQueryDto & { influencerId: string }): Promise<InfluencerPromo> {
        const {influencerId, campaignId, selectInfluencersId} = data;

        if (!influencerId || !campaignId || !selectInfluencersId) throw new BadRequestException('Not enough arguments');

        const influencer = await this.influencerModel.findById(influencerId);
        if (!influencer) throw new NotFoundException('Influencer not found')

        let campaign = await this.completedCampaignModel.findOne({_id: campaignId}).lean().exec();

        if (!campaign) {
            campaign = (await this.campaignModel.findOne({_id: campaignId}).lean().exec()) as any;

            if (!campaign) throw new NotFoundException('Campaign not found');
        }

        const client = await this.clientModel.findById(campaign.clientId || (campaign as any).userId);

        if (!client) throw new NotFoundException('Client not found');

        const selectedAccount = campaign.selectInfluencers.find((influencerItem) => influencerItem._id.toString() === selectInfluencersId);

        if (!selectedAccount) throw new NotFoundException(`Influencer's social account not found in this campaign`);

        let contentItem: {
            _id: string,
            videoLink: string,
            postDescription: string,
            storyTag: string,
            storyLink: string,
            specialWishes: string,
        } | null = null;

        if (selectedAccount.selectedContent?.campaignContentItemId || (selectedAccount as any).selectedCampaignContentItem) {
            const foundContent = campaign.campaignContent.find(
                (item) =>
                    item._id.toString() === selectedAccount.selectedContent?.campaignContentItemId?.toString() || item._id.toString() === (selectedAccount as any).selectedCampaignContentItem,
            );

            if (foundContent) {
                const foundPostDescription =
                    foundContent.postDescriptions?.find(
                        (pd) => pd._id.toString() === selectedAccount.selectedContent?.postDescriptionId.toString(),
                    )?.description ?? (foundContent as any).postDescription ?? '';

                contentItem = {
                    _id: foundContent._id.toString(),
                    videoLink: foundContent.videoLink,
                    postDescription: foundPostDescription || null,
                    storyTag: foundContent.storyTag || null,
                    storyLink: foundContent.swipeUpLink || null,
                    specialWishes: foundContent.specialWishes,
                };
            }
        }

        if (!contentItem) throw new NotFoundException(`Content item not found`);

        return {
            campaignId: campaignId,
            campaignName: campaign.campaignName,
            influencerId: influencerId,
            selectInfluencersId: data.selectInfluencersId,
            socialMediaUsername:
                selectedAccount.socialMediaUsername || (selectedAccount as any).instagramUsername,
            dateRequest: selectedAccount.dateRequest,
            createdAt: campaign.createdAt,
            client: client?.company || client?.firstName || 'No information',
            socialMedia: campaign.socialMedia as SocialMediaType,
            videoLink: (contentItem as any).videoLink,
            postDescription: (contentItem as any).postDescription,
            storyTag: (contentItem as any).storyTag,
            storyLink: (contentItem as any).swipeUpLink,
            additionalBrief: (contentItem as any).specialWishes,
            statusCampaign: campaign.statusCampaign as CampaignStatusType,
            closedStatus: "closed" as InfluencerPromoClosedStatusType,
            confirmation: "accept" as InfluencerConfirmationStatusType
        };
    }

    // Gets new promo requests for influencer (find by influencerId)
    async influencerGetNewPromos(influencerId: string): Promise<InfluencerPromoRequest[]> {
        if (!influencerId) throw new BadRequestException('Not enough arguments');

        const checkInfluencer = await (async () => {
            const influencer = await this.influencerModel.findOne({
                _id: influencerId,
            });

            if (influencer) {
                return influencer;
            }
        })();

        if (!checkInfluencer) throw new NotFoundException('Influencer not found');

        const promos = await this.campaignModel
            .find({
                selectInfluencers: {
                    $elemMatch: {influencerId: influencerId, confirmation: 'wait'},
                },
                $or: [{verifyPromo: 'accept'}, {verifyCampaign: 'accept'}],
            })
            .lean();

        if (!promos) return [];

        const allSocialMediaAccounts = promos
            .flatMap((item) => {
                return item.selectInfluencers.flatMap((acc): any[] => {
                    if (acc.confirmation !== 'wait' || acc.influencerId.toString() !== influencerId)
                        return [];

                    const {selectInfluencers, ...newObject} = item;
                    const {_id, ...newObjectSocialMediaAccount} = acc;

                    if (acc.selectedContent?.campaignContentItemId) {
                        const selectedCampaignContentItem = item.campaignContent.find(
                            (item) => item._id.toString() === acc.selectedContent?.campaignContentItemId.toString(),
                        );

                        const postDescription = selectedCampaignContentItem?.postDescriptions?.find(
                            (pd) => pd._id.toString() === acc.selectedContent?.postDescriptionId?.toString(),
                        )?.description ?? "";

                        return [{
                            campaignId: newObject._id.toString(),
                            influencerId: newObjectSocialMediaAccount.influencerId.toString(),
                            selectInfluencersId: acc._id.toString(),
                            campaignName: newObject.campaignName,
                            socialMediaUsername:
                                newObjectSocialMediaAccount.socialMediaUsername ||
                                (newObjectSocialMediaAccount as any).instagramUsername,
                            socialMedia: acc.socialMedia as SocialMediaType,
                            dateRequest: newObjectSocialMediaAccount.dateRequest,
                            createdAt: newObject.createdAt,
                            videoLink: selectedCampaignContentItem.videoLink,
                            postDescription: postDescription,
                            storyTag: selectedCampaignContentItem.storyTag,
                            storyLink: selectedCampaignContentItem.swipeUpLink,
                            additionalBrief: selectedCampaignContentItem.specialWishes,
                            userId: newObject.clientId || (newObject as any).userId,
                        }];
                    } else if ((acc as any).selectedVideo) {
                        const selectedVideoObj = (item as any).videos.find(
                            (video) => video.videoLink === (acc as any).selectedVideo,
                        );

                        return [
                            {
                                campaignId: newObject._id.toString(),
                                influencerId: newObjectSocialMediaAccount.influencerId.toString(),
                                selectInfluencersId: acc._id.toString(),
                                campaignName: newObject.campaignName,
                                socialMediaUsername:
                                    newObjectSocialMediaAccount.socialMediaUsername ||
                                    (newObjectSocialMediaAccount as any).instagramUsername,
                                socialMedia: newObject.socialMedia as SocialMediaType,
                                dateRequest: newObjectSocialMediaAccount.dateRequest,
                                createdAt: newObject.createdAt,
                                videoLink: selectedVideoObj.videoLink,
                                postDescription: selectedVideoObj.postDescription,
                                storyTag: selectedVideoObj.storyTag,
                                storyLink: selectedVideoObj.swipeUpLink,
                                additionalBrief: selectedVideoObj.specialWishes,
                                userId: newObject.clientId || (newObject as any).userId,
                            },
                        ];
                    }

                    return [];
                });
            })
            .filter(Boolean);

        const filteredByInfluencerId = allSocialMediaAccounts.filter(
            (item) => (item as any).influencerId.toString() === influencerId,
        );

        const promosWithClientName: InfluencerPromoRequest[] = await Promise.all(
            filteredByInfluencerId.map(async (item) => {
                const client = await this.clientModel.findById(
                    (item as any).clientId || (item as any).userId,
                );
                const clientName = client.company || client.firstName || 'No information';

                return {
                    ...item,
                    client: clientName,
                };
            }),
        );

        return promosWithClientName.flat().sort(
            (a, b) =>
                new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime())
    };

    async influencerUpdateResponseNewCampaign(data: InfluencerUpdatePromoResponseUpdateDto & { influencerId: string }) {
        const {influencerId, socialMediaUsername, campaignId, campaignResponse, selectInfluencersId} = data;

        if (!socialMediaUsername || !campaignId || !campaignResponse || !selectInfluencersId) throw new BadRequestException('Not enough arguments');

        const findNewCampaign = await this.campaignModel.findById(campaignId).lean().exec();

        if (!findNewCampaign) throw new NotFoundException('Promo not found');

        if (campaignResponse === 'accept') {
            const selectInfluencersAcc = findNewCampaign.selectInfluencers.find(
                (influencer) => influencer._id.toString() === selectInfluencersId,
            );

            const resultOfSavingHistory = await axios.post(
                `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
                {
                    influencerId: influencerId,
                    campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                    campaignName: findNewCampaign.campaignName,
                    updatedCampaignAction: {
                        actionNumber: 1,
                        networkUsername: socialMediaUsername,
                        socialMedia: selectInfluencersAcc.socialMedia,
                        rewardForInfluencer: selectInfluencersAcc.price.replace(/\D/g, ''),
                    },
                },
            );

            if (resultOfSavingHistory.data.code !== 200) throw new InternalServerErrorException('Something went wrong');

            const updateNewPromo = await this.campaignModel.findOneAndUpdate(
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
                        ...(findNewCampaign.statusCampaign
                            ? {statusCampaign: 'work'}
                            : {statusPromo: 'work'}),
                        'selectInfluencers.$.confirmation': campaignResponse,
                    },
                },
            );

            const checkUserInfluencer = await this.influencerModel.findById(influencerId);
            const checkUserClient = await this.clientModel.findById(
                findNewCampaign.clientId || (findNewCampaign as any).userId,
            );

            const selectedCampaignContentItem = findNewCampaign.campaignContent?.find(
                (item) => item._id.toString() === selectInfluencersAcc.selectedContent?.campaignContentItemId.toString()
            );
            const selectedPostDescription = selectedCampaignContentItem?.postDescriptions?.find(
                (pd) => pd._id.toString() === selectInfluencersAcc.selectedContent?.postDescriptionId.toString()
            )?.description ?? '';

            await sendMail(
                // 'nazarkozynets030606@zohomail.eu',
                'admin@soundinfluencers.com',
                'SoundInfluencers',
                `<p>${checkUserInfluencer.email} accepted the offer for ${checkUserClient.email}'s campaign</p><br/>
    <p><b>Details:</b></p>
    <p><b>Campaign Name:</b> ${findNewCampaign.campaignName}</p>
    <p><b>Client Name:</b> ${checkUserClient.firstName}</p>
    <p><b>Campaign Content:</b><br/>
  ${
                    selectedCampaignContentItem
                        ? `<div style="margin-bottom:10px;">
          <a href="${selectedCampaignContentItem.videoLink}">${selectedCampaignContentItem.videoLink}</a>
          ${selectedPostDescription ? `<p><b>Description:</b> ${selectedPostDescription}</p>` : ''}
          ${selectedCampaignContentItem.storyTag ? `<p><b>Story Tag:</b> ${selectedCampaignContentItem.storyTag}</p>` : ''}
          ${selectedCampaignContentItem.swipeUpLink ? `<p><b>Swipe Up Link:</b> ${selectedCampaignContentItem.swipeUpLink}</p>` : ''}
          ${selectedCampaignContentItem.specialWishes ? `<p><b>Special Wishes:</b> ${selectedCampaignContentItem.specialWishes}</p>` : ''}
        </div>`
                        : ''
                }
</p>`,
                'html',
            );

            return;
        } else {
            const selectInfluencersAcc = findNewCampaign.selectInfluencers.find(
                (influencer) => influencer._id.toString() === selectInfluencersId,
            );

            const resultOfSavingHistory = await axios.post(
                `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
                {
                    influencerId: influencerId,
                    campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                    campaignName: findNewCampaign.campaignName,
                    updatedCampaignAction: {
                        actionNumber: 2,
                        networkUsername: socialMediaUsername,
                        socialMedia: selectInfluencersAcc.socialMedia,
                        rewardForInfluencer: selectInfluencersAcc.price.replace(/\D/g, ''),
                    },
                },
            );

            if (resultOfSavingHistory.data.code !== 200) throw new InternalServerErrorException('Something went wrong');

            const updatePromo = await this.campaignModel.findOneAndUpdate(
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
                        'selectInfluencers.$.confirmation': campaignResponse,
                        partialRefund:
                            findNewCampaign.partialRefund + selectInfluencersAcc.price.replace(/\D/g, ''),
                    },
                },
                {new: true},
            );

            const checkUserInfluencer = await this.influencerModel.findById(influencerId);
            const checkUserClient = await this.clientModel.findById(
                findNewCampaign.clientId || (findNewCampaign as any).userId,
            );

            await sendMail(
                // 'nazarkozynets030606@zohomail.eu',
                'admin@soundinfluencers.com',
                'SoundInfluencers',
                `<p>${checkUserInfluencer.email} declined the offer for ${checkUserClient.email}'s campaign</p><br/>
                <p><b>Details:</b></p>
                <p><b>Campaign Name:</b> ${findNewCampaign.campaignName}</p>
                <p><b>Client Name:</b> ${checkUserClient.firstName}</p>
                <p><b>Campaign Content:</b> ${
                    findNewCampaign.campaignContent
                        ? findNewCampaign.campaignContent
                            .map(
                                (campaignContentItem) => `
                  <div style="margin-bottom:10px;">
                    <a href="${campaignContentItem.videoLink}">
                      ${campaignContentItem.videoLink}
                    </a>
                    ${
                                    campaignContentItem.postDescriptions?.length
                                        ? `<ul>
                            ${campaignContentItem.postDescriptions
                                            .map((pd) => `<li><b>Description:</b> ${pd.description}</li>`)
                                            .join('')}
                          </ul>`
                                        : ''
                                }
                  </div>
                `,
                            )
                            .join('')
                        : (findNewCampaign as any).videos
                            .map((video) => `<a href="${video.videoLink}">${video.videoLink}</a>`)
                            .join(', ')
                }</p>`,
                'html',
            );

            return;
        }
    }

    // TODO: refactor - create 2 methods: for getting ongoing promos and for getting completed (use them in switch after)
    // Returns ongoing / completed influencer's promos
    async influencerGetOngoingOrPastPromos(influencerId: string, status: InfluencerPromoClosedStatusType = 'wait'): Promise<InfluencerPromo[]> {
        const checkInfluencer = await this.influencerModel.findOne({
            _id: influencerId,
        });

        if (!checkInfluencer) throw new NotFoundException('Influencer not found');

        let campaigns: any[];
        let allSocialAccounts: any[];

        switch (status) {
            // for ongoing promos
            case "wait":
                // Find campaigns with influencer in them
                campaigns = await this.campaignModel
                    .find({
                        selectInfluencers: {
                            $elemMatch: {
                                influencerId: influencerId,
                                confirmation: 'accept',
                                closePromo: 'wait',
                            },
                        },
                        $or: [{statusPromo: 'work'}, {statusCampaign: 'work'}],
                    })
                    .lean();

                // Getting all influencer's promos from each campaign
                allSocialAccounts = campaigns.flatMap((item: any) => {
                    return item.selectInfluencers.map((account: SelectInfluencers): InfluencerPromo & { clientId: string } | null => {
                        if (account.confirmation === 'accept' &&
                            account.closePromo === 'wait' &&
                            account.selectedContent) {

                            // Selected campaign content for this promo
                            const selectedCampaignContentItem: CampaignContentItem = item.campaignContent.find((i) => i._id.toString() === account.selectedContent.campaignContentItemId.toString());
                            if (!selectedCampaignContentItem) return null;

                            // Selected post description for this promo
                            const selectedPostDescription: string = selectedCampaignContentItem.postDescriptions.find((i) => i._id.toString() === account.selectedContent.postDescriptionId.toString())?.description;

                            return {
                                campaignId: item._id.toString(),
                                influencerId: account.influencerId.toString(),
                                selectInfluencersId: account._id.toString(),
                                campaignName: item.campaignName,
                                socialMediaUsername: account.socialMediaUsername,
                                statusCampaign: item.statusCampaign as CampaignStatusType,
                                socialMedia: account.socialMedia as SocialMediaType,
                                confirmation: account.confirmation as InfluencerConfirmationStatusType,
                                closedStatus: account.closePromo as InfluencerPromoClosedStatusType,
                                dateRequest: account.dateRequest,
                                createdAt: item.createdAt,
                                videoLink: selectedCampaignContentItem.videoLink,
                                postDescription: selectedPostDescription ?? "",
                                storyTag: selectedCampaignContentItem.storyTag ?? "",
                                storyLink: selectedCampaignContentItem.swipeUpLink ?? "",
                                additionalBrief: selectedCampaignContentItem.specialWishes ?? "",
                                clientId: item.clientId.toString(),
                            };
                        }

                        return null;
                    })
                }).filter(Boolean);
                break;
            // For closed promos
            case "closed":
                const [ongoingCampaigns, closedCampaigns] = await Promise.all([
                    this.campaignModel
                        .find({
                            selectInfluencers: {
                                $elemMatch: {
                                    influencerId,
                                    $or: [{closePromo: 'close'}, {screenshot: {$ne: ''}}],
                                },
                            },
                        })
                        .lean(),

                    this.completedCampaignModel
                        .find({
                            selectInfluencers: {
                                $elemMatch: {
                                    influencerId,
                                    $or: [{closePromo: 'close'}, {screenshot: {$ne: ''}}],
                                },
                            },
                        })
                        .lean(),
                ]);
                campaigns = [...ongoingCampaigns, ...closedCampaigns];

                allSocialAccounts = campaigns.flatMap((campaign: any) => {
                    return campaign.selectInfluencers.map((account: any): InfluencerPromo & { clientId: string } | null => {
                        if (account.closePromo === 'close' && account.screenshot === '') {

                            // Getting promo content for this social account
                            if (account.selectedContent?.campaignContentItemId || (account as any).selectedCampaignContentItem) {
                                const foundContent = campaign.campaignContent.find(
                                    (item) =>
                                        item._id.toString() === account.selectedContent?.campaignContentItemId?.toString() || item._id.toString() === (account as any).selectedCampaignContentItem,
                                );

                                if (foundContent) {
                                    const foundPostDescription =
                                        foundContent.postDescriptions?.find(
                                            (pd) => pd._id.toString() === account.selectedContent?.postDescriptionId.toString(),
                                        )?.description ?? (foundContent as any).postDescription ?? '';

                                    return {
                                        campaignId: campaign._id.toString(),
                                        influencerId: account.influencerId.toString(),
                                        selectInfluencersId: account._id.toString(),
                                        campaignName: campaign.campaignName,
                                        socialMediaUsername: account.socialMediaUsername,
                                        statusCampaign: campaign.statusCampaign as CampaignStatusType,
                                        socialMedia: account.socialMedia as SocialMediaType,
                                        confirmation: account.confirmation as InfluencerConfirmationStatusType,
                                        closedStatus: account.closePromo as InfluencerPromoClosedStatusType,
                                        dateRequest: account.dateRequest,
                                        createdAt: campaign.createdAt,
                                        videoLink: foundContent.videoLink,
                                        postDescription: foundPostDescription ?? "",
                                        storyTag: foundContent.storyTag ?? "",
                                        storyLink: foundContent.swipeUpLink ?? "",
                                        additionalBrief: foundContent.specialWishes ?? "",
                                        clientId: campaign.clientId.toString(),
                                    };
                                }
                            }
                        }

                        return null;
                    })
                }).filter(Boolean);
                break;
            default:
                throw new BadRequestException("Unsupported promo status");
        }

        if (!campaigns.length || !allSocialAccounts.length) {
            return [];
        }

        return await Promise.all(
            allSocialAccounts.map(async (item) => {
                const client = await this.clientModel.findById(item.clientId);
                const clientName = !client ? 'No Date' : client.company;

                return {
                    ...item,
                    client: clientName,
                    date: item.createdAt,
                };
            }),
        );
    }

    async influencerGetOngoingPromo(
        influencerId: string,
        campaignId: string,
        selectInfluencersId: string,
    ): Promise<InfluencerPromo> {

        if (!campaignId || !selectInfluencersId) {
            throw new BadRequestException('Not enough arguments');
        }

        const influencer = await this.influencerModel.findById(influencerId);
        if (!influencer) {
            throw new NotFoundException('Influencer not found');
        }

        const campaign = await this.campaignModel.findById(campaignId).lean();
        if (!campaign) {
            throw new NotFoundException('Campaign not found');
        }

        const client = await this.clientModel.findById(
            campaign.clientId || (campaign as any).userId,
        );
        if (!client) {
            throw new NotFoundException('Client not found');
        }

        const selectedInfluencer = campaign.selectInfluencers.find(
            (item) => item._id.toString() === selectInfluencersId,
        );

        if (!selectedInfluencer) {
            throw new NotFoundException('Social account not found');
        }

        if (!campaign.campaignContent || !selectedInfluencer.selectedContent) {
            throw new BadRequestException('Campaign content not found');
        }

        const selectedCampaignContentItem = campaign.campaignContent.find(
            (item) =>
                item._id.toString() ===
                selectedInfluencer.selectedContent.campaignContentItemId.toString(),
        );

        if (!selectedCampaignContentItem) {
            throw new NotFoundException('Campaign content item not found');
        }

        const postDescription =
            selectedCampaignContentItem.postDescriptions?.find(
                (pd) =>
                    pd._id.toString() ===
                    selectedInfluencer.selectedContent.postDescriptionId?.toString(),
            )?.description ?? '';

        return {
            campaignId: campaign._id.toString(),
            influencerId: selectedInfluencer.influencerId.toString(),
            selectInfluencersId: selectedInfluencer._id.toString(),
            campaignName: campaign.campaignName,
            socialMediaUsername: selectedInfluencer.socialMediaUsername,
            socialMedia: selectedInfluencer.socialMedia as SocialMediaType,
            dateRequest: selectedInfluencer.dateRequest,
            createdAt: campaign.createdAt,
            videoLink: selectedCampaignContentItem.videoLink,
            postDescription,
            storyTag: selectedCampaignContentItem.storyTag,
            storyLink: selectedCampaignContentItem.swipeUpLink,
            additionalBrief: selectedCampaignContentItem.specialWishes,
            client: client.company,
            statusCampaign: campaign.statusCampaign as CampaignStatusType,
            closedStatus: selectedInfluencer.closePromo as InfluencerPromoClosedStatusType,
            confirmation: selectedInfluencer.confirmation as InfluencerConfirmationStatusType,
        };
    }

    // TODO: finish
    async influencerUpdateOngoingCampaign(
        query: InfluencerUpdatePromoReqQueryDto,
        data: {
            screenshot?: string | null;
            rating?: number;
            postLink?: string;
            impressions?: number;
            like?: number;
        },
    ): Promise<void> {
        const { influencerId, campaignId, socialMediaUsername, selectInfluencersId } = query;

        if (!influencerId || !campaignId || !socialMediaUsername || !selectInfluencersId) {
            throw new BadRequestException('Not enough arguments');
        }

        const campaign = await this.campaignModel
            .findOne({
                _id: campaignId,
                selectInfluencers: {
                    $elemMatch: {
                        influencerId,
                        $or: [
                            { socialMediaUsername },
                            { instagramUsername: socialMediaUsername },
                        ],
                    },
                },
            })
            .lean();

        if (!campaign) {
            throw new NotFoundException('Campaign not found');
        }

        const socialAccount = campaign.selectInfluencers.find(
            (item) => item._id.toString() === selectInfluencersId,
        );

        if (!socialAccount) {
            throw new NotFoundException(
                `Social account not found in campaign ${campaign.campaignName}`,
            );
        }

        // ---------------- TRANSACTION ----------------

        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            /** ---------- VALIDATION BY SOCIAL MEDIA ---------- */

            if (
                socialAccount.socialMedia === 'spotify' ||
                socialAccount.socialMedia === 'soundcloud'
            ) {
                if (socialAccount.socialMedia === 'spotify' && !data.rating) {
                    throw new BadRequestException('Rating required');
                }

                if (!data.screenshot) {
                    throw new BadRequestException('Screenshot required');
                }
            }

            if (socialAccount.socialMedia === 'press') {
                if (!data.postLink) {
                    throw new BadRequestException('Post link required');
                }
            }

            if (
                !['spotify', 'soundcloud', 'press'].includes(socialAccount.socialMedia)
            ) {
                if (!data.postLink || !data.impressions || !data.like || !data.screenshot) {
                    throw new BadRequestException('Invalid promo data');
                }
            }

            /** ---------- CLOSE PROMO (RACE SAFE) ---------- */

            const updatePayload = Object.fromEntries(
                Object.entries({
                    ...data,
                    closePromo: 'close',
                }).map(([key, value]) => [`selectInfluencers.$.${key}`, value]),
            );

            const updateResult = await this.campaignModel.updateOne(
                {
                    _id: campaignId,
                    'selectInfluencers._id': new mongoose.Types.ObjectId(selectInfluencersId),
                    'selectInfluencers.closePromo': { $ne: 'close' },
                },
                {
                    $set: updatePayload,
                },
                { session },
            );

            // promo already closed by another request
            if (updateResult.modifiedCount === 0) {
                await session.abortTransaction();
                return;
            }

            /** ---------- PAY INFLUENCER (ATOMIC) ---------- */

            const reward = Number(
                socialAccount.price?.replace(/\D/g, ''),
            );

            if (!reward || Number.isNaN(reward)) {
                throw new BadRequestException('Invalid influencer reward');
            }

            await this.influencerModel.updateOne(
                { _id: influencerId },
                { $inc: { balance: reward } },
                { session },
            );

            /** ---------- COMMIT ---------- */

            await session.commitTransaction();
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            session.endSession();
        }

        // ---------------- AFTER COMMIT ----------------
        // history is NOT transactional, so only after commit

        const historyResponse = await axios.post(
            `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
            {
                influencerId,
                campaignId: new mongoose.Types.ObjectId(campaign._id),
                campaignName: campaign.campaignName,
                updatedCampaignAction: {
                    actionNumber: 3,
                    networkUsername: socialMediaUsername,
                    socialMedia: socialAccount.socialMedia,
                    rewardForInfluencer: Number(
                        socialAccount.price.replace(/\D/g, ''),
                    ),
                },
            },
        );

        if (historyResponse.data?.code !== 200) {
            this.logger.error(
                `History save failed for campaign ${campaignId}, influencer ${influencerId}`,
            );
        }
    }

    async uploadDropBox(file: any) {
        const dropboxService = new DropboxService();
        const screenshotUrl = await dropboxService.uploadFile(file.buffer, file.originalname);
        return {
            statusCode: 200,
            data: screenshotUrl,
        };
    }
}
