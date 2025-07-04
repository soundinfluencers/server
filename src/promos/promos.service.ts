import { Injectable, Logger } from '@nestjs/common';
import { CreatePromosDto } from './dto/create-promo.dto';
import { CreatePromosEstimateDto } from './dto/create-promo-estimate.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Promos } from './schemas/promo.schema';
import mongoose, { Types } from 'mongoose';
import { Client } from 'src/auth/schemas/client.schema';
import { Influencer } from 'src/auth/schemas/influencer.schema';
import { Offers } from './schemas/offers.schema';
import sendMail from 'src/utils/sendMail';
import { DropboxService } from 'src/services/Dropbox.service';
import { PromosCopies } from '../admin/schemas/promos-copies.schema';
import axios from 'axios';
import * as process from 'node:process';
import { GetSelectedSocialAccountsDto } from './dto/get-selected-social-accounts.dto';
import { decodeAndDecrypt } from '../utils/crypt';
import { SendNewFullServicedCampaignRequest } from './dto/send-new-full-serviced-campaign-request';
import { SaveXlsxPromoDto } from './dto/save-xlsx-promo.dto';

mongoose.Promise = global.Promise;

@Injectable()
export class PromosService {
  private readonly logger = new Logger();

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
  ) {}

  async createPromo(data: CreatePromosDto) {
    if (!data) {
      return {
        status: 400,
        message: 'Not enough arguments',
      };
    }

    try {
      const processedInfluencers = await Promise.all(
        data.selectInfluencers.map(async (influencer) => {
          try {
            const dateRequest = influencer.dateRequest;

            const influencerData = await this.influencerModel
              .findOne({
                [`${influencer.socialMedia}._id`]: new mongoose.Types.ObjectId(
                  influencer.socialMediaAccountId,
                ),
              })
              .lean()
              .exec();
            const influencerId = influencerData._id.toString();

            const socialMediaAccount = influencerData[influencer.socialMedia].find(
              (account) =>
                account.instagramUsername === influencer.socialMediaUsername &&
                account._id.toString() === influencer.socialMediaAccountId,
            );

            if (socialMediaAccount) {
              return {
                ...influencer,
                influencerId: influencerId,
                _id: new mongoose.Types.ObjectId(),
                price: socialMediaAccount.price,
                publicPrice: socialMediaAccount.publicPrice,
                followersNumber: parseInt(socialMediaAccount.followersNumber.replace(/[.,]/g, '')),
                dateRequest,
              };
            }
          } catch (err) {
            console.error(err, `Creating campaign ${new Date().toLocaleDateString()}`);
            throw err;
          }
        }),
      );

      const processedCampaignContent = await Promise.all(
        data.campaignContent.map(async (campaignContentItem) => ({
          videoLink: campaignContentItem.videoLink.trim(),
          postDescription: campaignContentItem.postDescription.trim(),
          storyTag: campaignContentItem.storyTag.trim(),
          swipeUpLink: campaignContentItem.swipeUpLink.trim(),
          specialWishes: campaignContentItem.specialWishes.trim(),
          socialMedia: campaignContentItem.socialMedia,
          _id: new mongoose.Types.ObjectId(campaignContentItem._id),
        })),
      );

      let result;

      try {
        const campaignId = new mongoose.Types.ObjectId();
        result = await this.promosModel.create({
          ...data,
          _id: campaignId,
          campaignName: data.campaignName.trim(),
          selectInfluencers: processedInfluencers,
          paymentType: !data.paymentType ? 'payment' : data.paymentType,
          paymentStatus: 'wait',
          statusCampaign: 'wait',
          verifyCampaign: 'wait',
          shareLink: `${process.env.SERVER_CLIENT}/promo-share/${campaignId}/${data.socialMedia}`,
          campaignContent: processedCampaignContent,
        });
      } catch (err) {
        return {
          code: 500,
          message: err.message,
        };
      }

      let dataClient = await this.clientModel.findOne({ _id: data.clientId });

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
                        <li><strong>Track/Playlist Title:</strong> ${campaignContentItem.postDescription}</li>
                        <li><strong>Track/Playlist Link:</strong> ${campaignContentItem.videoLink}</li>
                        <li><strong>Special Wishes:</strong> ${campaignContentItem.specialWishes}</li>
                    </ul>
                    <p><strong>Selected Influencers:</strong></p>
    <ul>
        ${data.selectInfluencers
          .filter(
            (influencer) =>
              influencer.selectedCampaignContentItem === campaignContentItem._id.toString(),
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
                        <li><strong>Link to Music, Events, News:</strong> ${campaignContentItem.videoLink}</li>
                        <li><strong>Link to Artwork & Press Shots:</strong> ${campaignContentItem.postDescription}</li>
                        <li><strong>Link To Press Release:</strong> ${campaignContentItem.storyTag}</li>
                        <li><strong>Special Wishes:</strong> ${campaignContentItem.specialWishes}</li>
                    </ul>
                    <p><strong>Selected Influencers:</strong></p>
    <ul>
        ${data.selectInfluencers
          .filter(
            (influencer) =>
              influencer.selectedCampaignContentItem === campaignContentItem._id.toString(),
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
                        <li><strong>Post Description:</strong> ${campaignContentItem.postDescription}</li>
                        <li><strong>Story Tag:</strong> ${campaignContentItem.storyTag}</li>
                        <li><strong>Swipe Up Link:</strong> ${campaignContentItem.swipeUpLink}</li>
                        <li><strong>Special Wishes:</strong> ${campaignContentItem.specialWishes}</li>
                        <p><strong>Selected Influencers:</strong></p>
    <ul>
        ${processedInfluencers
          .filter(
            (influencer) =>
              influencer.selectedCampaignContentItem === campaignContentItem._id.toString(),
          )
          .map(
            (influencer) =>
              `<li>${influencer.socialMedia} username: ${influencer.socialMediaUsername}</li>`,
          )
          .join('')}
    </ul>
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
    <a style="font-weight: 600" href="${process.env.SERVER}/promos/verify-promo?promoId=${result._id}&status=accept">
        Approve
    </a> 
    <a style="font-weight: 600" href="${process.env.SERVER}/promos/verify-promo?promoId=${result._id}&status=cancel">
        Decline
    </a>
</p>`;

      await sendMail(
        // 'nazarkozynets030606@zohomail.eu',
        'admin@soundinfluencers.com',
        'SoundInfluencers',
        emailContent,
        'html',
      );

      return {
        code: 201,
        result,
      };
    } catch (err) {
      console.error('Error creating promo:', err, new Date().toLocaleString());
      return {
        code: 500,
        message: err.message,
      };
    }
  }

  async createPromosForEstimate() {
    return {
      code: 500,
      message: 'Server error',
    };
  }

  async updateEstimatePromo(promoId: string, isPoNeed: string) {
    try {
      const findPromo = await this.promosModel.findOne({ _id: promoId }).lean().exec();

      if (!findPromo) {
        return { status: 404, message: 'Promo not found' };
      }

      let updateFields: any = {
        statusCampaign: findPromo.statusCampaign,
        verifyCampaign: findPromo.verifyCampaign,
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

      if (
        updateFields.statusCampaign !== findPromo.statusCampaign ||
        updateFields.verifyCampaign !== findPromo.verifyCampaign
      ) {
        await this.promosModel.findOneAndUpdate({ _id: promoId }, updateFields);
      }

      return { status: 200, message: 'estimate Promo status updated successfully' };
    } catch (err) {
      console.error('Error updating promo status:', err);
      return { status: 500, message: err.message };
    }
  }

  async verifyCampaign(campaignId: string, status: string) {
    if (!campaignId || !status) {
      return {
        status: 400,
        message: 'Not enough arguments',
      };
    }

    try {
      const checkCampaign = await this.promosModel.findOne({ _id: campaignId }).lean();

      if (!checkCampaign) {
        return {
          code: 404,
          message: 'Campaign not found',
        };
      }

      if (status === 'accept' && checkCampaign.statusCampaign === 'wait') {
        const influencersIds = checkCampaign.selectInfluencers.map((item) => item.influencerId);

        const influencers = await this.influencerModel.find({ _id: { $in: influencersIds } });

        if (!influencers) {
          return {
            code: 404,
            message: 'Influencers not found',
          };
        }

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

                    if (res.data.code !== 200) {
                      this.logger.error(
                        `Error saving influencer history (username: ${account.instagramUsername} influencerId: ${influencer._id}) verify campaign ${checkCampaign.campaignName}`,
                      );
                      throw new Error('Error saving influencer history verify campaign');
                    }
                  }

                  return account.instagramUsername;
                }),
              );

              return usernames.filter(Boolean);
            }),
          );

          const influencerSocialMediaAccounts = influencerSocialMediaAccountsNested.flat();

          const influencerSelectedCampaignContent = checkCampaign.campaignContent.filter(
            (campaignContentItem) => {
              return checkCampaign.selectInfluencers.some((influencerData) => {
                return (
                  influencerData.selectedCampaignContentItem ===
                    campaignContentItem._id.toString() &&
                  influencerSocialMediaAccounts.includes(influencerData.socialMediaUsername)
                );
              });
            },
          );

          if (influencerSelectedCampaignContent.length > 0) {
            const emailToInfluencer = `
<p>Hi,</p>
<p>You have received a new promo request on your account for the following:</p>
<p><strong>${checkCampaign.socialMedia.charAt(0).toUpperCase() + checkCampaign.socialMedia.slice(1)} Post & Story</strong></p>
${influencerSelectedCampaignContent
  .map(
    (campaignContentItem, index) => `
    <p><strong>Post Content ${index + 1}:</strong></p>
    <ul>
        <li><strong>Link:</strong> ${campaignContentItem.videoLink || 'No link provided'}</li>
        <li><strong>Post Description:</strong> ${campaignContentItem.postDescription || 'No description provided'}</li>
        <li><strong>Story Tag:</strong> ${campaignContentItem.storyTag || 'No story tag provided'}</li>
        <li><strong>Swipe Up Link:</strong> ${campaignContentItem.swipeUpLink || 'No post link provided'}</li>
        <li><strong>Special Requests:</strong> ${campaignContentItem.specialWishes || 'None'}</li>
    </ul>
`,
  )
  .join('')}      
<p>Access your account to accept or deny it here: https://go.soundinfluencers.com/account/influencer/new-promos</p>     
<p>Thanks,</p>
<p>Soundinfluencers Team</p>
`;

            try {
              await sendMail(
                // 'nazarkozynets030606@zohomail.eu',
                influencer.email,
                'SoundInfluencers',
                emailToInfluencer,
                'html',
              );
            } catch (err) {
              console.error('Error sending emails to influencers:', err);
            }
          }
        }

        const updateFields = {
          verifyCampaign: (checkCampaign as any)?.verifyCampaign,
          verifyPromo: (checkCampaign as any)?.verifyPromo,
        };
        if ((checkCampaign as any).verifyPromo !== undefined) {
          updateFields.verifyPromo = status;
        }
        if (checkCampaign.verifyCampaign !== undefined) {
          updateFields.verifyCampaign = status;
        }

        await this.promosModel.updateOne({ _id: campaignId }, { $set: updateFields });

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
    } catch (err) {
      this.logger.error(
        `Failed to verify campaign: ${err}`,
        err instanceof Error ? err.stack : undefined,
      );
      return {
        code: 500,
        message: 'Error verifying campaign',
      };
    }
  }

  async getOffers(socialMedia: string) {
    try {
      const offers = await this.offersModel.find({ socialMedia }).lean();

      const offersWithAvatars = await Promise.all(
        offers.map(async (offer: any) => {
          const connectInfluencerWithAvatars = await Promise.all(
            (offer.connectInfluencer || []).map(async (influencer: any) => {
              if (!influencer.influencerId || !influencer.instagramUsername) {
                return influencer;
              }

              try {
                const avatar = await this.getInfluencerAvatarById(
                  influencer.influencerId,
                  influencer.instagramUsername,
                );

                return {
                  ...influencer,
                  avatar,
                };
              } catch (error) {
                return influencer;
              }
            }),
          );

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
                      influencer.instagramUsername,
                    );

                    return {
                      ...influencer,
                      avatar,
                    };
                  } catch (error) {
                    return influencer;
                  }
                }),
              );

              return {
                ...style,
                connectInfluencer: connectInfluencersWithAvatars,
              };
            }),
          );

          return {
            ...offer,
            connectInfluencer: connectInfluencerWithAvatars,
            musicStyles: musicStylesWithAvatars,
          };
        }),
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
      const offers = await this.offersModel.find({ socialMedia }).lean();

      const processedOffers = await Promise.all(
        offers.map(async (offer: any) => {
          let processedOffer = {
            id: offer.id,
            followers: offer.followers,
            network: offer.network,
            story: offer.story,
            socialMedia: offer.socialMedia,
            musicStylesAccounts: [],
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
              genre: 'Techno (Melodic)',
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
        }),
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
    });

    if (!influencer) {
      throw new Error(`Influencer with ID ${influencerId} not found`);
    }

    const instagramAccount = influencer.instagram?.find(
      (item) => item.instagramUsername === instagramName,
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
          message: 'Not enough arguments',
        };
      }

      const checkUser = await this.clientModel.findById(id);
      if (!checkUser) {
        return {
          code: 404,
          message: 'User not found',
        };
      }

      const campaigns = await this.promosCopiesModel
        .find({
          $or: [
            { clientId: id, statusCampaign: 'finally' },
            { userId: id, statusPromo: 'finally' },
          ],
        })
        .lean();

      const campaignsToReturn = await Promise.all(
        campaigns.map(async (item) => {
          const clientId = item.clientId || (item as any).userId;
          const clientName = await this.clientModel.findById(clientId);
          if (!clientName) return { ...item, client: 'No Data' };
          return { ...item, client: clientName.firstName };
        }),
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
          code: 400,
          message: 'Not enough arguments',
        };
      }

      const checkClient = await this.clientModel.findById(id);

      if (!checkClient) {
        return {
          code: 404,
          message: 'User not found',
        };
      }

      const campaigns = await this.promosModel
        .find({
          clientId: id,
          statusCampaign: { $in: ['work', 'wait', 'estimate', 'po waiting'] },
        })
        .lean();

      const campaignToReturn = await Promise.all(
        campaigns.map(async (item) => {
          const clientId = item.clientId || (item as any).userId;
          const clientName = await this.clientModel.findById(clientId);
          if (!clientName) return { ...item, client: 'No Date' };
          return {
            ...item,
            client: clientName.firstName,
            brand: clientName.company,
          };
        }),
      );

      return {
        code: 200,
        campaigns: campaignToReturn,
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
          message: 'Not enough arguments',
        };
      }

      const checkUser = await this.clientModel.findById(clientId);
      if (!checkUser) {
        return {
          code: 404,
          message: 'User not found',
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
            message: 'Promo not found',
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
              firstName: '',
            };
          }

          const socialMediaToUse =
            campaign.socialMedia === 'multipromo'
              ? influencerItem.socialMedia
              : campaign.socialMedia;

          const socialMediaAccount = influencerData[socialMediaToUse].find(
            (item) =>
              item.instagramUsername ===
              (influencerItem.socialMediaUsername || (influencerItem as any).instagramUsername),
          );

          if (!campaign.isCopy) totalFollowers += parseInt(socialMediaAccount.followersNumber);
          let followersNumber = !campaign.isCopy
            ? socialMediaAccount.followersNumber
            : influencerItem.followersNumber;

          return {
            ...influencerItem,
            selectedCampaignContentItem:
              influencerItem.selectedCampaignContentItem || (influencerItem as any).selectedVideo,
            selectedCampaignContentItemObj: campaign.campaignContent
              ? campaign.campaignContent.find(
                  (campaignContentItem) =>
                    campaignContentItem._id.toString() ===
                    influencerItem.selectedCampaignContentItem,
                )
              : (campaign as any).videos
                ? (campaign as any).videos.find(
                    (video) => video.videoLink === (influencerItem as any).selectedVideo,
                  )
                : null,
            socialMediaUsername:
              influencerItem.socialMediaUsername || (influencerItem as any).instagramUsername,
            firstName: influencerData.firstName,
            followersNumber: followersNumber,
            logo: socialMediaAccount.logo,
          };
        }),
      );

      const sortedInfluencers = selectInfluencersWithDetails.sort((a, b) => {
        try {
          const aContentId = a.selectedCampaignContentItem;
          const bContentId = b.selectedCampaignContentItem;

          const aIndex = campaign.campaignContent
            ? campaign.campaignContent.findIndex((content) => content._id.toString() === aContentId)
            : (campaign as any).videos
              ? (campaign as any).videos.findIndex((video) => video.videoLink === aContentId)
              : -1;

          const bIndex = campaign.campaignContent
            ? campaign.campaignContent.findIndex((content) => content._id.toString() === bContentId)
            : (campaign as any).videos
              ? (campaign as any).videos.findIndex((video) => video.videoLink === bContentId)
              : -1;

          return aIndex - bIndex;
        } catch (err) {
          console.log(err, 'Error sorting influencers by campaignContentItem index');
        }
      });

      return {
        code: 200,
        campaign: {
          ...campaign,
          selectInfluencers: sortedInfluencers || selectInfluencersWithDetails,
          brand: clientData ? clientData.company : 'No Data',
          client: clientData ? clientData.firstName : 'No Data',
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
        message: err.message || 'Internal Server Error',
      };
    }
  }

  async influencerCompletedCampaignsHistory(influencerId: string) {
    try {
      if (!influencerId) {
        return {
          status: 400,
          message: 'Not enough arguments',
        };
      }

      const checkInfluencer = await this.influencerModel.findOne({ _id: influencerId });
      if (!checkInfluencer) {
        return {
          code: 404,
          message: 'User not found',
        };
      }

      const [campaigns, finishedCampaigns] = await Promise.all([
        this.promosModel
          .find({
            selectInfluencers: {
              $elemMatch: {
                influencerId,
                $or: [{ closePromo: 'close' }, { screenshot: { $ne: '' } }],
              },
            },
          })
          .lean(),

        this.promosCopiesModel
          .find({
            selectInfluencers: {
              $elemMatch: {
                influencerId,
                $or: [{ closePromo: 'close' }, { screenshot: { $ne: '' } }],
              },
            },
          })
          .lean(),
      ]);

      const allCampaigns = [...campaigns, ...finishedCampaigns];

      const campaignsToReturn = await Promise.all(
        allCampaigns
          .flatMap(async (campaignItem) => {
            if (!campaignItem.selectInfluencers) return [];
            const client = await this.clientModel.findById(
              campaignItem.clientId || (campaignItem as any).userId,
            );

            return campaignItem.selectInfluencers.flatMap((influencerItem) => {
              if (
                influencerItem.influencerId.toString() !== influencerId ||
                (influencerItem.closePromo !== 'close' && influencerItem.screenshot === '')
              )
                return [];

              if (influencerItem.selectedCampaignContentItem) {
                return [
                  {
                    socialMediaUsername:
                      influencerItem.socialMediaUsername ||
                      (influencerItem as any).instagramUsername,
                    createdAt: campaignItem.createdAt,
                    socialMedia: influencerItem.socialMedia,
                    campaignId: campaignItem._id,
                    statusCampaign:
                      campaignItem.statusCampaign || (campaignItem as any).statusPromo,
                    campaignName: campaignItem.campaignName,
                    selectedCampaignContentItem: influencerItem.selectedCampaignContentItem,
                  },
                ];
              } else if ((influencerItem as any).selectedVideo) {
                return [
                  {
                    socialMediaUsername:
                      influencerItem.socialMediaUsername ||
                      (influencerItem as any).instagramUsername,
                    createdAt: campaignItem.createdAt,
                    socialMedia: influencerItem.socialMedia
                      ? influencerItem.socialMedia
                      : campaignItem.socialMedia
                        ? campaignItem.socialMedia
                        : 'instagram',
                    campaignId: campaignItem._id,
                    statusCampaign:
                      campaignItem.statusCampaign || (campaignItem as any).statusPromo,
                    campaignName: campaignItem.campaignName,
                    selectedCampaignContentItem: (influencerItem as any).selectedVideo,
                  },
                ];
              }

              return [];
            });
          })
          .filter(Boolean),
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
  }

  async influencerPastCampaignOne(
    influencerId: string,
    campaignId: string,
    socialMediaUsername: string,
    selectedCampaignContentItem: string,
  ) {
    if (!influencerId || !campaignId || !socialMediaUsername || !selectedCampaignContentItem) {
      return {
        status: 400,
        message: 'Not enough arguments',
      };
    }

    try {
      const influencer = await this.influencerModel.findById(influencerId);
      if (!influencer) {
        return {
          code: 404,
          message: 'Influencer not found',
        };
      }

      let campaign = await this.promosCopiesModel
        .findOne({
          _id: campaignId,
          selectInfluencers: {
            $elemMatch: {
              influencerId: influencerId,
              $or: [
                { socialMediaUsername: socialMediaUsername },
                { instagramUsername: socialMediaUsername },
              ],
            },
          },
        })
        .lean()
        .exec();

      if (!campaign) {
        campaign = (await this.promosModel
          .findOne({
            _id: campaignId,
            selectInfluencers: {
              $elemMatch: {
                influencerId: influencerId,
                $or: [
                  { socialMediaUsername: socialMediaUsername },
                  { instagramUsername: socialMediaUsername },
                ],
              },
            },
          })
          .lean()
          .exec()) as any;

        if (!campaign) {
          return {
            code: 404,
            message: 'Campaign not found',
          };
        }
      }

      const client = await this.clientModel.findById(campaign.clientId || (campaign as any).userId);

      if (!client) {
        return {
          code: 404,
          message: 'Client not found',
        };
      }

      const selectedAccount = campaign.selectInfluencers.find((influencerItem) => {
        return (
          influencerItem.influencerId.toString() === influencerId &&
          (influencerItem.socialMediaUsername === socialMediaUsername ||
            (influencerItem as any).instagramUsername === socialMediaUsername)
        );
      });

      if (!selectedAccount) {
        return {
          code: 404,
          message: 'Not found',
        };
      }

      let contentItem = {};
      if (selectedAccount.selectedCampaignContentItem) {
        contentItem = campaign.campaignContent.find(
          (item) => item._id.toString() === selectedCampaignContentItem,
        );
      } else if ((selectedAccount as any).selectedVideo) {
        contentItem = (campaign as any).videos.find(
          (video) => video.videoLink === selectedCampaignContentItem,
        );
      }

      if (!contentItem) {
        return {
          code: 404,
          message: 'Campaign content not found',
        };
      }

      return {
        code: 200,
        promo: {
          campaignName: campaign.campaignName,
          influencerId: influencerId,
          socialMediaUsername:
            selectedAccount.socialMediaUsername || (selectedAccount as any).instagramUsername,
          dateRequest: selectedAccount.dateRequest,
          client: client?.company || client?.firstName || 'No information',
          socialMedia: campaign.socialMedia,
          videoLink: (contentItem as any).videoLink,
          postDescription: (contentItem as any).postDescription,
          storyTag: (contentItem as any).storyTag,
          swipeUpLink: (contentItem as any).swipeUpLink,
          specialWishes: (contentItem as any).specialWishes,
        },
      };
    } catch (err) {
      return {
        code: 500,
        message: err,
      };
    }
  }

  async clientPastCampaignOne(clientId: string, campaignId: string) {
    try {
      if (!clientId || !campaignId) {
        return {
          status: 400,
          message: 'Not enough arguments',
        };
      }

      const checkClient = await this.clientModel.findById(clientId);

      if (!checkClient) {
        return {
          code: 404,
          message: 'User not found',
        };
      }

      let result = await this.promosCopiesModel.findOne({ _id: campaignId }).lean();

      if (!result) {
        return {
          code: 404,
          message: 'not found',
        };
      }

      return {
        code: 200,
        promo: {
          ...result,
          client: checkClient?.company || checkClient?.firstName || 'No information',
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
          message: 'Not enough arguments',
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
          message: 'Influencer not found',
        };
      }

      const campaigns = await this.promosModel
        .find({
          selectInfluencers: {
            $elemMatch: { influencerId: influencerId, confirmation: 'wait' },
          },
          $or: [{ verifyPromo: 'accept' }, { verifyCampaign: 'accept' }],
        })
        .lean();

      if (!campaigns) {
        return {
          code: 404,
          message: 'Campaigns not found',
        };
      }

      const allSocialMediaAccounts = campaigns
        .flatMap((item) => {
          return item.selectInfluencers.flatMap((acc) => {
            if (acc.confirmation !== 'wait' || acc.influencerId.toString() !== influencerId)
              return [];

            const { selectInfluencers, ...newObject } = item;
            const { _id, ...newObjectSocialMediaAccount } = acc;

            if (acc.selectedCampaignContentItem) {
              const selectedCampaignContentItem = item.campaignContent.find(
                (item) => item._id.toString() === acc.selectedCampaignContentItem,
              );

              return {
                selectInfluencersId: acc._id,
                influencerId: newObjectSocialMediaAccount.influencerId,
                campaignName: newObject.campaignName,
                videoLink: selectedCampaignContentItem.videoLink,
                postDescription: selectedCampaignContentItem.postDescription,
                storyTag: selectedCampaignContentItem.storyTag,
                swipeUpLink: selectedCampaignContentItem.swipeUpLink,
                specialWishes: selectedCampaignContentItem.specialWishes,
                socialMediaUsername:
                  newObjectSocialMediaAccount.socialMediaUsername ||
                  (newObjectSocialMediaAccount as any).instagramUsername,
                userId: newObject.clientId || (newObject as any).userId,
                dateRequest: newObjectSocialMediaAccount.dateRequest,
                createdAt: newObject.createdAt,
                socialMedia: acc.socialMedia,
                campaignId: newObject._id,
              };
            } else if ((acc as any).selectedVideo) {
              const selectedVideoObj = (item as any).videos.find(
                (video) => video.videoLink === (acc as any).selectedVideo,
              );

              return [
                {
                  selectInfluencersId: acc._id,
                  influencerId: newObjectSocialMediaAccount.influencerId,
                  campaignName: newObject.campaignName,
                  videoLink: selectedVideoObj.videoLink,
                  postDescription: selectedVideoObj.postDescription,
                  storyTag: selectedVideoObj.storyTag,
                  swipeUpLink: selectedVideoObj.swipeUpLink,
                  specialWishes: selectedVideoObj.specialWishes,
                  socialMediaUsername:
                    newObjectSocialMediaAccount.socialMediaUsername ||
                    (newObjectSocialMediaAccount as any).instagramUsername,
                  userId: newObject.clientId || (newObject as any).userId,
                  dateRequest: newObjectSocialMediaAccount.dateRequest,
                  createdAt: newObject.createdAt,
                  socialMedia: newObject.socialMedia,
                  campaignId: newObject._id,
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

      const campaignsWithClientName = await Promise.all(
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

      return {
        code: 200,
        promos: campaignsWithClientName
          .flat()
          .sort(
            (a, b) =>
              new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime(),
          ),
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
    selectInfluencersId: string,
  ) {
    if (!influencerId || !socialMediaUsername || !campaignId || !campaignResponse) {
      return {
        status: 400,
        message: 'Not enough arguments',
      };
    }

    try {
      const findNewCampaign = await this.promosModel.findById(campaignId).lean().exec();

      if (!findNewCampaign) {
        return {
          code: 404,
          message: 'Promo not found',
        };
      }

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

        if (resultOfSavingHistory.data.code !== 200) {
          console.error('Error saving history:', resultOfSavingHistory.data.message);
          return {
            code: 500,
            message: 'Internal Server Error',
          };
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
              ...(findNewCampaign.statusCampaign
                ? { statusCampaign: 'work' }
                : { statusPromo: 'work' }),
              'selectInfluencers.$.confirmation': campaignResponse,
            },
          },
        );

        const checkUserInfluencer = await this.influencerModel.findById(influencerId);
        const checkUserClient = await this.clientModel.findById(
          findNewCampaign.clientId || (findNewCampaign as any).userId,
        );

        await sendMail(
          // 'nazarkozynets030606@zohomail.eu',
          'admin@soundinfluencers.com',
          'SoundInfluencers',
          `<p>${checkUserInfluencer.email} accepted the offer for ${checkUserClient.email}'s campaign</p><br/>
                <p><b>Details:</b></p>
                <p><b>Campaign Name:</b> ${findNewCampaign.campaignName}</p>
                <p><b>Client Name:</b> ${checkUserClient.firstName}</p>
                <p><b>Campaign Content:</b> ${
                  findNewCampaign.campaignContent
                    ? findNewCampaign.campaignContent
                        .map(
                          (campaignContentItem) =>
                            `<a href="${campaignContentItem.videoLink}">${campaignContentItem.videoLink}</a>`,
                        )
                        .join(', ')
                    : (findNewCampaign as any).videos
                        .map((video) => `<a href="${video.videoLink}">${video.videoLink}</a>`)
                        .join(', ')
                }</p>`,
          'html',
        );

        return {
          code: 200,
          updateNewPromo,
        };
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

        if (resultOfSavingHistory.data.code !== 200) {
          console.error('Error saving history:', resultOfSavingHistory.data.message);
          return {
            code: 500,
            message: 'Internal Server Error',
          };
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
              'selectInfluencers.$.confirmation': campaignResponse,
              partialRefund:
                findNewCampaign.partialRefund + selectInfluencersAcc.price.replace(/\D/g, ''),
            },
          },
          { new: true },
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
                          (campaignContentItem) =>
                            `<a href="${campaignContentItem.videoLink}">${campaignContentItem.videoLink}</a>`,
                        )
                        .join(', ')
                    : (findNewCampaign as any).videos
                        .map((video) => `<a href="${video.videoLink}">${video.videoLink}</a>`)
                        .join(', ')
                }</p>`,
          'html',
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
        message: err.message || 'Internal Server Error',
      };
    }
  }

  async influencerGetOngoingCampaigns(influencerId: string) {
    try {
      if (!influencerId) {
        return {
          status: 400,
          message: 'Not enough arguments',
        };
      }

      const checkInfluencer = await this.influencerModel.findOne({
        _id: influencerId,
      });

      if (!checkInfluencer) {
        return {
          code: 404,
          message: 'User not found',
        };
      }

      const campaigns = await this.promosModel
        .find({
          selectInfluencers: {
            $elemMatch: {
              influencerId: influencerId,
              confirmation: 'accept',
              closePromo: 'wait',
            },
          },
          $or: [{ statusPromo: 'work' }, { statusCampaign: 'work' }],
        })
        .lean();

      const allSocialMediaAccounts = campaigns
        .flatMap((item) => {
          return item.selectInfluencers.map((acc) => {
            if (
              acc.confirmation === 'accept' &&
              acc.closePromo === 'wait' &&
              acc.influencerId.toString() === influencerId &&
              acc.screenshot === ''
            ) {
              return {
                selectInfluencersId: acc._id,
                instagramUsername: acc.socialMediaUsername,
                clientId: item.clientId,
                promoId: item._id,
                statusCampaign: item.statusCampaign,
                campaignName: item.campaignName,
                socialMedia: acc.socialMedia,
                confirmation: acc.confirmation,
                closePromo: acc.closePromo,
                createdAt: item.createdAt,
                influencerId: acc.influencerId,
                selectedCampaignContentItem: acc.selectedCampaignContentItem,
              };
            }

            return null;
          });
        })
        .filter(Boolean);

      const campaignsName = await Promise.all(
        allSocialMediaAccounts.map(async (item) => {
          const client = await this.clientModel.findById(item.clientId);
          const clientName = !client ? 'No Date' : client.company;

          return {
            ...item,
            client: clientName,
            date: item.createdAt,
          };
        }),
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
    selectInfluencersId: string,
  ) {
    if (!influencerId || !campaignId || !socialMediaUsername) {
      return {
        status: 400,
        message: 'Not enough arguments',
      };
    }

    const influencer = await this.influencerModel.findById(influencerId);
    if (!influencer) {
      return {
        code: 404,
        message: 'Influencer not found',
      };
    }

    const campaign = await this.promosModel
      .findOne({
        _id: campaignId,
        selectInfluencers: {
          $elemMatch: {
            influencerId: influencerId,
            confirmation: 'accept',
            $or: [
              { socialMediaUsername: socialMediaUsername },
              { instagramUsername: socialMediaUsername },
            ],
          },
        },
      })
      .lean();

    if (!campaign) {
      return {
        code: 404,
        message: 'Promo not found',
      };
    }

    const client = await this.clientModel.findById(campaign.clientId || (campaign as any).userId);

    if (!client) {
      return {
        code: 404,
        message: 'Client not found',
      };
    }

    const selectedInfluencerData = await Promise.all(
      campaign.selectInfluencers.map(async (item) => {
        if (item._id.toString() === selectInfluencersId) {
          if (campaign.campaignContent) {
            let selectedCampaignContentItem = campaign.campaignContent.find(
              (campaignContentItem) =>
                item.selectedCampaignContentItem === campaignContentItem._id.toString(),
            );

            if (selectedCampaignContentItem) {
              return {
                selectInfluencersId: item._id,
                dateRequest: item.dateRequest,
                videoLink: selectedCampaignContentItem?.videoLink || '',
                postDescription: selectedCampaignContentItem?.postDescription || '',
                storyTag: selectedCampaignContentItem?.storyTag || '',
                swipeUpLink: selectedCampaignContentItem?.swipeUpLink || '',
                specialWishes: selectedCampaignContentItem?.specialWishes || '',
                socialMedia: item.socialMedia,
              };
            }
          }

          return null;
        } else {
          return null;
        }
      }),
    );

    const filteredSelectedInfluencerData = selectedInfluencerData.filter((data) => data !== null);

    if (filteredSelectedInfluencerData !== null) {
      try {
        return {
          code: 200,
          promo: {
            socialMedia: filteredSelectedInfluencerData[0].socialMedia,
            client: client.company,
            socialNetworkUsername: socialMediaUsername,
            videoLink: filteredSelectedInfluencerData[0].videoLink,
            postDescription: filteredSelectedInfluencerData[0].postDescription,
            storyTag: filteredSelectedInfluencerData[0].storyTag,
            swipeUpLink: filteredSelectedInfluencerData[0].swipeUpLink,
            specialWishes: filteredSelectedInfluencerData[0].specialWishes,
            dateRequest: filteredSelectedInfluencerData[0].dateRequest,
            selectInfluencersId: filteredSelectedInfluencerData[0].selectInfluencersId || null,
            campaignName: campaign.campaignName,
          },
        };
      } catch (err) {
        console.error(
          err,
          `Error influencerGetOngoingCampaign. influencerId: ${influencerId}. socialMediaUsername: ${socialMediaUsername}. campaignId: ${campaignId}. campaignName: ${campaign.campaignName}`,
          new Date(),
        );
        return {
          code: 500,
          message: err,
        };
      }
    } else {
      return {
        code: 404,
        message: 'Selected influencer not found',
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
        message: 'Not enough arguments',
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
                { socialMediaUsername: socialMediaUsername },
                { instagramUsername: socialMediaUsername },
              ],
            },
          },
        })
        .lean()
        .exec();

      if (!findNewCampaign) {
        return {
          code: 404,
          message: 'not found',
        };
      }

      const dataSocialMediaAccount = findNewCampaign.selectInfluencers.find(
        (item) => item._id.toString() === selectInfluencersId,
      );

      const paymentGo = async () => {
        const foundInfluencer = await this.influencerModel.findById(influencerId);

        const priceToAdd =
          findNewCampaign.selectInfluencers
            .find((item) => item._id.toString() === selectInfluencersId)
            ?.price?.replace(/[^\d]/g, '') || null;

        if (foundInfluencer && priceToAdd) {
          await this.influencerModel.findOneAndUpdate(
            { _id: influencerId },
            {
              balance: String(Number(foundInfluencer.balance) + Number(priceToAdd)),
            },
          );
        } else {
          console.error(
            `Influencer not found while trying to update balance influencerId: ${influencerId} selectInfluencersId: ${selectInfluencersId}`,
          );
          throw Error('Error updating influencer balance');
        }
      };

      let updateNewCampaign;
      try {
        updateNewCampaign = await (async () => {
          if (
            dataSocialMediaAccount.socialMedia === 'spotify' ||
            dataSocialMediaAccount.socialMedia === 'soundcloud'
          ) {
            if (data.screenshot === '' || data.screenshot === null) {
              console.error(`Screenshot is empty (Updating spotify campaign: ${campaignId})`);
              return {
                code: 400,
                message: 'Screenshot is empty',
              };
            }

            const isPromoAlreadyClosed = dataSocialMediaAccount.closePromo === 'close';

            const resultOfSavingHistory = await axios.post(
              `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
              {
                influencerId: influencerId,
                campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                campaignName: findNewCampaign.campaignName,
                updatedCampaignAction: {
                  actionNumber: 3,
                  networkUsername: socialMediaUsername,
                  socialMedia: findNewCampaign.selectInfluencers.find(
                    (influencer) => influencer._id.toString() === selectInfluencersId,
                  ).socialMedia,
                  rewardForInfluencer: parseInt(
                    findNewCampaign.selectInfluencers
                      .find((influencer) => influencer._id.toString() === selectInfluencersId)
                      .price.replace(/\D/g, ''),
                  ),
                },
              },
            );

            if (resultOfSavingHistory.data.code !== 200) {
              console.error(
                'Error saving history:',
                resultOfSavingHistory.data.message,
                ' CampaignId: ',
                campaignId,
                ' account: ',
                socialMediaUsername,
                ` ${selectInfluencersId}`,
              );
              return {
                code: 500,
                message: 'Internal Server Error',
              };
            }

            try {
              await this.promosModel.findOneAndUpdate(
                {
                  _id: campaignId,
                  selectInfluencers: {
                    $elemMatch: {
                      influencerId: influencerId,
                      $or: [
                        { socialMediaUsername: socialMediaUsername },
                        { instagramUsername: socialMediaUsername },
                      ],
                    },
                  },
                },
                {
                  $set: Object.fromEntries(
                    Object.entries({
                      ...dataSocialMediaAccount,
                      ...data,
                      closePromo: 'close',
                    }).map(([key, value]) => [`selectInfluencers.$.${key}`, value]),
                  ),
                },
              );

              if (!isPromoAlreadyClosed) await paymentGo();

              return {
                code: 200,
              };
            } catch (err) {
              console.error(
                `Error updating promo: ${campaignId} ${err} ${new Date().toLocaleString()}`,
              );
              return {
                code: 500,
                message: 'Internal Server Error',
              };
            }
          } else if (dataSocialMediaAccount.socialMedia === 'press') {
            if (data.postLink === '' || data.postLink === null)
              return {
                code: 400,
                message: `Post link is empty (Updating press campaign: ${campaignId})`,
              };

            const isPromoAlreadyClosed = dataSocialMediaAccount.closePromo === 'close';

            const resultOfSavingHistory = await axios.post(
              `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
              {
                influencerId: influencerId,
                campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                campaignName: findNewCampaign.campaignName,
                updatedCampaignAction: {
                  actionNumber: 3,
                  networkUsername: socialMediaUsername,
                  socialMedia: findNewCampaign.selectInfluencers.find(
                    (influencer) => influencer._id.toString() === selectInfluencersId,
                  ).socialMedia,
                  rewardForInfluencer: parseInt(
                    findNewCampaign.selectInfluencers
                      .find((influencer) => influencer._id.toString() === selectInfluencersId)
                      .price.replace(/\D/g, ''),
                  ),
                },
              },
            );

            if (resultOfSavingHistory.data.code !== 200) {
              console.error(
                'Error saving history:',
                resultOfSavingHistory.data.message,
                ' CampaignId: ',
                campaignId,
                ' account: ',
                socialMediaUsername,
                ` ${selectInfluencersId}`,
              );
              return {
                code: 500,
                message: 'Internal Server Error',
              };
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
                      closePromo: 'close',
                    }).map(([key, value]) => [`selectInfluencers.$.${key}`, value]),
                  ),
                },
              );

              if (!isPromoAlreadyClosed) await paymentGo();

              return {
                code: 200,
              };
            } catch (err) {
              console.error(
                `Error updating promo: ${campaignId} ${err} ${new Date().toLocaleString()}`,
              );
              return {
                code: 500,
                message: 'Internal Server Error',
              };
            }
          } else if (data.postLink && data.impressions && data.like && data.screenshot) {
            const isPromoAlreadyClosed = dataSocialMediaAccount.closePromo === 'close';
            const resultOfSavingHistory = await axios.post(
              `${process.env.SERVER}/influencer-actions-history/upsert/campaign`,
              {
                influencerId: influencerId,
                campaignId: new mongoose.Types.ObjectId(findNewCampaign._id),
                campaignName: findNewCampaign.campaignName,
                updatedCampaignAction: {
                  actionNumber: 3,
                  networkUsername: socialMediaUsername,
                  socialMedia: findNewCampaign.selectInfluencers.find(
                    (influencer) => influencer._id.toString() === selectInfluencersId,
                  ).socialMedia,
                  rewardForInfluencer: parseInt(
                    findNewCampaign.selectInfluencers
                      .find((influencer) => influencer._id.toString() === selectInfluencersId)
                      .price.replace(/\D/g, ''),
                  ),
                },
              },
            );

            if (resultOfSavingHistory.data.code !== 200) {
              console.error(
                'Error saving history:',
                resultOfSavingHistory.data.message,
                ' CampaignId: ',
                campaignId,
                ' account: ',
                socialMediaUsername,
                ` ${selectInfluencersId}`,
              );
              return {
                code: 500,
                message: 'Internal Server Error',
              };
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
                      closePromo: 'close',
                    }).map(([key, value]) => [`selectInfluencers.$.${key}`, value]),
                  ),
                },
              );

              if (!isPromoAlreadyClosed) await paymentGo();

              return {
                code: 200,
              };
            } catch (err) {
              console.error(
                `Error updating promo: ${campaignId} ${err} ${new Date().toLocaleString()}`,
              );
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
        console.error(`Error updating campaign ${campaignId} ${new Date().toLocaleString()}`);
        return {
          code: 500,
          message: 'Internal Server Error',
        };
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
          message: 'Not enough arguments',
        };
      }

      if (!mongoose.Types.ObjectId.isValid(campaignId)) {
        return {
          status: 400,
          message: 'Invalid campaignId format',
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
          console.error('Error fetching promo copy by public share link:', err);
        }
      }

      if (!campaign) {
        return {
          code: 404,
          message: 'Promo not found',
        };
      }

      const mappedInfluencers = campaign.selectInfluencers.map((item) => {
        return {
          ...item,
          socialMediaUsername: item.socialMediaUsername || (item as any).instagramUsername,
          selectedCampaignContentItem:
            item.selectedCampaignContentItem || (item as any).selectedVideo,
          selectedCampaignContentItemObj: campaign.campaignContent
            ? campaign.campaignContent.find(
                (campaignContentItem) =>
                  campaignContentItem._id.toString() === item.selectedCampaignContentItem,
              )
            : (campaign as any).videos
              ? (campaign as any).videos.find(
                  (video) => video.videoLink === (item as any).selectedVideo,
                )
              : null,
        };
      });

      const sortedInfluencers = mappedInfluencers.sort((a, b) => {
        const aContentId = a.selectedCampaignContentItem;
        const bContentId = b.selectedCampaignContentItem;

        const aIndex = campaign.campaignContent
          ? campaign.campaignContent.findIndex((content) => content._id.toString() === aContentId)
          : (campaign as any).videos
            ? (campaign as any).videos.findIndex((video) => video.videoLink === aContentId)
            : -1;

        const bIndex = campaign.campaignContent
          ? campaign.campaignContent.findIndex((content) => content._id.toString() === bContentId)
          : (campaign as any).videos
            ? (campaign as any).videos.findIndex((video) => video.videoLink === bContentId)
            : -1;

        return aIndex - bIndex;
      });

      return {
        code: 200,
        campaign: {
          ...campaign,
          selectInfluencers: sortedInfluencers,
          amount: campaign.campaignPrice || (campaign as any).amount || 0,
          campaignContent: campaign.campaignContent || (campaign as any).videos,
        },
      };
    } catch (err) {
      console.error('Error fetching promo by public share link:', err);

      return {
        code: 500,
        message: 'An error occurred while fetching the promo.',
      };
    }
  }

  async sendNewFullServicedCampaignRequest(data: SendNewFullServicedCampaignRequest) {
    try {
      const { encryptedClientId, campaignGoal, videos, music, budget, additional = '' } = data;
      const decryptedClientId = decodeAndDecrypt(
        encryptedClientId,
        process.env.SERVER_API_ENCRYPTION_SECRET_KEY,
      );

      const clientObj = await this.clientModel.findById(decryptedClientId);

      if (!clientObj) {
        console.error(
          `There's no client with id: ${decryptedClientId} (SEND NEW FULL SERVICED CAMPAIGN REQUEST) ${new Date().toLocaleDateString()}`,
        );
        return {
          code: 400,
          message: `Can't find client with this id`,
        };
      }

      const emailText = `
    <p>${clientObj.firstName} (${clientObj.email}) requested the full serviced campaign.</p>
    <p>Details:</p><br/>
    <p><strong>Campaign Goal:</strong> ${campaignGoal}</p>
    <p><strong>Videos:</strong> ${videos}</p>
    <p><strong>Music:</strong> ${music}</p>
    <p><strong>Budget:</strong> ${budget}</p>
    ${additional ? `<p><strong>Additional:</strong> ${additional}</p>` : ''}
`;

      try {
        await sendMail(process.env.EMAIL_USER, 'SoundInfluencers', emailText, 'html');
      } catch (error) {
        return {
          code: 500,
          message: 'Server Error',
        };
      }

      return {
        code: 200,
        message: `Successfully sent`,
      };
    } catch (err) {
      console.error(
        `Error sending request of creating new full serviced campaign ${err} ${new Date().toLocaleDateString()}`,
      );
      return {
        code: 500,
        message: 'Server error',
      };
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
      const { selectedAccounts } = data;
      const dataToSend = {
        totalFollowers: 0,
        selectedAccounts: [],
      };

      for (const item of selectedAccounts) {
        const result = await this.influencerModel
          .findOne(
            {
              [`${item.socialMedia}._id`]: new mongoose.Types.ObjectId(item.influencerId),
            },
            {
              [`${item.socialMedia}`]: {
                $elemMatch: { _id: new mongoose.Types.ObjectId(item.influencerId) },
              },
            },
          )
          .lean()
          .exec();

        if (!result) {
          throw new Error(
            `Account with ID ${item.influencerId} not found (${item.socialMedia} : ${item.instagramUsername})`,
          );
        }

        const account = {
          ...result[item.socialMedia][0],
          influencerId: item.influencerId,
          socialMedia: item.socialMedia,
          dateRequest: '',
          selectedCampaignContentItem: '',
        };

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

  async saveXLSXCampaign(typeOfStorage: string, data: SaveXlsxPromoDto) {
    try {
      if (!data) {
        return {
          code: 400,
          message: 'Invalid campaign data',
        };
      }

      if (typeOfStorage === 'proposal') {
        try {
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
                        { $unwind: { path: `$${platform}`, preserveNullAndEmptyArrays: true } },
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
                                        { $trim: { input: `$${platform}.instagramUsername` } },
                                        normalizedUsername,
                                      ],
                                    },
                                    {
                                      $eq: [{ $toInt: '$$cleanFollowers' }, page.followersNumber],
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
                  { $unwind: '$combined' },
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
                  let selectedCampaignContentItem: string | null = null;

                  const existingContent = campaign.campaignContent.find(
                    (item) =>
                      item.videoLink === page.videoLink &&
                      item.postDescription === page.postDescription &&
                      item.socialMedia === result[0].socialMedia,
                  );

                  if (page.videoLink && page.postDescription && !existingContent) {
                    const newId: string = new Types.ObjectId().toHexString();
                    selectedCampaignContentItem = newId;

                    campaign.campaignContent.push({
                      _id: newId,
                      videoLink: page.videoLink,
                      postDescription: page.postDescription || '',
                      storyTag: page.storyTag || '',
                      swipeUpLink: page.storyLink || '',
                      specialWishes: page.specialWishes || '',
                      socialMedia: result[0].socialMedia,
                    });
                  } else if (existingContent) {
                    selectedCampaignContentItem = existingContent._id;
                  }

                  const formattedGenres = this.returnMusicStyles(
                    result[0].musicStyle,
                    result[0].musicStyleOther,
                    result[0].musicSubStyles,
                  );

                  campaign.selectInfluencers.push({
                    ...result[0],
                    _id: new Types.ObjectId().toHexString(),
                    socialMediaUsername: page.socialMediaUsername.trim(),
                    selectedCampaignContentItem: selectedCampaignContentItem,
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
                  { $unwind: `$${platform}` },
                  {
                    $match: {
                      $expr: {
                        $eq: [
                          { $trim: { input: `$${platform}.instagramUsername` } },
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
                  let selectedCampaignContentItem: string | null = null;

                  const existingContent = campaign.campaignContent.find(
                    (item) =>
                      item.videoLink === page.videoLink &&
                      item.postDescription === page.postDescription &&
                      item.socialMedia === result[0].socialMedia,
                  );

                  if (page.videoLink && page.postDescription && !existingContent) {
                    const newId: string = new Types.ObjectId().toHexString();
                    selectedCampaignContentItem = newId;

                    campaign.campaignContent.push({
                      _id: newId,
                      videoLink: page.videoLink,
                      postDescription: page.postDescription || '',
                      storyTag: page.storyTag || '',
                      swipeUpLink: page.storyLink || '',
                      specialWishes: page.specialWishes || '',
                      socialMedia: result[0].socialMedia,
                    });
                  } else if (existingContent) {
                    selectedCampaignContentItem = existingContent._id;
                  }

                  const formattedGenres = this.returnMusicStyles(
                    result[0].musicStyle,
                    result[0].musicStyleOther,
                    result[0].musicSubStyles,
                  );

                  campaign.selectInfluencers.push({
                    ...result[0],
                    _id: new Types.ObjectId().toHexString(),
                    socialMediaUsername: page.socialMediaUsername.trim(),
                    selectedCampaignContentItem: selectedCampaignContentItem,
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

          return {
            code: 200,
            message: 'XLSX campaign saved successfully',
          };
        } catch (err) {
          console.error('Error saving to proposalCampaignModel:', err);
          return {
            code: 500,
            message: 'Error saving XLSX campaign to proposal',
          };
        }
      } else {
        return {
          code: 400,
          message: `Unsupported storage type: ${typeOfStorage}`,
        };
      }
    } catch (err) {
      console.error('Error saving XLSXCampaign:', err);
      return {
        code: 500,
        message: 'Error saving XLSXCampaign',
      };
    }
  }

  returnMusicStyles = (musicStyle: string, musicStyleOther: string[], musicSubStyles: string[]) => {
    const genresSet = new Set();

    if (musicStyle !== undefined && musicStyle) {
      if (musicSubStyles && musicSubStyles.length > 0) {
        for (let i = 0; i < musicSubStyles.length; i++) {
          if (musicSubStyles[i] === 'Melodic, Minimal') {
            genresSet.add('Techno (Melodic, Minimal)');
          }
          if (musicSubStyles[i] === 'Hard, Peak') {
            genresSet.add('Techno (Hard, Peak)');
          }
          if (musicSubStyles[i] === 'Tech House') {
            genresSet.add('House (Tech House)');
          }
          if (musicSubStyles[i] === 'Melodic, Afro') {
            genresSet.add('House (Melodic, Afro)');
          }
        }
      } else {
        genresSet.add(musicStyle);
      }

      if (musicStyleOther && musicStyleOther.length > 0) {
        for (let i = 0; i < musicStyleOther.length; i++) {
          if (musicStyleOther[i] !== 'House') {
            genresSet.add(musicStyleOther[i]);
          }
        }
      }

      return Array.from(genresSet);
    }
  };
}
