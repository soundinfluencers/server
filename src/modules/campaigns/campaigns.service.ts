import {
    BadRequestException, ForbiddenException,
    Injectable, InternalServerErrorException, Logger,
    NotFoundException,
} from '@nestjs/common';
import {InjectModel} from "@nestjs/mongoose";
import {Client} from "../../database/schemas/users/client.schema";
import mongoose, {Model, Types} from "mongoose";
import {Influencer} from "../../database/schemas/users/influencer.schema";
import {
    CampaignStatusType,
    CampaignStatusTypeForDevelopment,
    ClientCampaignForTable,
    ClientGetCampaignForList, PublicCampaignForTable
} from "../../common/types/client/campaign.types";
import {SocialMediaType} from "../../common/types/social-media.types";
import {formatClientCampaignStatus, formatDate} from "../../common/utils/formatters";
import {Campaign} from "../../database/schemas/campaign/campaign.schema";
import {CompletedCampaign} from "../../database/schemas/campaign/completed-campaign.schema";
import {CreateCampaignDto} from "./dto/create-campaign.dto";
import {SaveXlsxCampaignDto} from "./dto/save-xlsx-campaign.dto";
import {SendNewFullServicedCampaignRequest} from "./dto/send-new-full-serviced-campaign-request";
import sendMail from "../../integrations/nodemailer/nodemailer";
import axios from "axios";
import {
    AccountObjectForCreateNewPromoRequestMessage,
    createNewPromoRequestHTMLMessage
} from "../../common/utils/new-promo-message";
import {ProposalCampaign} from "../proposal-system/schemas/proposal-campaign.schema";
import {getSocialMediaGroup} from "../../common/utils/socialMedia";
import {returnMusicStyles} from "../../common/utils/genres";
import {ClientGetDashboardCampaignsQueryDto} from "./dto/get-campaigns.dto";
import {CampaignRepository} from "../../database/repositories/campaigns/campaign.repository";
import {CompletedCampaignRepository} from "../../database/repositories/campaigns/completed-campaign.repository";
import {ClientRepository} from "../../database/repositories/users/client.repository";

@Injectable()
export class CampaignsService {
    private readonly logger = new Logger();

    // TODO: use repo instead models
    constructor(
        @InjectModel(Campaign.name)
        private readonly campaignModel: Model<Campaign>,
        @InjectModel(Client.name)
        private clientModel: mongoose.Model<Client>,
        @InjectModel(Influencer.name)
        private influencerModel: mongoose.Model<Influencer>,
        @InjectModel(CompletedCampaign.name)
        private completedCampaignModel: mongoose.Model<CompletedCampaign>,
        @InjectModel(ProposalCampaign.name)
        private proposalCampaignModel: mongoose.Model<ProposalCampaign>,
        private clientRepo: ClientRepository,
        private campaignRepo: CampaignRepository,
        private completedCampaignRepo: CompletedCampaignRepository,
    ) {
    }

    async getClientCampaignsList(data: ClientGetDashboardCampaignsQueryDto): Promise<ClientGetCampaignForList[]> {
        const limit = Number(data.limit ?? 12);
        const page = Number(data.page ?? 1);

        if (!Number.isInteger(limit) || limit <= 0) {
            throw new BadRequestException('Invalid limit');
        }

        if (!Number.isInteger(page) || page <= 0) {
            throw new BadRequestException('Invalid page');
        }

        const skip = (data.page - 1) * limit;

        const checkClient = await this.clientRepo.findOne({_id: new Types.ObjectId(data.clientId)});

        if (!checkClient) {
            throw new NotFoundException('User not found');
        }

        let campaigns: any[];

        switch (data.status) {
            case "ongoing":
                campaigns = await this.campaignRepo
                    .findMany({
                        clientId: new Types.ObjectId(data.clientId),
                        statusCampaign: {$in: ['work', 'wait', 'estimate', 'po waiting']},
                    }, { lean: true, limit: limit, skip: skip })
                break;
            case "closed":
                campaigns = await this.completedCampaignRepo
                    .findMany({
                        $or: [
                            {clientId: new Types.ObjectId(data.clientId)},
                            {userId: new Types.ObjectId(data.clientId)},
                        ],
                    }, { lean: true, limit: limit, skip: skip })
                break;
            case "proposal":
                throw new BadRequestException("Unsupported campaign type")
            default:
                throw new BadRequestException("Unsupported campaign type");
        }


        return await Promise.all(
            campaigns.map(async (item): Promise<ClientGetCampaignForList> => {
                return {
                    _id: item._id.toString(),
                    campaignName: item.campaignName,
                    socialMedia: item.socialMedia as SocialMediaType,
                    creationDate: formatDate(item.createdAt),
                    price: item.campaignPrice,
                    status: formatClientCampaignStatus(item.statusCampaign) as CampaignStatusType,
                };
            }),
        );
    }

