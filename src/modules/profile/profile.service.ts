import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import {ClientUpdatedPersonalDetailsDto, UpdateClientPersonalDetailsDto} from './dto/update-client.dto';
import mongoose, {ClientSession, Types} from 'mongoose';
import {UpdateUserPasswordDto} from './dto/update-password.dto';
import {
    AddSocialMediasDto,
    InfluencerUpdatedPersonalDetailsDto,
    UpdateInfluencerPersonalDetailsDto,
    UpdateSocialMediaAccountDto
} from './dto/update-influencer.dto';
import {SendMailPriceChangeDto} from './dto/send-mail-price-change.dto';
import * as process from 'node:process';
import {AppGateway} from '../websocket/app.gateway';
import sendMail from "../../integrations/nodemailer/nodemailer";
import {Influencer} from "../../database/schemas/users/influencer.schema";
import {MigrateAccountDto} from "../migrations/dto/migrate-account.dto";
import {SocialAccountMigrationContext} from "../migrations/types/migrations.types";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {Role} from "../../common/types/auth.types";

const bcrypt = require('bcryptjs');

@Injectable()
export class ProfileService {
    constructor(
        private readonly webSocketService: AppGateway,
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
    ) {
    }

    // Updates client's personal information (firstName, company, email, phone)
    async updatePersonalClient(data: UpdateClientPersonalDetailsDto): Promise<ClientUpdatedPersonalDetailsDto> {
        const {_id, firstName, company, email, phone} = data;

        if (!_id || !firstName || !company || !email || !phone) {
            throw new BadRequestException("Not enough arguments");
        }

        const updatedUser = await this.clientRepo.findOneAndUpdate(
            {_id: _id},
            {
                firstName: firstName.trim(),
                company: company.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
            },
        );

        if (!updatedUser) {
            throw new NotFoundException("Client not found");
        }

        return {
            firstName: updatedUser.firstName,
            company: updatedUser.company,
            email: updatedUser.email,
            phone: updatedUser.phone,
        }
    }

    // Updates influencer's personal information (firstName, email, phone)
    async updatePersonalInfluencer(data: UpdateInfluencerPersonalDetailsDto): Promise<InfluencerUpdatedPersonalDetailsDto> {
        const {_id, firstName, email, phone} = data;

        if (!_id || !firstName || !email || !phone) {
            throw new BadRequestException("Not enough arguments");
        }

        const updatedUser = await this.influencerRepo.findOneAndUpdate(
            {_id: _id},
            {
                firstName: firstName.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
            },
        );

        if (!updatedUser) {
            throw new NotFoundException('Influencer not found');
        }

        return {
            firstName: updatedUser.firstName,
            email: updatedUser.email,
            phone: updatedUser.phone,
        };
    }

