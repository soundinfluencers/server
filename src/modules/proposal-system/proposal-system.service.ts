import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException
} from '@nestjs/common';
import {Types} from 'mongoose';
import {ProposalCampaignRepository} from "../../database/repositories/campaigns/proposal-campaign.repository";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {AdminRepository} from "../../database/repositories/users/admin.repository";
import {CreateCampaignDto, SelectInfluencerDto} from "../campaigns/dto/create-campaign.dto";
import {UserPayload} from "../../common/types/auth.types";
import {ProposalCampaign} from "../../database/schemas/campaign/proposal-campaign.schema";
import {CampaignContentItem} from "../../database/schemas/campaign/campaign.schema";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../../common/types/influencer/promo.types";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {getArrayFromAccountMusicGenres} from "../../common/utils/genres";
import {
    BaseProposalCampaignOptionDto,
    CreatedProposalCampaignIdDto,
    ProposalCampaignWithOptionDto,
    GetProposalCampaignDto
} from "./dto/proposal-campaigns.dto";
import {
    ProposalCampaignOptionRepository
} from "../../database/repositories/campaigns/proposal-campaign-option.repository";
import {
    ProposalCampaignAccount,
    ProposalCampaignOption
} from "../../database/schemas/campaign/proposal-campaign-option.schema";
import {mapContentItemDtoToModel, mapToSafeCampaignAccount} from "../../common/mappers/campaign.mapper";
import {uniq} from "../../common/utils/base.util";
import {ObjId, toObjIdSafe} from "../../common/types/base.types";

// -------------- PRIVATE TYPES -----------------

type MinimalInfluencer = {
    _id: ObjId;
    instagram?: any[];
    tiktok?: any[];
    spotify?: any[];
    soundcloud?: any[];
    facebook?: any[];
    youtube?: any[];
    press?: any[];
};
type AccountKey = `${SocialMediaEnum}:${string}`; // sm:accountIdString
type UsernameKey = `${SocialMediaEnum}:${string}`; // sm:username


@Injectable()
export class ProposalSystemService {
    private readonly logger = new Logger();

    constructor(
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
        private readonly adminRepo: AdminRepository,
        private readonly proposalCampaignRepo: ProposalCampaignRepository,
        private readonly proposalCampaignOptionRepo: ProposalCampaignOptionRepository,
    ) {
    }


    // -------------- HELPERS -----------------