    async createCampaign(data: CreateCampaignDto) {
        if (!data) throw new BadRequestException('Not enough arguments')

        const createdAt = new Date();

        const processedInfluencers = await Promise.all(
            data.selectInfluencers.map(async (influencer) => {
                const dateRequest = influencer.dateRequest;

                const influencerData = await this.influencerModel
                    .findOne({
                        $or: [
                            {
                                [`${influencer.socialMedia}._id`]: new mongoose.Types.ObjectId(
                                    influencer.socialMediaAccountId,
                                )
                            },
                            {
                                _id: new Types.ObjectId(influencer.influencerId)
                            },
                            {
                                [`${influencer.socialMedia}.instagramUsername`]: influencer.socialMediaUsername
                            }
                        ]
                    })
                    .lean()
                    .exec();

                if (!influencerData) {
                    this.logger.log(
                        `Did not find any influencer with influencerId: ${influencer.influencerId} or social accountId: ${influencer.socialMediaAccountId} while creating campaign ${data.campaignName}`,
                    )
                    return null;
                }

                const influencerId = influencerData._id.toString();

                const socialMediaAccount = influencerData[influencer.socialMedia].find(
                    (account) =>
                        account.instagramUsername === influencer.socialMediaUsername
                );

                if (socialMediaAccount) {
                    return {
                        ...influencer,
                        _id: new mongoose.Types.ObjectId(),
                        selectedContent: {
                            campaignContentItemId: new Types.ObjectId(
                                influencer.selectedCampaignContentItem.campaignContentItemId,
                            ),
                            postDescriptionId: new Types.ObjectId(
                                influencer.selectedCampaignContentItem.postDescriptionId,
                            ),
                        },
                        influencerId: influencerId,
                        accountId: new Types.ObjectId(influencer.socialMediaAccountId),
                        price: socialMediaAccount.price,
                        publicPrice: socialMediaAccount.publicPrice,
                        followersNumber: parseInt(socialMediaAccount.followersNumber.replace(/[.,]/g, '')),
                        createdAt,
                        dateRequest,
                    };
                }
            }),
        );

        const processedCampaignContent = await Promise.all(
            data.campaignContent.map(async (campaignContentItem) => ({
                videoLink: campaignContentItem.videoLink.trim(),
                postDescriptions: campaignContentItem.postDescriptions.map((pd) => ({
                    _id: new mongoose.Types.ObjectId(pd._id),
                    description: pd.description.trim(),
                })),
                storyTag: campaignContentItem.storyTag?.trim(),
                swipeUpLink: campaignContentItem.swipeUpLink?.trim(),
                specialWishes: campaignContentItem.specialWishes?.trim(),
                socialMedia: campaignContentItem.socialMedia,
                socialMediaGroup: campaignContentItem.socialMediaGroup,
                _id: new mongoose.Types.ObjectId(campaignContentItem._id),
            })),
        );


        const campaignId = new mongoose.Types.ObjectId();
        const result = await this.campaignModel.create({
            ...data,
            _id: campaignId,
            clientId: new Types.ObjectId(data.clientId),
            campaignName: data.campaignName.trim(),
            selectInfluencers: processedInfluencers,
            paymentType: !data.paymentType ? 'payment' : data.paymentType,
            paymentStatus: 'wait',
            statusCampaign: 'wait',
            verifyCampaign: 'wait',
            shareLink: `${process.env.SERVER_CLIENT}/promo-share/${campaignId}/${data.socialMedia}`,
            campaignContent: processedCampaignContent,
            createdAt,
        });

        let dataClient = await this.clientModel.findOne({_id: data.clientId});

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
<p><strong>Campaign Name: ${data.campaignName}</strong></p>`;
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
                return processedCampaignContent
                    .map(
                        (campaignContentItem, index) => `
          <p><strong>Song/Playlist ${index + 1}:</strong></p>
          <ul>
              <li><strong>Track/Playlist Link:</strong> ${campaignContentItem.videoLink}</li>
              <li><strong>Track/Playlist Titles:</strong>
                <ul>
                  ${campaignContentItem.postDescriptions
                            .map((pd, i) => `<li>${i + 1}. ${pd.description}</li>`)
                            .join('')}
                </ul>
              </li>
              <li><strong>Special Wishes:</strong> ${campaignContentItem.specialWishes}</li>
          </ul>
          <p><strong>Selected Influencers:</strong></p>
          <ul>
              ${processedInfluencers
                            .filter(
                                (influencer) =>
                                    influencer.selectedContent?.campaignContentItemId.toString() ===
                                    campaignContentItem._id.toString(),
                            )
                            .map(
                                (influencer) =>
                                    `<li>${influencer.socialMedia} username: ${influencer.socialMediaUsername}</li>`,
                            )
                            .join('')}
          </ul>
        `,
                    )
                    .join('');
            } else if (data.socialMedia === 'press') {
                return processedCampaignContent
                    .map(
                        (campaignContentItem, index) => `
          <p><strong>Article ${index + 1}:</strong></p>
          <ul>
              <li><strong>Link to Music/Events/News:</strong> ${campaignContentItem.videoLink}</li>
              <li><strong>Descriptions:</strong>
                <ul>
                  ${campaignContentItem.postDescriptions
                            .map((pd, i) => `<li>${i + 1}. ${pd.description}</li>`)
                            .join('')}
                </ul>
              </li>
              <li><strong>Link To Press Release:</strong> ${campaignContentItem.storyTag}</li>
              <li><strong>Special Wishes:</strong> ${campaignContentItem.specialWishes}</li>
          </ul>
          <p><strong>Selected Influencers:</strong></p>
          <ul>
              ${processedInfluencers
                            .filter(
                                (influencer) =>
                                    influencer.selectedContent?.campaignContentItemId.toString() ===
                                    campaignContentItem._id.toString(),
                            )
                            .map(
                                (influencer) =>
                                    `<li>${influencer.socialMedia} username: ${influencer.socialMediaUsername}</li>`,
                            )
                            .join('')}
          </ul>
        `,
                    )
                    .join('');
            } else {
                return processedCampaignContent
                    .map(
                        (campaignContentItem, index) => `
          <p><strong>Post Content ${index + 1}:</strong></p>
          <ul>
              <li><strong>Link:</strong> ${campaignContentItem.videoLink}</li>
              <li><strong>Post Descriptions:</strong>
                <ul>
                  ${campaignContentItem.postDescriptions
                            .map((pd, i) => `<li>${i + 1}. ${pd.description}</li>`)
                            .join('')}
                </ul>
              </li>
              <li><strong>Story Tag:</strong> ${campaignContentItem.storyTag}</li>
              <li><strong>Swipe Up Link:</strong> ${campaignContentItem.swipeUpLink}</li>
              <li><strong>Special Wishes:</strong> ${campaignContentItem.specialWishes}</li>
          </ul>
          <p><strong>Selected Influencers:</strong></p>
          <ul>
              ${processedInfluencers
                            .filter(
                                (influencer) =>
                                    influencer.selectedContent?.campaignContentItemId.toString() ===
                                    campaignContentItem._id.toString(),
                            )
                            .map(
                                (influencer) =>
                                    `<li>${influencer.socialMedia} username: ${influencer.socialMediaUsername}</li>`,
                            )
                            .join('')}
          </ul>
        `,
                    )
                    .join('');
            }
        };

        const emailContent = `
${emailStartContent()}
${emailVideoContent()}
<p>Payment Method Used: ${result.paymentType}</p>
<p>
    <a style="font-weight: 600" href="${process.env.SERVER}/campaigns/verify?promoId=${result._id}&status=accept">
        Approve
    </a> 
    <a style="font-weight: 600" href="${process.env.SERVER}/campaigns/verify?promoId=${result._id}&status=cancel">
        Decline
    </a>
</p>`;

        await sendMail(
            process.env.EMAIL_USER,
            'SoundInfluencers',
            emailContent,
            'html',
        );
    }

    async verifyCampaign(campaignId: string, status: string) {
        if (!campaignId || !status) throw new BadRequestException('Not enough arguments')

        const checkCampaign = await this.campaignModel.findOne({_id: campaignId}).lean();

        if (!checkCampaign) throw new NotFoundException('Campaign not found')

        if (status === 'accept' && checkCampaign.statusCampaign === 'wait') {
            const influencersIds = checkCampaign.selectInfluencers.map((item) => item.influencerId);

            const influencers = await this.influencerModel.find({_id: {$in: influencersIds}});

            if (!influencers) throw new NotFoundException('Influencers not found')

            const socialMedias = [
                'instagram',
                'tiktok',
                'spotify',
                'soundcloud',
                'facebook',
                'youtube',
                'press',
            ];

            for (let influencer of influencers) {
                const influencerSocialMediaAccountsNested = await Promise.all(
                    socialMedias.map(async (socialMedia) => {
                        const accounts = influencer[socialMedia];

                        const usernames = await Promise.all(
                            accounts.map(async (account) => {
                                if (
                                    checkCampaign.selectInfluencers.some(
                                        (influencerData) =>
                                            (influencerData.socialMediaUsername === account.instagramUsername ||
                                                (influencerData as any).instagramUsername ===
                                                account.instagramUsername) &&
                                            influencerData.socialMedia === socialMedia,
                                    )
                                ) {
                                    const res = await axios.post(
                                        `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
                                        {
                                            influencerId: influencer._id,
                                            campaignId: new mongoose.Types.ObjectId(checkCampaign._id),
                                            campaignName: checkCampaign.campaignName,
                                            updatedCampaignAction: {
                                                actionNumber: 0,
                                                networkUsername: account.instagramUsername,
                                                socialMedia: socialMedia,
                                                rewardForInfluencer: parseInt(account.price),
                                            },
                                        },
                                    );