    // Updates user password
    async updateUserPassword(data: UpdateUserPasswordDto) {
        const {currentPassword, newPassword, _id, role} = data;

        if (!currentPassword || !newPassword || !_id) {
            throw new BadRequestException("Not enough arguments");
        }

        if (!role) {
            throw new UnauthorizedException("Not enough access");
        }

        if (role === Role.client) {
            const client = await this.clientRepo.findOne({_id: _id});

            if (!client) {
                throw new NotFoundException("Client not found");
            }

            if (bcrypt.compareSync(currentPassword, client.password)) {
                await this.clientRepo.findOneAndUpdate(
                    {_id: _id},
                    {
                        password: bcrypt.hashSync(newPassword),
                    },
                );
            } else {
                throw new BadRequestException("Passwords don't match");
            }
        } else if (role === Role.influencer) {
            const influencer = await this.influencerRepo.findOne({_id: _id});

            if (!influencer) {
                throw new NotFoundException("Influencer not found");
            }

            if (bcrypt.compareSync(data.currentPassword, influencer.password)) {
                await this.influencerRepo.findOneAndUpdate(
                    {_id: _id},
                    {
                        password: bcrypt.hashSync(newPassword),
                    },
                );
            } else {
                throw new BadRequestException("Passwords don't match");
            }
        } else {
            throw new UnauthorizedException('Not enough access');
        }
    }

//     // TODO: UPDATE
//     async updateSocialAccount(data: UpdateSocialMediaAccountDto) {
//         if (!data) throw new BadRequestException("Not enough arguments");
//
//         const influencer = await this.influencerRepo.findOne({_id: data._id});
//         if (!influencer) throw new NotFoundException("Influencer not found");
//
//         const socialMediaAccounts = influencer[data.typeOfSocialMedia];
//         if (!socialMediaAccounts || socialMediaAccounts.length === 0) {
//             return {
//                 code: 404,
//                 message: `No accounts found for type: ${data.typeOfSocialMedia}`,
//             };
//         }
//
//         const accountIndex = socialMediaAccounts.findIndex(
//             (account) => account._id?.toString() === data.accountId || account.instagramUsername === data.oldUsername,
//         );
//
//         if (accountIndex === -1) {
//             return {
//                 code: 404,
//                 message: 'Account not found',
//             };
//         }
//
//         socialMediaAccounts[accountIndex] = {
//             ...socialMediaAccounts[accountIndex],
//             instagramUsername: data.newUsername,
//             instagramLink: data.instagramLink,
//             followersNumber: data.followersNumber.replace(/[.,]/g, ''),
//             logo: data.logo,
//             musicStyle: data.musicStyle,
//             musicSubStyles: data.musicSubStyles,
//             musicStyleOther: data.musicStyleOther,
//             countries: data.countries,
//             categories: data.categories,
//             engagementRate: data.engagementRate ?? null,
//             averageViews: data.averageViews ?? null,
//             price: data.canUpdatePrice ? data.price : socialMediaAccounts[accountIndex].price,
//             publicPrice: data.canUpdatePrice ? data.publicPrice : socialMediaAccounts[accountIndex].publicPrice,
//             currency: data.canUpdatePrice ? data.currency : socialMediaAccounts[accountIndex].currency,
//             initialPrice: data.canUpdatePrice ? parseInt(String(data.initialPrice).replace(/[^\d.-]/g, '')) : socialMediaAccounts[accountIndex].initialPrice,
//             profileCategory: data.profileCategory ?? "community",
//             ...(data.profileCategory === "creator" && {
//                 creatorCategories: data.creatorCategories ?? [],
//             }),
//             isVerified: true,
//         };
//
//         influencer[data.typeOfSocialMedia] = socialMediaAccounts;
//         await influencer.save();
//
//         return {
//             code: 200,
//             message: 'Social media account updated successfully',
//         };
//     }
//
//     // TODO: UPDATE
//     async sendMailAboutChangingPrice(data: SendMailPriceChangeDto) {
//         if (!data) {
//             return {
//                 code: 400,
//                 message: 'Not enough arguments',
//             };
//         }
//
//         const influencer = await this.influencerModel.findOne({_id: data.influencerId});
//
//         if (!influencer) {
//             return {
//                 code: 404,
//                 message: 'User not found',
//             };
//         }
//
//         const socialMediaAccounts = influencer[data.typeOfSocialMedia];
//
//         if (!socialMediaAccounts || socialMediaAccounts.length === 0) {
//             return {
//                 code: 404,
//                 message: `No accounts found for type: ${data.typeOfSocialMedia}`,
//             };
//         }
//
//         const accountIndex = socialMediaAccounts.findIndex(
//             (account) => account._id.toString() === data.accountId,
//         );
//
//         if (accountIndex === -1) {
//             return {
//                 code: 404,
//                 message: 'Account not found',
//             };
//         }
//
//         const account = socialMediaAccounts[accountIndex];
//
//         let emailContent = `
//             <p>Hi,</p>
//             <p>The influencer <strong>${influencer.firstName}</strong> has requested to update the price for their ${data.typeOfSocialMedia} account <strong>${account.instagramUsername}</strong> from €${account.price} to €${data.newPrice}.</p>
// <a href="${process.env.SERVER}/profile/influencer/verify-new-social-media-price?influencerId=${data.influencerId}&socialMedia=${data.typeOfSocialMedia}&networkUsername=${encodeURIComponent(account.instagramUsername)}&isPriceGoodToGo=${true}&newPrice=${data.newPrice}">ACCEPT</a>
// <a href="${process.env.SERVER}/profile/influencer/verify-new-social-media-price?influencerId=${data.influencerId}&socialMedia=${data.typeOfSocialMedia}&networkUsername=${encodeURIComponent(account.instagramUsername)}&isPriceGoodToGo=${false}&newPrice=${data.newPrice}">DECLINE</a>
//         `;
//
//         await sendMail(
//             // "nazarkozynets030606@zohomail.eu",
//             'admin@soundinfluencers.com',
//             'soundinfluencers',
//             emailContent,
//             'html',
//         );
//
//         await sendMail(
//             influencer.email,
//             'soundinfluencers',
//             `
//                 <p>Hi ${influencer.firstName}</p>
//                 <br>
//                 <p>We've received your price change request and we will come back to you ASAP.</p>
//                 <br>
//                 <p>Thanks for your patience</p>
//                 <p>SoundInfluencers Team</p>
//             `,
//         );
//
//         return {
//             code: 200,
//             message: 'Email sent successfully',
//         };
//     }
//
//     // TODO: UPDATE
//     async changeSocialMediaPrice(
//         influencerId: string,
//         socialMedia: string,
//         networkUsername: string,
//         isPriceGoodToGo: boolean,
//         newPrice: string,
//     ) {
//         if (!influencerId || !socialMedia || !networkUsername || isPriceGoodToGo === undefined) {
//             return {
//                 code: 400,
//                 message: 'Not enough arguments',
//             };
//         }
//
//         if (isPriceGoodToGo) {
//             const influencer = await this.influencerModel.findOne({_id: influencerId});
//
//             if (!influencer) {
//                 return {
//                     code: 404,
//                     message: 'User not found',
//                 };
//             }
//
//             const socialMediaAccounts = influencer[socialMedia];
//
//             if (!socialMediaAccounts || socialMediaAccounts.length === 0) {
//                 return {
//                     code: 404,
//                     message: `No accounts found for type: ${socialMedia}`,
//                 };
//             }
//
//             const accountIndex = socialMediaAccounts.findIndex(
//                 (account) => account.instagramUsername === networkUsername,
//             );
//
//             if (accountIndex === -1) {
//                 return {
//                     code: 404,
//                     message: 'Account not found',
//                 };
//             }
//
//             socialMediaAccounts[accountIndex].price = newPrice;
//             socialMediaAccounts[accountIndex].publicPrice = (parseFloat(newPrice) * 2).toString();
//
//             influencer[socialMedia] = socialMediaAccounts;
//             await influencer.save();
//
//             return {
//                 code: 200,
//                 message: 'Social media account updated successfully',
//             };
//         } else {
//             return {
//                 code: 200,
//                 message: 'Price change request declined',
//             };
//         }
//     }
//
//     // TODO: UPDATE
//     async deleteSocialMediaAccount(data: any) {
//         try {
//             if (!data) {
//                 return {
//                     code: 400,
//                     message: 'Not enough arguments',
//                 };
//             }
//
//             const influencer = await this.influencerModel.findOne({_id: data._id});
//             if (!influencer) {
//                 return {
//                     code: 404,
//                     message: 'User not found',
//                 };
//             }
//
//             const socialMediaAccounts = influencer[data.typeOfSocialMedia];
//             if (!socialMediaAccounts || socialMediaAccounts.length === 0) {
//                 return {
//                     code: 404,
//                     message: `No accounts found for type: ${data.typeOfSocialMedia}`,
//                 };
//             }
//
//             const accountIndex = socialMediaAccounts.findIndex(
//                 (account) => account._id.toString() === data.accountId,
//             );
//
//             if (accountIndex === -1) {
//                 return {
//                     code: 404,
//                     message: 'Account not found',
//                 };
//             }
//
//             socialMediaAccounts[accountIndex].isDeleted = true;
//
//             influencer[data.typeOfSocialMedia] = socialMediaAccounts;
//             const socialMediaAccountName = socialMediaAccounts[accountIndex].instagramUsername;
//
//             await influencer.save();
//
//             const emailContent = `
//                 <p>Hi,</p>
//                 <p>The Influencer <strong>${influencer.firstName}</strong> deleted <strong>${data.typeOfSocialMedia}</strong> account <strong>${socialMediaAccountName}</strong></p>
//                 <br>
//                 ${data.deleteReason ? `<p><strong>Reason:</strong> ${data.deleteReason}</p>` : ''}
//             `;
//
//             await sendMail(
//                 // "nazarkozynets030606@zohomail.eu",
//                 'admin@soundinfluencers.com',
//                 'soundinfluencers',
//                 emailContent,
//                 'html',
//             );
//
//             return {
//                 code: 200,
//                 message: 'Social media account deleted successfully',
//             };
//         } catch (err) {
//             console.error('Error deleting social media account:', err);
//             return {
//                 code: 500,
//                 message: 'Internal server error',
//             };
//         }
//     }
//
//     // TODO: UPDATE
//     async addSocialMediaAccounts(data: AddSocialMediasDto) {
//         let errors = [];
//
//         if (!data) {
//             errors.push('Not enough arguments');
//             return {
//                 code: 400,
//                 message: 'Not enough arguments',
//                 errors,
//             };
//         }
//
//         const influencer = await this.influencerModel.findOne({_id: data.influencerId});
//
//         if (!influencer) {
//             errors.push('User not found');
//             return {
//                 code: 404,
//                 message: 'User not found',
//                 errors,
//             };
//         }
//
//         const socialNetworks = [
//             'instagram',
//             'tiktok',
//             'spotify',
//             'soundcloud',
//             'facebook',
//             'youtube',
//             'press',
//         ];
//
//         let dataToSendWithEmail = {
//             influencerId: influencer._id,
//             accounts: [],
//         };
//
//         for (const network of socialNetworks) {
//             const accounts = data[network] || [];
//             const usernames = accounts.map((item) => item.instagramUsername);
//
//             const networkFilter = {
//                 [`${network}.instagramUsername`]: {$in: usernames},
//                 isDeleted: {$ne: true},
//             };
//             const isUsernameUsed = await this.influencerModel.exists(networkFilter);
//
//             if (isUsernameUsed) {
//                 errors.push(`This ${network} username already exists`);
//                 return {
//                     code: 409,
//                     message: `This ${network} username already exists`,
//                     errors,
//                 };
//             }
//         }
//
//         const emailContent = (socialMedia, item) => {
//             if (socialMedia === 'spotify' || socialMedia === 'soundcloud') {
//                 return `
//                     <ul>
//             <li><strong>${socialMedia === 'spotify' ? 'Spotify playlist name' : 'SoundCloud account name'}: ${item.instagramUsername}</strong></li>
//             <li><strong>${socialMedia === 'spotify' ? 'Spotify playlist link' : 'SoundCloud link'}: ${item.instagramLink}</strong></li>
//             <li><strong>Followers: ${item.followersNumber.replace(/[.,]/g, '')}</strong></li>
//             <li><strong>Logo: ${item.logo}</strong></li>
//             <li><strong>Price: ${item.price}€</strong></li>
//             <li><strong>Initial Price: ${item.initialPrice}</strong></li>
// </ul>
//                 `;
//             } else if (socialMedia === 'press') {
//                 return `
//                     <ul>
//             <li><strong>Brand account name: ${item.instagramUsername}</strong></li>
//             <li><strong>Website link: ${item.instagramLink}</strong></li>
//             <li><strong>Website link: ${item.followersNumber.replace(/[.,]/g, '')}</strong></li>
//             <li><strong>Logo: ${item.logo}</strong></li>
//             <li><strong>Music Genres: ${formatGenres(item).join(', ')}</strong></li>
//             <li><strong>Price: ${item.price}€</strong></li>
//             <li><strong>Initial Price: ${item.initialPrice}</strong></li>
//             `;
//             } else {
//                 return `
//                     <ul>
//             <li><strong>Username: ${item.instagramUsername}</strong></li>
//             <li><strong>Link: ${item.instagramLink}</strong></li>
//             <li><strong>Followers: ${item.followersNumber}</strong></li>
//             <li><strong>Logo: ${item.logo}</strong></li>
//             <li><strong>Music Styles: ${formatGenres(item).join(', ')}</strong></li>
//             <li><strong>Price: ${item.price}€</strong></li>
//             <li><strong>Initial Price: ${item.initialPrice}</strong></li>
// </ul>
//                 `;
//             }
//         };
//         const formatGenres = (item) => {
//             const genresSet = new Set<string>();
//             if (item.musicStyle || item.musicSubStyles || item.musicStyleOther) {
//                 if (item.musicSubStyles?.length > 0) {
//                     for (const subStyle of item.musicSubStyles) {
//                         if (subStyle === 'Melodic, Minimal') {
//                             genresSet.add('Techno (Melodic, Minimal)');
//                         }
//                         if (subStyle === 'Hard, Peak') {
//                             genresSet.add('Techno (Hard, Peak)');
//                         }
//                         if (subStyle === 'Tech House') {
//                             genresSet.add('House (Tech House)');
//                         }
//                         if (subStyle === 'Melodic, Afro') {
//                             genresSet.add('House (Melodic, Afro)');
//                         }
//                     }
//                 } else if (item.musicStyle) {
//                     genresSet.add(item.musicStyle);
//                 }
//
//                 if (item.musicStyleOther?.length > 0) {
//                     for (const otherStyle of item.musicStyleOther) {
//                         if (otherStyle !== 'House') {
//                             genresSet.add(otherStyle);
//                         }
//                     }
//                 }
//             }
//             return Array.from(genresSet);
//         };
//
//         for (const network of socialNetworks) {
//             const accounts = data[network] || [];
//             const socialMediaAccounts = influencer[network] || [];
//
//             try {
//                 for (const account of accounts) {
//                     const sanitizedPrice = parseFloat(String(account.price).replace(/[^\d.-]/g, '')) || 0;
//                     const sanitizedInitialPrice = parseInt(String(account.initialPrice).replace(/[^\d.-]/g, '')) || 0
//
//                     const publicPrice = (sanitizedPrice * 2).toString();
//                     const accountId = new mongoose.Types.ObjectId();
//                     socialMediaAccounts.push({
//                         ...account,
//                         ...(account.profileCategory === "creator" && {
//                             creatorCategories: account.creatorCategories ?? [],
//                         }),
//                         followersNumber: account.followersNumber.replace(/[.,]/g, ''),
//                         engagementRate: ['instagram', 'tiktok'].includes(network) ? 0 : null,
//                         averageViews: ['instagram', 'tiktok'].includes(network) ? 0 : null,
//                         publicPrice: publicPrice,
//                         currency: account.currency,
//                         initialPrice: sanitizedInitialPrice,
//                         isHidden: false,
//                         isDeleted: false,
//                         isVerified: false,
//                         _id: accountId,
//                     });
//
//                     influencer[network] = socialMediaAccounts;
//
//                     dataToSendWithEmail.accounts.push(accountId);
//                 }
//             } catch (err) {
//                 console.error('Error adding social media account:', err);
//                 errors.push(`Error adding ${network} account. ${err}`);
//             }
//         }
//
//         try {
//             await sendMail(
//                 // "nazarkozynets030606@zohomail.eu",
//                 'admin@soundinfluencers.com',
//                 'soundinfluencers',
//                 `<p>Request from ${influencer.firstName} (${influencer.email}) to add a new Brand</p>
//             <b>Details:</b><br/>
//             ${socialNetworks
//                     .map((network) =>
//                         data[network]
//                             ?.map(
//                                 (item, index) => `
//                 <p><strong>Network: ${network} (${index + 1} account)</strong></p>
//
//                 ${emailContent(network, item)}
//             `,
//                             )
//                             .join(''),
//                     )
//                     .join('')}
//
//             <h2>Do you want to verify these accounts?</h2>
// <a href="${process.env.SERVER}/profile/influencer/verify-new-brand?influencerId=${dataToSendWithEmail.influencerId}&accounts=${encodeURIComponent(JSON.stringify(dataToSendWithEmail.accounts))}&isVerified=${true}">ACCEPT</a>
//         <a href="${process.env.SERVER}/profile/influencer/verify-new-brand?influencerId=${dataToSendWithEmail.influencerId}&accounts=${encodeURIComponent(JSON.stringify(dataToSendWithEmail.accounts))}&isVerified=${false}">DECLINE</a>
// `,
//                 'html',
//             );
//         } catch (err) {
//             console.error('Error sending email:', err);
//             errors.push(`Error sending email. ${err}`);
//         }
//
//         if (errors.length > 0) {
//             return {
//                 code: 500,
//                 message: 'Internal server error',
//                 errors,
//             };
//         } else {
//             await influencer.save();
//             return {
//                 code: 200,
//                 message: 'Social media account added successfully',
//             };
//         }
//     }