    // builds object with ProposalCampaignAccount type from SelectInfluencerDto (dto which using for creating and updating campaigns)
    private async buildProposalCampaignAccountsBatch(
        addedAccountsData: SelectInfluencerDto[],
    ): Promise<{ accounts: ProposalCampaignAccount[], privateCampaignPrice: number }> {
        if (!addedAccountsData?.length) return {accounts: [], privateCampaignPrice: 0};

        // 1) get only using social medias
        const usedSocialMedia = uniq(
            addedAccountsData.map(a => a.socialMedia).filter(Boolean)
        );

        // 2) get keys
        const influencerIdStrs = uniq(
            addedAccountsData.map(a => a.influencerId).filter(Boolean)
        );

        const influencerIds = influencerIdStrs
            .map(toObjIdSafe)
            .filter((x): x is ObjId => Boolean(x));

        const socialAccountIdStrs = uniq(
            addedAccountsData.map(a => a.socialAccountId).filter(Boolean)
        );
        const socialAccountIds = socialAccountIdStrs
            .map(toObjIdSafe)
            .filter((x): x is ObjId => Boolean(x));

        // usernames as fallback
        const usernamesByMedia = new Map<SocialMediaEnum, string[]>();
        for (const a of addedAccountsData) {
            if (!a.username) continue;
            const arr = usernamesByMedia.get(a.socialMedia) ?? [];
            arr.push(a.username);
            usernamesByMedia.set(a.socialMedia, arr);
        }
        for (const [sm, arr] of usernamesByMedia) {
            usernamesByMedia.set(sm, uniq(arr));
        }

        // 3) Projection: get only asked social medias + ids
        const projection: Record<string, 1> = {_id: 1};
        for (const sm of usedSocialMedia) projection[sm] = 1;

        // 4) Request №1: by influencerIds
        const influencers: MinimalInfluencer[] = influencerIds.length
            ? await this.influencerRepo.findMany(
                {_id: {$in: influencerIds}},
                {lean: true, select: Object.keys(projection)} as any,
            )
            : [];

        // 5) For elements without influencerId — request by accountId/username
        const hasMissingInfluencerId = addedAccountsData.some(a => !a.influencerId);
        if (hasMissingInfluencerId) {
            const or: any[] = [];

            if (socialAccountIds.length) {
                for (const sm of usedSocialMedia) {
                    or.push({[`${sm}._id`]: {$in: socialAccountIds}});
                }
            }

            for (const [sm, names] of usernamesByMedia) {
                if (names.length) or.push({[`${sm}.username`]: {$in: names}});
            }

            if (or.length) {
                const extra: MinimalInfluencer[] = await this.influencerRepo.findMany(
                    {$or: or},
                    {lean: true, select: Object.keys(projection)} as any,
                );

                // merge unique by influencer _id
                const seen = new Set(influencers.map(i => i._id.toString()));
                for (const inf of extra) {
                    const id = inf._id.toString();
                    if (!seen.has(id)) {
                        influencers.push(inf);
                        seen.add(id);
                    }
                }
            }
        }

        if (!influencers.length) return {accounts: [], privateCampaignPrice: 0};

        // 6) Indexes in memory for O(1) matching
        const byInfluencerId = new Map<string, MinimalInfluencer>();
        const byAccountId = new Map<AccountKey, { influencerId: ObjId; acc: any }>();
        const byUsername = new Map<UsernameKey, { influencerId: ObjId; acc: any }>();

        for (const inf of influencers) {
            byInfluencerId.set(inf._id.toString(), inf);

            for (const sm of usedSocialMedia) {
                const arr = (inf as any)[sm] as any[] | undefined;
                if (!Array.isArray(arr) || !arr.length) continue;

                for (const acc of arr) {
                    if (!acc?._id) continue;

                    const accIdStr = acc._id.toString();
                    byAccountId.set(`${sm}:${accIdStr}`, {influencerId: inf._id, acc});

                    const u = acc.username;
                    if (u) byUsername.set(`${sm}:${u}`, {influencerId: inf._id, acc});
                }
            }
        }

        const result: ProposalCampaignAccount[] = [];
        let privateCampaignPrice: number = 0;

        // 7) Building CampaignAccount for each DTO item
        const invalid: Array<{ index: number; reason: string }> = [];

        for (let idx = 0; idx < addedAccountsData.length; idx++) {
            const dto = addedAccountsData[idx];

            const dtoInfluencerId = toObjIdSafe(dto.influencerId);
            const dtoAccountId = toObjIdSafe(dto.socialAccountId);
            const dtoUsername = dto.username;

            let matched: { influencerId: ObjId; acc: any } | null = null;

            if (dtoAccountId) {
                matched = byAccountId.get(`${dto.socialMedia}:${dtoAccountId.toString()}`) ?? null;
            } else if (dtoUsername) {
                matched = byUsername.get(`${dto.socialMedia}:${dtoUsername}`) ?? null;
            }

            if (!matched) {
                invalid.push({index: idx, reason: "Account not found for provided identifiers"});
                continue;
            }

            if (dtoInfluencerId && matched.influencerId.toString() !== dtoInfluencerId.toString()) {
                invalid.push({index: idx, reason: "InfluencerId does not match the resolved account"});
                continue;
            }

            const acc = matched.acc;

            // meta validation
            if (!acc.isVerified) {
                invalid.push({index: idx, reason: "Account is not verified"});
                continue;
            }
            if (acc.isDeleted) {
                invalid.push({index: idx, reason: "Account is deleted"});
                continue;
            }
            if (acc.isHidden) {
                invalid.push({index: idx, reason: "Account is hidden"});
                continue;
            }

            // price validation
            if (typeof acc.price !== "number" || acc.price < 0 || typeof acc.publicPrice !== "number" || acc.publicPrice < 0) {
                invalid.push({index: idx, reason: "Invalid price/publicPrice"});
                continue;
            }

            // selectedContent validation
            if (!dto.selectedCampaignContentItem?.campaignContentItemId) {
                invalid.push({index: idx, reason: "selectedCampaignContentItem.campaignContentItemId is required"});
                continue;
            }

            privateCampaignPrice += acc.price;

            result.push({
                ...dto,
                _id: new Types.ObjectId(),
                username: acc.username,
                influencerId: matched.influencerId,
                accountId: acc._id,
                followers: acc.followers,
                price: acc.price,
                publicPrice: acc.publicPrice,
                selectedContent: {
                    campaignContentItemId: new Types.ObjectId(dto.selectedCampaignContentItem.campaignContentItemId),
                    descriptionId: dto.selectedCampaignContentItem.descriptionId
                        ? new Types.ObjectId(dto.selectedCampaignContentItem.descriptionId)
                        : undefined,
                },
                confirmation: InfluencerConfirmationStatusEnum.wait,
                closePromo: InfluencerPromoClosedStatusEnum.wait,
                dateRequest: dto.dateRequest ?? null,
                genres: acc.musicGenres ? getArrayFromAccountMusicGenres(acc.musicGenres) : undefined,
                countries: acc.countries ?? undefined,
            } satisfies ProposalCampaignAccount);
        }

        // if (invalid.length) {
        //     throw new BadRequestException({
        //         message: "Some addedAccounts items are invalid",
        //         invalid,
        //     });
        // }

        return {accounts: result, privateCampaignPrice: privateCampaignPrice};
    }