                                    throw new InternalServerErrorException(`Influencer's history (${account.instagramUsername}) didn't update`)
                                }

                                return account.instagramUsername;
                            }),
                        );

                        return usernames.filter(Boolean);
                    }),
                );

                const influencerAccounts = checkCampaign.selectInfluencers.filter(
                    (acc) => acc.influencerId.toString() === influencer._id.toString()
                );

                const accountDetails: AccountObjectForCreateNewPromoRequestMessage[] =
                    influencerAccounts.map((acc) => {
                        const content = checkCampaign.campaignContent.find(
                            (c) => c._id.toString() === acc.selectedContent?.campaignContentItemId.toString(),
                        );

                        return {
                            pageName: acc.socialMediaUsername,
                            reward: acc.price,
                            socialMedia: acc.socialMedia,
                            contentLink: content?.videoLink || '',
                            description:
                                content?.postDescriptions.find(
                                    (pd) => pd._id.toString() === acc.selectedContent?.postDescriptionId.toString(),
                                )?.description || '',
                            storyTag: content?.storyTag,
                            storyLink: content?.swipeUpLink,
                            specialRequests: content?.specialWishes,
                        };
                    });

                if (accountDetails.length === 0) continue;

                const emailBody = createNewPromoRequestHTMLMessage({
                    firstName: influencer.firstName,
                    accountsAndDetails: accountDetails,
                });

                await sendMail(
                    influencer.email,
                    // 'nazarkozynets030606@zohomail.eu',
                    'New Promo Request',
                    emailBody,
                    'html'
                );
            }

            const updateFields = {verifyCampaign: (checkCampaign as any)?.verifyCampaign};

            if (checkCampaign.verifyCampaign !== undefined) {
                updateFields.verifyCampaign = status;
            }

            await this.campaignModel.updateOne({_id: campaignId}, {$set: updateFields});

            return {
                code: 200,
                message: 'Campaign verified',
            };
        } else {
            return {
                code: 200,
                message: 'Campaign declined',
            };
        }
    }

    // Returns one detailed campaign obj - used by campaign report page
    async getClientOngoingOrPastCampaign(campaignId: string, clientId: string): Promise<ClientCampaignForTable> {
        const client = await this.clientModel.findById(clientId);
        if (!client) throw new NotFoundException('User not found');

        let campaign: any = await this.campaignModel.findById(campaignId).lean();
        if (!campaign) campaign = await this.completedCampaignModel.findById(campaignId).lean();
        if (!campaign) throw new NotFoundException('Campaign not found');

        const campaignToReturn: ClientCampaignForTable = {
            campaignId: campaignId,
            // clientId: campaign.clientId,
            campaignName: campaign.campaignName ?? 'OLD CAMPAIGN',
            socialMedia: campaign.socialMedia ?? 'instagram',
            creationDate: campaign.createdAt ?? 0,
            price: campaign.campaignPrice ?? campaign.price ?? campaign.amount ?? 0,
            status: campaign.statusCampaign,
            addedAccounts: [],
            campaignContent: campaign.campaignContent ?? campaign.videos ?? [],
            shareLink: campaign.shareLink ?? null,
            totalFollowers: 0,
            totalLikes: 0,
            totalImpressions: 0,
            isClosed: campaign.isCopy ?? false,
            isCpmAndResultHidden: campaign.isCpmAndResultHidden ?? false,
            isPriceHidden: campaign.isPriceHidden ?? false,
            hiddenColumns: campaign.hiddenColumns ?? [],
        };

        for (const addedAccount of campaign.selectInfluencers) {
            const normalizedUsername =
                addedAccount?.socialMediaUsername?.trim() ||
                addedAccount?.instagramUsername?.trim() ||
                '';

            const socialMedia =
                addedAccount?.socialMedia ||
                (campaign.socialMedia !== 'multipromo' && campaign.socialMedia);

            const selectedCampaignContentItemId =
                addedAccount?.selectedContent?.campaignContentItemId?.toString() ??
                addedAccount?.selectedCampaignContentItem?.toString() ??
                (Array.isArray(campaign?.videos)
                    ? campaign.videos.find((v) => v.videoLink === addedAccount?.selectedVideo)?._id?.toString()
                    : null) ??
                null;

            let selectedCampaignContentItem = null;
            if (selectedCampaignContentItemId) {
                selectedCampaignContentItem =
                    (Array.isArray(campaign.campaignContent)
                        ? (() => {
                            const contentItem = campaign.campaignContent.find(
                                (item) => item?._id.toString() === selectedCampaignContentItemId,
                            );
                            if (!contentItem) return null;

                            const postDescription =
                                contentItem.postDescriptions?.find(
                                    (pd) => pd._id.toString() === addedAccount.selectedContent?.postDescriptionId.toString(),
                                )?.description ?? (contentItem as any)?.postDescription ?? '';

                            return {
                                _id: contentItem._id,
                                videoLink: contentItem.videoLink,
                                postDescription: postDescription || null,
                                storyTag: contentItem.storyTag || null,
                                storyLink: contentItem.swipeUpLink || null,
                                specialWishes: contentItem.specialWishes,
                            };
                        })()
                        : null) ??
                    (Array.isArray(campaign.videos)
                        ? campaign.videos.find(
                            (item) => item?._id?.toString() === selectedCampaignContentItemId?.toString(),
                        )
                        : null) ??
                    null;
            }

            addedAccount.selectedCampaignContentItemId = selectedCampaignContentItemId;
            addedAccount.selectedCampaignContentItem = selectedCampaignContentItem;
            addedAccount.socialMedia = socialMedia;
            addedAccount.socialMediaUsername = normalizedUsername;

            campaignToReturn.totalFollowers += addedAccount?.followersNumber ?? 0;
            campaignToReturn.totalLikes += parseInt(addedAccount.like?.replace(/[\s,]/g, '') || '0');
            campaignToReturn.totalImpressions += parseInt(
                addedAccount.impressions?.replace(/[\s,]/g, '') || '0',
            );

            campaignToReturn.addedAccounts.push(addedAccount);
        }

        campaignToReturn.addedAccounts.sort((a, b) => {
            const aIndex = Array.isArray(campaign.campaignContent)
                ? campaign.campaignContent.findIndex(
                    (c) => c?._id?.toString() === a.selectedCampaignContentItemId?.toString(),
                )
                : Array.isArray(campaign.videos)
                    ? campaign.videos.findIndex(
                        (v) => v?._id?.toString() === a.selectedCampaignContentItemId?.toString(),
                    )
                    : -1;

            const bIndex = Array.isArray(campaign.campaignContent)
                ? campaign.campaignContent.findIndex(
                    (c) => c?._id?.toString() === b.selectedCampaignContentItemId?.toString(),
                )
                : Array.isArray(campaign.videos)
                    ? campaign.videos.findIndex(
                        (v) => v?._id?.toString() === b.selectedCampaignContentItemId?.toString(),
                    )
                    : -1;

            return aIndex - bIndex;
        });

        return campaignToReturn;
    }

    // Returns client's proposal campaigns
    async getClientProposalCampaigns(clientId: string): Promise<ClientGetCampaignForList[]> {
        const client = await this.clientModel.findById(clientId);
        if (!client) throw new NotFoundException('Client not found');

        if (!client.isProposalClient) throw new ForbiddenException('Client need to be proposal client')

        const proposalPromos = await this.proposalCampaignModel.find({clientId});

        if (proposalPromos.length === 0) {
            return [];
        }

        return proposalPromos.map((p) => ({
            _id: p._id.toString(),
            campaignName: p.campaignName,
            socialMedia: p.socialMedia as SocialMediaType,
            creationDate: formatDate(p.createdAt),
            price: p.price,
            status: "Pending" as CampaignStatusType,
        }))
    }

    async saveXLSXCampaign(data: SaveXlsxCampaignDto) {
        if (!data) throw new BadRequestException('Invalid data')

        const isMultiPromo = !data.socialMedia || data.socialMedia === 'multipromo';

        const campaign = {
            campaignId: new Types.ObjectId().toHexString(),
            campaignName: data.campaignName,
            price: data.price || 0,
            publicPrice: data.price || 0,
            socialMedia: data.socialMedia || 'multipromo',
            selectInfluencers: [],
            campaignContent: [],
            totalFollowers: 0,
            clientId: '66f540faaf4e960d2f9bebfc',
        };

        await Promise.all(
            data.pages.map(async (page) => {
                let influencerId: Types.ObjectId | null = null;

                if (isMultiPromo) {
                    const normalizedUsername = page.socialMediaUsername.trim();
                    const socialMediaPlatforms = [
                        'instagram',
                        'facebook',
                        'tiktok',
                        'youtube',
                        'spotify',
                        'soundcloud',
                        'press',
                    ];

                    const aggregationPipeline = [
                        {
                            $facet: socialMediaPlatforms.reduce((acc, platform) => {
                                acc[platform] = [
                                    {$unwind: {path: `$${platform}`, preserveNullAndEmptyArrays: true}},
                                    {
                                        $match: {
                                            $expr: {
                                                $let: {
                                                    vars: {
                                                        cleanFollowers: {
                                                            $replaceAll: {
                                                                input: {
                                                                    $replaceAll: {
                                                                        input: `$${platform}.followersNumber`,
                                                                        find: '.',
                                                                        replacement: '',
                                                                    },
                                                                },
                                                                find: ',',
                                                                replacement: '',
                                                            },
                                                        },
                                                    },
                                                    in: {
                                                        $and: [
                                                            {
                                                                $eq: [
                                                                    {$trim: {input: `$${platform}.instagramUsername`}},
                                                                    normalizedUsername,
                                                                ],
                                                            },
                                                            {
                                                                $eq: [{$toInt: '$$cleanFollowers'}, page.followersNumber],
                                                            },
                                                        ],
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    {
                                        $project: {
                                            influencerId: `$${platform}._id`,
                                            socialMedia: platform,
                                            price: `$${platform}.price`,
                                            publicPrice: `$${platform}.publicPrice`,
                                            dateRequest: data.timeline,
                                            followersNumber: `$${platform}.followersNumber`,
                                            countries: `$${platform}.countries`,
                                            musicStyle: `$${platform}.musicStyle`,
                                            musicSubStyles: `$${platform}.musicSubStyles`,
                                            musicStyleOther: `$${platform}.musicStyleOther`,
                                        },
                                    },
                                ];
                                return acc;
                            }, {}),
                        },
                        {
                            $project: {
                                combined: {
                                    $concatArrays: socialMediaPlatforms.map((platform) => `$${platform}`),
                                },
                            },
                        },
                        {$unwind: '$combined'},
                        {
                            $project: {
                                influencerId: '$combined.influencerId',
                                socialMedia: '$combined.socialMedia',
                                price: '$combined.price',
                                publicPrice: '$combined.publicPrice',
                                dateRequest: '$combined.dateRequest',
                                followersNumber: '$combined.followersNumber',
                                countries: '$combined.countries',
                                musicStyle: '$combined.musicStyle',
                                musicSubStyles: '$combined.musicSubStyles',
                                musicStyleOther: '$combined.musicStyleOther',
                            },
                        },
                    ];

                    const result = await this.influencerModel.aggregate(aggregationPipeline).exec();

                    if (result.length > 0) {
                        influencerId = result[0].influencerId
                            ? new Types.ObjectId(result[0].influencerId)
                            : null;
                        let selectedCampaignContentItem: {
                            campaignContentItemId: string,
                            postDescriptionId: string
                        } | null = null;

                        const existingContentIndex: number = campaign.campaignContent.findIndex(
                            (item) =>
                                item.videoLink === page.videoLink &&
                                getSocialMediaGroup(item.socialMedia) === getSocialMediaGroup(result[0].socialMedia),
                        );

                        if (page.videoLink && existingContentIndex === -1) {
                            const campaignContentItemId = new Types.ObjectId().toHexString();
                            const postDescriptionId = new Types.ObjectId().toHexString();

                            selectedCampaignContentItem = {
                                campaignContentItemId,
                                postDescriptionId
                            };

                            campaign.campaignContent.push({
                                _id: campaignContentItemId,
                                videoLink: page.videoLink,
                                postDescriptions: [{
                                    _id: postDescriptionId,
                                    description: page.postDescription || '',
                                }],
                                storyTag: page.storyTag || '',
                                swipeUpLink: page.storyLink || '',
                                specialWishes: page.specialWishes || '',
                                socialMedia: result[0].socialMedia,
                                socialMediaGroup: getSocialMediaGroup(result[0].socialMedia)
                            });
                        } else if (existingContentIndex !== -1) {
                            const existingDescriptionIndex: number = campaign.campaignContent[existingContentIndex].postDescriptions.findIndex(
                                pd => pd.description === page.postDescription,
                            )

                            if (existingDescriptionIndex === -1) {
                                const postDescriptionId = new Types.ObjectId().toHexString();

                                selectedCampaignContentItem = {
                                    campaignContentItemId: campaign.campaignContent[existingContentIndex]._id,
                                    postDescriptionId: postDescriptionId
                                };

                                campaign.campaignContent[existingContentIndex].postDescriptions.push({
                                    _id: postDescriptionId,
                                    description: page.postDescription || '',
                                })
                            } else {
                                selectedCampaignContentItem = {
                                    campaignContentItemId: campaign.campaignContent[existingContentIndex]._id,
                                    postDescriptionId: campaign.campaignContent[existingContentIndex].postDescriptions[existingDescriptionIndex]._id
                                }
                            }
                        }

                        const formattedGenres = returnMusicStyles(
                            result[0].musicStyle,
                            result[0].musicStyleOther,
                            result[0].musicSubStyles,
                        );

                        campaign.selectInfluencers.push({
                            ...result[0],
                            _id: new Types.ObjectId().toHexString(),
                            socialMediaUsername: page.socialMediaUsername.trim(),
                            selectedContent: selectedCampaignContentItem,
                            genres: formattedGenres,
                            followersNumber: parseInt(result[0].followersNumber.replace(/[.,]/g, '')),
                        });

                        campaign.totalFollowers += parseInt(
                            result[0].followersNumber.replace(/[.,]/g, ''),
                        );
                    }
                } else {
                    const platform = data.socialMedia;
                    const normalizedUsername = page.socialMediaUsername.trim();
                    const aggregationPipeline = [
                        {$unwind: `$${platform}`},
                        {
                            $match: {
                                $expr: {
                                    $eq: [
                                        {$trim: {input: `$${platform}.instagramUsername`}},
                                        normalizedUsername,
                                    ],
                                },
                            },
                        },
                        {
                            $project: {
                                influencerId: `$${platform}._id`,
                                socialMedia: platform,
                                price: `$${platform}.price`,
                                publicPrice: `$${platform}.publicPrice`,
                                dateRequest: data.timeline,
                                followersNumber: `$${platform}.followersNumber`,
                                countries: `$${platform}.countries`,
                                musicStyle: `$${platform}.musicStyle`,
                                musicSubStyles: `$${platform}.musicSubStyles`,
                                musicStyleOther: `$${platform}.musicStyleOther`,
                            },
                        },
                    ];

                    const result = await this.influencerModel.aggregate(aggregationPipeline).exec();

                    if (result.length > 0) {
                        influencerId = result[0].influencerId
                            ? new Types.ObjectId(result[0].influencerId)
                            : null;
                        let selectedCampaignContentItem: {
                            campaignContentItemId: string,
                            postDescriptionId: string,
                        } | null = null;

                        const existingContentIndex: number = campaign.campaignContent.findIndex(
                            (item) =>
                                item.videoLink === page.videoLink &&
                                getSocialMediaGroup(item.socialMedia) === getSocialMediaGroup(result[0].socialMedia),
                        );

                        if (page.videoLink && existingContentIndex === -1) {
                            const campaignContentItemId = new Types.ObjectId().toHexString();
                            const postDescriptionId = new Types.ObjectId().toHexString();

                            selectedCampaignContentItem = {
                                campaignContentItemId,
                                postDescriptionId
                            };

                            campaign.campaignContent.push({
                                _id: campaignContentItemId,
                                videoLink: page.videoLink,
                                postDescriptions: [{
                                    _id: postDescriptionId,
                                    description: page.postDescription || '',
                                }],
                                storyTag: page.storyTag || '',
                                swipeUpLink: page.storyLink || '',
                                specialWishes: page.specialWishes || '',
                                socialMedia: result[0].socialMedia,
                                socialMediaGroup: getSocialMediaGroup(result[0].socialMedia)
                            });
                        } else if (existingContentIndex !== -1) {
                            const existingDescriptionIndex: number = campaign.campaignContent[existingContentIndex].postDescriptions.findIndex(
                                pd => pd.description === page.postDescription,
                            )

                            if (existingDescriptionIndex === -1) {
                                const postDescriptionId = new Types.ObjectId().toHexString();

                                selectedCampaignContentItem = {
                                    campaignContentItemId: campaign.campaignContent[existingContentIndex]._id,
                                    postDescriptionId: postDescriptionId
                                };

                                campaign.campaignContent[existingContentIndex].postDescriptions.push({
                                    _id: postDescriptionId,
                                    description: page.postDescription || '',
                                })
                            } else {
                                selectedCampaignContentItem = {
                                    campaignContentItemId: campaign.campaignContent[existingContentIndex]._id,
                                    postDescriptionId: campaign.campaignContent[existingContentIndex].postDescriptions[existingDescriptionIndex]._id
                                }
                            }
                        }

                        const formattedGenres = returnMusicStyles(
                            result[0].musicStyle,
                            result[0].musicStyleOther,
                            result[0].musicSubStyles,
                        );

                        campaign.selectInfluencers.push({
                            ...result[0],
                            _id: new Types.ObjectId().toHexString(),
                            socialMediaUsername: page.socialMediaUsername.trim(),
                            selectedContent: selectedCampaignContentItem,
                            genres: formattedGenres,
                            followersNumber: parseInt(result[0].followersNumber.replace(/[.,]/g, '')),
                        });

                        campaign.totalFollowers += parseInt(
                            result[0].followersNumber.replace(/[.,]/g, ''),
                        );
                    }
                }

                if (!influencerId) {
                    console.warn(
                        `(SAVING XLSX CAMPAIGN) No social media account found for username: ${page.socialMediaUsername} with ${page.followersNumber} followers`,
                    );
                }
            }),
        );

        campaign.campaignName =
            campaign.campaignName ||
            `F: ${Math.ceil(campaign.totalFollowers)} D: ${new Date().toISOString().split('T')[0]}`;

        await axios.put(`${process.env.SERVER}/proposal-system/save-proposal-campaign`, campaign);
    }

    async sendNewFullServicedCampaignRequest(data: SendNewFullServicedCampaignRequest) {
        const {clientId, campaignGoal, videos, music, budget, additional = ''} = data;

        const clientObj = await this.clientModel.findById(clientId);

        if (!clientObj) throw new NotFoundException('Client not found');

        const emailText = `
    <p>${clientObj.firstName} (${clientObj.email}) requested the full serviced campaign.</p>
    <p>Details:</p><br/>
    <p><strong>Campaign Goal:</strong> ${campaignGoal}</p>
    <p><strong>Videos:</strong> ${videos}</p>
    <p><strong>Music:</strong> ${music}</p>
    <p><strong>Budget:</strong> ${budget}</p>
    ${additional ? `<p><strong>Additional:</strong> ${additional}</p>` : ''}
`;

        await sendMail(process.env.EMAIL_USER, 'SoundInfluencers', emailText, 'html');
    }

    // Returns detailed campaign (trying to get by sharelink, so not all info visible)
    async getCampaignByPublicShareLink(campaignId: string): Promise<PublicCampaignForTable> {
        if (!campaignId) throw new BadRequestException('Not enough arguments')

        if (!mongoose.Types.ObjectId.isValid(campaignId)) throw new BadRequestException('Invalid campaignId format')

        let campaign: any = await this.campaignModel.findById(campaignId).lean();
        if (!campaign) campaign = await this.completedCampaignModel.findById(campaignId).lean();
        if (!campaign) throw new NotFoundException('Campaign not found')

        const campaignToReturn: PublicCampaignForTable = {
            campaignId: campaign._id,
            clientId: campaign.clientId,
            campaignName: campaign.campaignName ?? 'OLD CAMPAIGN',
            price: campaign.campaignPrice ?? campaign.publicPrice ?? campaign.amount ?? 0,
            addedAccounts: [],
            campaignContent: campaign.campaignContent ?? campaign.videos ?? [],
            socialMedia: campaign.socialMedia as SocialMediaType ?? 'instagram' as SocialMediaType,
            status: campaign.statusCampaign as CampaignStatusType,
            totalFollowers: 0,
            totalLikes: 0,
            totalImpressions: 0,
            creationDate: formatDate(campaign.createdAt),
            isClosed: campaign.isCopy ?? false,
            isCpmAndResultHidden: campaign.isCpmAndResultHidden ?? false,
            isPriceHidden: campaign.isPriceHidden ?? false,
            hiddenColumns: campaign.hiddenColumns ?? [],
            shareLink: campaign.shareLink ?? null,
        };

        for (const addedAccount of campaign.selectInfluencers ?? []) {
            const normalizedUsername =
                addedAccount?.socialMediaUsername?.trim() ||
                addedAccount?.instagramUsername?.trim() ||
                '';

            const socialMedia =
                addedAccount?.socialMedia ||
                (campaign.socialMedia !== 'multipromo' && campaign.socialMedia);

            const selectedCampaignContentItemId =
                addedAccount?.selectedContent?.campaignContentItemId?.toString() ??
                addedAccount?.selectedCampaignContentItem?.toString() ??
                (Array.isArray(campaign?.videos)
                    ? campaign.videos.find((v) => v.videoLink === addedAccount?.selectedVideo)?._id?.toString()
                    : null) ??
                null;

            let selectedCampaignContentItem = null;
            if (selectedCampaignContentItemId) {
                selectedCampaignContentItem =
                    (Array.isArray(campaign.campaignContent)
                        ? (() => {
                            const contentItem = campaign.campaignContent.find(
                                (item) => item?._id.toString() === selectedCampaignContentItemId,
                            );
                            if (!contentItem) return null;

                            const postDescription =
                                contentItem.postDescriptions?.find(
                                    (pd) =>
                                        pd._id.toString() ===
                                        addedAccount.selectedContent?.postDescriptionId?.toString(),
                                )?.description ??
                                (contentItem as any)?.postDescription ??
                                '';

                            return {
                                _id: contentItem._id,
                                videoLink: contentItem.videoLink,
                                postDescription: postDescription || null,
                                storyTag: contentItem.storyTag || null,
                                storyLink: contentItem.swipeUpLink || null,
                                specialWishes: contentItem.specialWishes,
                            };
                        })()
                        : null) ??
                    (Array.isArray(campaign.videos)
                        ? campaign.videos.find(
                            (item) => item?._id?.toString() === selectedCampaignContentItemId?.toString(),
                        )
                        : null) ??
                    null;
            }

            addedAccount.selectedCampaignContentItemId = selectedCampaignContentItemId;
            addedAccount.selectedCampaignContentItem = selectedCampaignContentItem;
            addedAccount.socialMedia = socialMedia;
            addedAccount.socialMediaUsername = normalizedUsername;

            campaignToReturn.totalFollowers += addedAccount?.followersNumber ?? 0;
            campaignToReturn.totalLikes += parseInt(addedAccount.like?.replace(/[\s,]/g, '') || '0');
            campaignToReturn.totalImpressions += parseInt(
                addedAccount.impressions?.replace(/[\s,]/g, '') || '0',
            );

            campaignToReturn.addedAccounts.push(addedAccount);
        }

        // сортировка аккаунтов по порядку контента
        campaignToReturn.addedAccounts = campaignToReturn.addedAccounts.sort((a, b) => {
            const aIndex = Array.isArray(campaign.campaignContent)
                ? campaign.campaignContent.findIndex(
                    (c) => c?._id?.toString() === a.selectedCampaignContentItemId?.toString(),
                )
                : Array.isArray(campaign.videos)
                    ? campaign.videos.findIndex(
                        (v) => v?._id?.toString() === a.selectedCampaignContentItemId?.toString(),
                    )
                    : -1;

            const bIndex = Array.isArray(campaign.campaignContent)
                ? campaign.campaignContent.findIndex(
                    (c) => c?._id?.toString() === b.selectedCampaignContentItemId?.toString(),
                )
                : Array.isArray(campaign.videos)
                    ? campaign.videos.findIndex(
                        (v) => v?._id?.toString() === b.selectedCampaignContentItemId?.toString(),
                    )
                    : -1;

            return aIndex - bIndex;
        });

        return campaignToReturn;
    }
}