    // TODO: UPDATE
    async verifyNewSocialMediaAccounts(
        influencerId: string,
        accountIds: string[],
        isVerified: boolean,
    ) {
        if (!influencerId || !accountIds || accountIds.length === 0 || isVerified === undefined) {
            return {
                code: 400,
                message: 'Not enough arguments',
            };
        }

        const influencer = await this.influencerRepo.findOne({_id: influencerId});

        if (!influencer) {
            return {
                code: 404,
                message: 'User not found',
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

        let updatedAccounts = [];

        try {
            socialNetworks.forEach((network) => {
                const accounts = influencer[network] || [];

                accounts.forEach((account) => {
                    if (accountIds.includes(account._id.toString())) {
                        account.isVerified = isVerified;
                        updatedAccounts.push({
                            network,
                            account,
                        });
                    }
                });
            });

            await influencer.save();

            this.webSocketService.server.emit('brands approved', {
                influencerId,
                updatedAccounts,
                isVerified,
            });

            return {
                code: 200,
                message: 'Social media account(s) updated successfully',
            };
        } catch (err) {
            console.error('Error verifying social media accounts:', err);
            return {
                code: 500,
                message: 'Internal server error',
                errors: [err.message],
            };
        }
    }

    // Moves social account obj to new owner obj
    async moveSocialAccount(
        data: MigrateAccountDto,
        session: ClientSession,
    ): Promise<SocialAccountMigrationContext> {
        const {influencerId, socialAccountToMigrateId, socialMediaOfAccount} = data;

        if (!influencerId || !socialAccountToMigrateId || !socialMediaOfAccount) {
            throw new BadRequestException('Not enough arguments');
        }

        const socialAccountObjectId = new Types.ObjectId(socialAccountToMigrateId);

        // Find target influencer
        const targetInfluencer = await this.influencerRepo.findOne({_id: new Types.ObjectId(influencerId)}, {session});
        if (!targetInfluencer) {
            throw new NotFoundException(`Influencer with id ${influencerId} not found`);
        }

        // Find influencer with target social account
        const sourceInfluencer: Influencer = await this.influencerRepo.findBySocialAccount(socialMediaOfAccount, socialAccountObjectId);
        if (!sourceInfluencer) {
            throw new NotFoundException('Social account not found');
        }

        if (sourceInfluencer._id.toString() === targetInfluencer._id.toString()) {
            throw new BadRequestException('Cannot migrate social account to the same influencer');
        }

        // Get target social account
        const socialAccount = sourceInfluencer[socialMediaOfAccount].find(acc =>
            acc._id.equals(socialAccountObjectId),
        );
        if (!socialAccount) {
            throw new NotFoundException('Social account not found');
        }

        // Delete social account from old owner
        await this.influencerRepo.pullSocialAccount(
            sourceInfluencer._id,
            socialMediaOfAccount,
            socialAccountObjectId,
            {session},
        );

        const alreadyExists = targetInfluencer[socialMediaOfAccount].some(acc =>
            acc._id === socialAccountObjectId,
        );
        if (alreadyExists) {
            throw new ConflictException('Social account already exists on target influencer');
        }

        // Adding social account to new owner
        await this.influencerRepo.pushSocialAccount(
            targetInfluencer._id,
            socialMediaOfAccount,
            socialAccount,
            {session},
        );

        return {
            socialAccountId: socialAccountObjectId,
            socialMedia: socialMediaOfAccount,
            socialAccountUsername: socialAccount.username ?? socialAccount.instagramUsername,
            socialAccount: socialAccount,
            sourceInfluencerId: sourceInfluencer._id,
            targetInfluencerId: targetInfluencer._id,
            targetInfluencerEmail: targetInfluencer.email
        };
    }

    // // TODO: UPDATE
    // async getInfluencersWithSocialMedia(socialMedia: string) {
    //     try {
    //         const getInfluencersAll = await this.influencerRepo.findMany(
    //             {statusVerify: 'accept'},
    //             {
    //                 lean: true,
    //                 select: ['-password', '-balance', '-phone', '-email'],
    //             }
    //         );
    //
    //         const influencersList = getInfluencersAll.map((item) => {
    //             const socialMediaAccounts = item[socialMedia];
    //
    //             if (Array.isArray(socialMediaAccounts)) {
    //                 return socialMediaAccounts
    //                     .filter(
    //                         (account) =>
    //                             account.isHidden !== true &&
    //                             account.isDeleted !== true &&
    //                             account.isVerified === true,
    //                     )
    //                     .map((account) => ({
    //                         ...account,
    //                         _id: item._id,
    //                     }));
    //             }
    //
    //             return [];
    //         });
    //
    //         return {
    //             code: 200,
    //             influencers: influencersList.flat(),
    //         };
    //     } catch (err) {
    //         console.log(err);
    //         return {
    //             code: 500,
    //             message: err.message || 'An error occurred while fetching influencers.',
    //         };
    //     }
    // }
    //
    // // TODO: UPDATE
    // async getInfluencersWithoutSocialMedia() {
    //     try {
    //         const influencers = await this.influencerRepo
    //             .findMany({statusVerify: 'accept'}, {
    //                 lean: true,
    //                 select: ['-password', '-balance', '-phone', '-email'],
    //             });
    //
    //         const allAccounts = influencers.map((influencer) => {
    //             const socialMediaKeys = [
    //                 'instagram',
    //                 'tiktok',
    //                 'spotify',
    //                 'soundcloud',
    //                 'facebook',
    //                 'youtube',
    //                 'press',
    //             ];
    //
    //             const accounts = socialMediaKeys.flatMap((socialMedia) => {
    //                 const socialMediaAccounts = influencer[socialMedia];
    //                 if (Array.isArray(socialMediaAccounts)) {
    //                     return socialMediaAccounts
    //                         .filter((account) => account.isHidden !== true)
    //                         .map((account) => ({
    //                             ...account,
    //                             socialMedia,
    //                             _id: influencer._id,
    //                             firstName: influencer.firstName,
    //                         }));
    //                 }
    //                 return [];
    //             });
    //
    //             return accounts;
    //         });
    //
    //         return {
    //             code: 200,
    //             influencers: allAccounts.flat(),
    //         };
    //     } catch (err) {
    //         console.error(err);
    //         return {
    //             code: 500,
    //             message: err.message || 'An error occurred while fetching all influencer accounts.',
    //         };
    //     }
    // }
    //
    // // TODO: UPDATE
    // async getClients() {
    //     try {
    //         const getClientsAll = await this.clientRepo
    //             .findMany({statusVerify: 'accept'}, {
    //                 lean: true,
    //                 select: ['-password']
    //             });
    //
    //         return {
    //             code: 200,
    //             clients: getClientsAll,
    //         };
    //     } catch (err) {
    //         console.log(err);
    //         return {
    //             code: 500,
    //             message: err,
    //         };
    //     }
    // }
    //
    // // TODO: UPDATE
    // async getInfluencerById(id: string) {
    //     try {
    //         const getInfluencer = await this.influencerRepo.findOne({_id: new mongoose.Types.ObjectId(id)})
    //
    //         return {
    //             code: 200,
    //             influencer: getInfluencer,
    //         };
    //     } catch (err) {
    //         console.log(err);
    //         return {
    //             code: 500,
    //             message: err,
    //         };
    //     }
    // }
    //
    // // TODO: UPDATE
    // async getOneSocialNetworkAccount(
    //     influencerId: string,
    //     socialMedia: string,
    //     networkUsername: string,
    // ) {
    //     if (!influencerId || !socialMedia || !networkUsername) {
    //         return {
    //             code: 400,
    //             message: 'Not enough arguments',
    //         };
    //     }
    //
    //     const influencer = await this.influencerRepo.findOne({
    //         _id: new mongoose.Types.ObjectId(influencerId),
    //     });
    //     if (!influencer) {
    //         return {
    //             code: 404,
    //             message: 'Influencer not found',
    //         };
    //     }
    //
    //     const socialMediaAccounts = influencer[socialMedia];
    //
    //     if (!socialMediaAccounts) {
    //         return {
    //             code: 404,
    //             message: 'Social media not found',
    //         };
    //     }
    //
    //     const account = socialMediaAccounts.find((item) => item.instagramUsername === networkUsername);
    //
    //     if (!account) {
    //         return {
    //             code: 404,
    //             message: 'Account not found',
    //         };
    //     }
    //
    //     return {
    //         code: 200,
    //         account,
    //     };
    // }
    //
    // // TODO: UPDATE
    // async getClientById(id: string) {
    //     try {
    //         const objectId = new Types.ObjectId(id);
    //
    //         const getClient = await this.clientRepo.findOne({_id: objectId});
    //
    //         return {
    //             code: 200,
    //             client: getClient,
    //         };
    //     } catch (err) {
    //         console.log(err);
    //         return {
    //             code: 500,
    //             message: err,
    //         };
    //     }
    // }
}