    // -------------- SERVICES -----------------


    // Create new proposal campaign
    async createProposalCampaign(
        data: CreateCampaignDto,
        creatorInfo: UserPayload,
        existingCampaignId?: string,
    ): Promise<CreatedProposalCampaignIdDto> {
        const {_id, role} = creatorInfo;

        if (!_id || !role) throw new BadRequestException("Not enough arguments");

        // check if creator exists
        switch (role) {
            case 'admin': {
                const exists = await this.adminRepo.findById(_id);
                if (!exists) throw new NotFoundException('Admin not found');
                break;
            }
            case 'client': {
                const exists = await this.clientRepo.exists({
                    _id: new ObjId(_id),
                    isProposalClient: true
                });

                if (!exists) throw new NotFoundException('Client not found');
                break;
            }
            default:
                throw new ForbiddenException('Not enough access');
        }

        const processedAccounts: {
            accounts: ProposalCampaignAccount[],
            privateCampaignPrice: number
        } = await this.buildProposalCampaignAccountsBatch(data.addedAccounts);

        if (processedAccounts?.accounts?.length === 0) {
            throw new BadRequestException('No valid influencers provided');
        }

        const processedCampaignContent: CampaignContentItem[] = data.campaignContent.map(
            (campaignContentItem) => mapContentItemDtoToModel(campaignContentItem)
        );

        if (processedCampaignContent.length === 0) throw new BadRequestException('No valid campaign content provided')

        const session = await this.proposalCampaignRepo.startSession();
        session.startTransaction();

        try {
            const campaignId = existingCampaignId ? new ObjId(existingCampaignId) : new ObjId();
            const campaignOptionId = new ObjId();

            // building campaign with ProposalCampaign type
            await this.proposalCampaignRepo.findOneAndUpdate(
                { _id: campaignId },
                {
                    $setOnInsert: {
                        _id: campaignId,
                        schemaVersion: 2,
                        creatorId: new ObjId(_id),
                        creatorRole: role,
                        socialMedia: data.socialMedia,
                        campaignName: data.campaignName.trim(),
                    },
                    $push: { optionsIds: campaignOptionId },
                },
                {
                    upsert: true,
                    session,
                    new: true,
                }
            );

            // building campaign option with ProposalCampaignOption type
            const proposalCampaignOptionDto: ProposalCampaignOption = {
                _id: campaignOptionId,
                creatorId: new ObjId(_id),
                creatorRole: role,
                proposalCampaignId: campaignId,
                schemaVersion: 1,
                publicCampaignPrice: data.campaignPrice,
                privateCampaignPrice: processedAccounts.privateCampaignPrice ?? data.campaignPrice,
                addedAccounts: processedAccounts.accounts,
                campaignContent: processedCampaignContent,
            }

            await this.proposalCampaignOptionRepo.create<ProposalCampaignOption>(proposalCampaignOptionDto, {session});

            await session.commitTransaction();

            return {campaignId: campaignId.toString()};
        } catch (err) {
            await session.abortTransaction();
            this.logger.error("Error creating new proposal campaign", err);
            throw new InternalServerErrorException('Error creating proposal campaign');
        } finally {
            await session.endSession();
        }
    }

    // Update proposal campaign
    // async updateProposalCampaign(data: UpdateProposalCampaignDto) {
    //     if (!data.campaignName) throw new BadRequestException("Not enough arguments");
    //
    //     let proposalCampaign = await this.proposalCampaignRepo.findOne({
    //         _id: new Types.ObjectId(data.campaignId),
    //     });
    //
    //     if (!proposalCampaign) {
    //         throw new NotFoundException('Campaign not found');
    //     } else {
    //         await this.proposalCampaignRepo.updateOne(
    //             {
    //                 _id: new Types.ObjectId(data.campaignId),
    //             },
    //             {
    //                 clientId: data.clientId
    //                     ? new Types.ObjectId(data.clientId)
    //                     : new Types.ObjectId('66f540faaf4e960d2f9bebfc'),
    //                 campaignName: data.campaignName.trim(),
    //                 addedAccounts: data.addedAccounts.map(account => ({
    //                     ...account,
    //                     selectedContent: {
    //                         campaignContentItemId: new Types.ObjectId(account.selectedContent.campaignContentItemId),
    //                         postDescriptionId: new Types.ObjectId(account.selectedContent.postDescriptionId)
    //                     }
    //                 })),
    //                 campaignContent: data.campaignContent,
    //                 price: data.price,
    //                 publicPrice: data.publicPrice,
    //                 totalFollowers: data.totalFollowers,
    //                 socialMedia: data.socialMedia,
    //                 hiddenColumns: data.hiddenColumns,
    //             },
    //         );
    //     }
    // }

    // Returns proposal campaign option
    async getProposalCampaignOption(data: GetProposalCampaignDto): Promise<BaseProposalCampaignOptionDto> {
        const {campaignId} = data;
        const optionIndex = data.optionIndex ?? 0;

        if (!campaignId) throw new BadRequestException("Invalid campaign id");

        const proposalCampaignOption = await this.proposalCampaignOptionRepo.findOneByIndex({
            campaignId: new Types.ObjectId(campaignId),
            optionIndex: optionIndex
        }, {lean: true});

        if (!proposalCampaignOption) throw new NotFoundException("Selected proposal campaign option not found");

        try {
            return {
                optionIndex: optionIndex,
                price: proposalCampaignOption.publicCampaignPrice,
                addedAccounts: proposalCampaignOption.addedAccounts.map((account) => mapToSafeCampaignAccount(account)),
                campaignContent: proposalCampaignOption.campaignContent
            }
        } catch (err) {
            this.logger.error('Proposal campaign option found but formatting failed', err);
            throw new InternalServerErrorException('Proposal campaign option found but formatting failed');
        }
    }

    // Returns one proposal campaign (with 1 selected option)
    async getProposalCampaign(data: GetProposalCampaignDto): Promise<ProposalCampaignWithOptionDto> {
        const {userId, userRole, campaignId} = data;

        if (!campaignId) throw new BadRequestException("Invalid campaign id");

        let proposalCampaign: ProposalCampaign = await this.proposalCampaignRepo.findAccessibleById({
            campaignId: new Types.ObjectId(campaignId),
            userId: new Types.ObjectId(userId),
            userRole: userRole
        })

        if (!proposalCampaign) throw new NotFoundException('Proposal campaign not found');

        const proposalCampaignOption = await this.getProposalCampaignOption(data);

        if (!proposalCampaignOption) throw new InternalServerErrorException("Can't get selected proposal campaign option");

        return {
            campaignId: campaignId,
            campaignName: proposalCampaign.campaignName,
            socialMedia: proposalCampaign.socialMedia as SocialMediaEnum,
            existingOptions: proposalCampaign.optionsIds.map((option: Types.ObjectId, index: number) => index),
            selectedOption: proposalCampaignOption,
        };
    }
}
