import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException
} from '@nestjs/common';
import {Types} from 'mongoose';
import {ProposalCampaignRepository} from "../../database/repositories/campaigns/proposal-campaign.repository";
import {CampaignContentItemDto, CreateCampaignDto, SelectInfluencerDto} from "../campaigns/dto/create-campaign.dto";
import {AccountVerifiedStatus, ClientPayload, Role, UserPayload} from "../../common/types/user.types";
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
    GetProposalCampaignDto,
    ProposalCampaignWithOptionDto
} from "./dto/proposal-campaigns.dto";
import {
    ProposalCampaignOptionRepository
} from "../../database/repositories/campaigns/proposal-campaign-option.repository";
import {
    ProposalCampaignAccount,
    ProposalCampaignOption
} from "../../database/schemas/campaign/proposal-campaign-option.schema";
import {
    mapContentItemDtoToModel,
    mapToIProposalCampaign,
    mapToIProposalOption
} from "../../common/mappers/campaign.mapper";
import {uniq} from "../../common/utils/base.util";
import {ObjId, toObjIdSafe} from "../../common/types/base.types";
import {UpdateCampaignDto} from "../campaigns/dto/update-campaign.dto";
import {MediaService} from "../media/media.service";
import {
    ICampaignAccount,
    ICampaignContent,
    IProposalCampaign,
    IProposalOption
} from "../../common/types/client/campaign.types";
import {CampaignAccountDto, DetailedCampaignContentItemDto} from "../campaigns/dto/get-campaigns.dto";

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
        private readonly influencerRepo: InfluencerRepository,
        private readonly proposalCampaignRepo: ProposalCampaignRepository,
        private readonly proposalCampaignOptionRepo: ProposalCampaignOptionRepository,
        private readonly mediaService: MediaService,
    ) {
    }


    // -------------- HELPERS -----------------

    // builds object with ProposalCampaignAccount type from SelectInfluencerDto (dto which using for creating and updating campaigns)
    private async buildProposalCampaignAccountsBatch(
        addedAccountsData: SelectInfluencerDto[],
    ): Promise<{ accounts: ProposalCampaignAccount[], publicCampaignPrice: number, privateCampaignPrice: number }> {
        if (!addedAccountsData?.length) return {accounts: [], publicCampaignPrice: 0, privateCampaignPrice: 0};

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

        if (!influencers.length) return {accounts: [], publicCampaignPrice: 0, privateCampaignPrice: 0};

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
        let publicCampaignPrice: number = 0;
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
            if (acc.verifiedStatus !== AccountVerifiedStatus.accept) {
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

            publicCampaignPrice += acc.publicPrice;
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

        return {accounts: result, publicCampaignPrice: publicCampaignPrice, privateCampaignPrice: privateCampaignPrice};
    }

    private checkCanEdit(userInfo: UserPayload) {
        if (userInfo?.role === Role.admin) return true;
        return userInfo?.role === Role.client && (userInfo as ClientPayload)?.isProposalClient === true;
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

        const processedAccounts: {
            accounts: ProposalCampaignAccount[],
            publicCampaignPrice: number,
            privateCampaignPrice: number
        } = await this.buildProposalCampaignAccountsBatch(data.addedAccounts);

        if (processedAccounts?.accounts?.length === 0) {
            throw new BadRequestException('No valid influencers provided');
        }

        const processedCampaignContent: CampaignContentItem[] = data.campaignContent.map(
            (campaignContentItem) => mapContentItemDtoToModel(campaignContentItem)
        );

        if (processedCampaignContent.length === 0) throw new BadRequestException('No valid campaign content provided')

        const campaignContentWithCache = await this.mediaService.applyMediaCacheForCreate(processedCampaignContent);

        const session = await this.proposalCampaignRepo.startSession();
        session.startTransaction();

        try {
            const campaignId = existingCampaignId ? new ObjId(existingCampaignId) : new ObjId();
            const campaignOptionId = new ObjId();

            // building campaign with ProposalCampaign type
            await this.proposalCampaignRepo.findOneAndUpdate(
                {_id: campaignId},
                {
                    $setOnInsert: {
                        _id: campaignId,
                        schemaVersion: 2,
                        creatorId: new ObjId(_id),
                        creatorRole: role,
                        socialMedia: data.socialMedia,
                        campaignName: data.campaignName.trim(),
                    },
                    $push: {optionsIds: campaignOptionId},
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
                publicCampaignPrice: data.campaignPrice ?? processedAccounts.publicCampaignPrice,
                privateCampaignPrice: processedAccounts.privateCampaignPrice ?? data.campaignPrice,
                addedAccounts: processedAccounts.accounts,
                campaignContent: campaignContentWithCache,
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

    // Updates proposal campaign option
    async updateProposalCampaignOption(data: UpdateCampaignDto, userInfo: UserPayload): Promise<ProposalCampaignWithOptionDto> {
        const {campaignId, optionIndex = 0} = data;

        const proposalCampaign = await this.proposalCampaignRepo.findById(campaignId);

        if (!proposalCampaign) {
            throw new NotFoundException('Proposal campaign not found');
        }

        const optionId: ObjId = proposalCampaign?.optionsIds[optionIndex];

        if (!optionId) {
            throw new BadRequestException('Unexisting option');
        }

        const campaignOption = await this.proposalCampaignOptionRepo.findOne({_id: optionId});

        if (!campaignOption) {
            throw new NotFoundException('Option not found');
        }

        // Updating addedAccounts
        if (data.addedAccounts) {
            // 1. Existing accounts Map <accountId, ProposalCampaignAccount>
            const existingAccountsMap = new Map<string, ProposalCampaignAccount>();
            for (const acc of campaignOption.addedAccounts) {
                existingAccountsMap.set(acc.accountId.toString(), acc);
            }

            const updatedAccounts: ProposalCampaignAccount[] = [];
            const newAccountsDto: SelectInfluencerDto[] = [];

            let newCampaignPrices = {
                publicCampaignPrice: 0,
                privateCampaignPrice: 0
            }

            // 2. Updating existing accounts and collecting new
            for (const accDto of data.addedAccounts) {
                const existingAcc: ProposalCampaignAccount = existingAccountsMap.get(accDto.socialAccountId);
                if (existingAcc) {
                    existingAcc.socialMedia = accDto.socialMedia;
                    existingAcc.username = accDto.username;
                    existingAcc.selectedContent.campaignContentItemId = new ObjId(accDto.selectedCampaignContentItem.campaignContentItemId);
                    existingAcc.selectedContent.descriptionId = new ObjId(accDto.selectedCampaignContentItem.descriptionId);
                    existingAcc.dateRequest = accDto.dateRequest;

                    newCampaignPrices.publicCampaignPrice += existingAcc.publicPrice;
                    newCampaignPrices.privateCampaignPrice += existingAcc.price;

                    updatedAccounts.push(existingAcc);
                } else {
                    newAccountsDto.push(accDto);
                }
            }

            // 3. Building new CampaignAccount objects from new SelectInfluencerDto accounts
            if (newAccountsDto.length > 0) {
                const newAccounts = await this.buildProposalCampaignAccountsBatch(newAccountsDto);
                if (newAccounts?.accounts?.length > 0) {
                    updatedAccounts.push(...newAccounts.accounts);

                    newCampaignPrices.publicCampaignPrice += newAccounts.publicCampaignPrice;
                    newCampaignPrices.privateCampaignPrice += newAccounts.privateCampaignPrice;
                } else {
                    this.logger.warn("Can't proceed new accounts while updating campaign");
                }
            }

            // 4. Saving all accounts
            campaignOption.addedAccounts = updatedAccounts;
            campaignOption.publicCampaignPrice = newCampaignPrices.publicCampaignPrice;
            campaignOption.privateCampaignPrice = newCampaignPrices.privateCampaignPrice;
        }

        // Updating campaign content
        if (data.campaignContent) {
            campaignOption.campaignContent = data.campaignContent.map((itemDto: CampaignContentItemDto): CampaignContentItem => mapContentItemDtoToModel(itemDto));
            campaignOption.campaignContent = await this.mediaService.applyMediaCacheForCreate(campaignOption.campaignContent);
        }

        await campaignOption.save();

        try {
            // Map to read model main campaign information and then adding selected option
            const readModelCampaign: IProposalCampaign = mapToIProposalCampaign(proposalCampaign);
            const readModelOption: IProposalOption = mapToIProposalOption(campaignOption);

            return {
                campaignId: campaignId,
                campaignName: readModelCampaign.campaignName,
                socialMedia: readModelCampaign.socialMedia,
                existingOptions: readModelCampaign.optionIds.map((option: Types.ObjectId, index: number) => index),
                selectedOption: {
                    optionIndex: optionIndex,
                    price: readModelOption.publicCampaignPrice,
                    canEdit: this.checkCanEdit(userInfo) ?? false,
                    addedAccounts: readModelOption.addedAccounts.map((i: ICampaignAccount): CampaignAccountDto => ({
                        ...i,
                        addedAccountsId: i.addedAccountsId.toString(),
                        socialAccountId: i.socialAccountId.toString(),
                        influencerId: i.influencerId.toString(),
                        selectedContent: {
                            campaignContentItemId: i.selectedContent.campaignContentItemId.toString(),
                            descriptionId: i.selectedContent.descriptionId.toString()
                        },
                        selectedContentItem: {
                            ...i.selectedContentItem,
                            _id: i.selectedContentItem?._id?.toString(),
                        },
                        genres: "genres" in i ? i.genres : undefined,
                        countries: "countries" in i ? i.countries : undefined,
                    })),
                    campaignContent: readModelOption.campaignContent.map((i: ICampaignContent): DetailedCampaignContentItemDto => ({
                        _id: i._id.toString(),
                        socialMedia: i.socialMedia,
                        socialMediaGroup: i.socialMediaGroup,
                        mainLink: i.mainLink,
                        descriptions: i.descriptions.map((d) => ({
                            _id: d._id.toString(),
                            description: d.description,
                        })),
                        taggedUser: i.taggedUser,
                        taggedLink: i.taggedLink,
                        additionalBrief: i.additionalBrief,
                        mediaCache: i.mediaCache,
                    }))
                }
            }
        } catch (err) {
            this.logger.warn(`Error map ${data.campaignName} to ProposalCampaignWithOptionDto: ${err} ${err.stack}`);
            throw new ConflictException(
                'Campaign option updated, but response serialization failed. Please refresh.'
            );
        }
    }

    // Returns proposal campaign option
    async getProposalCampaignOption(data: GetProposalCampaignDto, userInfo: UserPayload): Promise<BaseProposalCampaignOptionDto> {
        const {campaignId} = data;
        const optionIndex = data.optionIndex ?? 0;

        if (!campaignId) throw new BadRequestException("Invalid campaign id");

        const proposalCampaignOption = await this.proposalCampaignOptionRepo.findOneByIndex({
            campaignId: new Types.ObjectId(campaignId),
            optionIndex: optionIndex
        }, {lean: true});

        if (!proposalCampaignOption) throw new NotFoundException("Selected proposal campaign option not found");

        const influencerIds = [
            ...new Set(
                proposalCampaignOption.addedAccounts.map(acc => acc.influencerId)
            )
        ];

        const influencers = await this.influencerRepo.findMany(
            {_id: {$in: influencerIds}},
            {
                lean: true,
                select: [
                    '_id',
                    'instagram._id',
                    'instagram.logoUrl',
                    'tiktok._id',
                    'tiktok.logoUrl',
                    'youtube._id',
                    'youtube.logoUrl',
                    'facebook._id',
                    'facebook.logoUrl',
                    'spotify._id',
                    'spotify.logoUrl',
                    'soundcloud._id',
                    'soundcloud.logoUrl',
                    'press._id',
                    'press.logoUrl',
                    'instagram.profileCategory',
                    'tiktok.profileCategory',
                    'youtube.profileCategory',
                    'facebook.profileCategory',
                    'spotify.profileCategory',
                    'soundcloud.profileCategory',
                    'press.profileCategory',
                ]
            }
        );

        const influencerMap = new Map(
            influencers.map(inf => [inf._id.toString(), inf])
        );

        proposalCampaignOption.addedAccounts = proposalCampaignOption.addedAccounts.map(acc => {
            const influencer = influencerMap.get(acc.influencerId.toString());

            if (!influencer) return acc;

            const accountsArray = influencer[acc.socialMedia] ?? [];

            const matchedAccount = accountsArray.find(
                a => a._id?.toString() === acc.accountId?.toString()
            );

            return {
                ...acc,
                logoUrl: matchedAccount?.logoUrl ?? null,
                profileType: matchedAccount?.profileCategory ?? null,
            };
        });

        try {
            return {
                optionIndex: optionIndex,
                price: proposalCampaignOption.publicCampaignPrice,
                // addedAccounts: proposalCampaignOption.addedAccounts.map((account) => mapToICampaignAccount(account)),
                // campaignContent: proposalCampaignOption.campaignContent,
                addedAccounts: proposalCampaignOption.addedAccounts.map((i: ProposalCampaignAccount): CampaignAccountDto => ({
                    ...i,
                    addedAccountsId: i._id.toString(),
                    socialAccountId: i.accountId.toString(),
                    influencerId: i.influencerId.toString(),
                    selectedContent: {
                        campaignContentItemId: i.selectedContent.campaignContentItemId.toString(),
                        descriptionId: i.selectedContent.descriptionId.toString()
                    },
                    genres: "genres" in i ? i.genres : undefined,
                    countries: "countries" in i ? i.countries : undefined,
                })),
                campaignContent: proposalCampaignOption.campaignContent.map((i: ICampaignContent): DetailedCampaignContentItemDto => ({
                    _id: i._id.toString(),
                    socialMedia: i.socialMedia,
                    socialMediaGroup: i.socialMediaGroup,
                    mainLink: i.mainLink,
                    descriptions: i.descriptions.map((d) => ({
                        _id: d._id.toString(),
                        description: d.description,
                    })),
                    taggedUser: i.taggedUser,
                    taggedLink: i.taggedLink,
                    additionalBrief: i.additionalBrief,
                    mediaCache: i.mediaCache,
                })),
                canEdit: this.checkCanEdit(userInfo),
            }
        } catch (err) {
            this.logger.error('Proposal campaign option found but formatting failed', err);
            throw new InternalServerErrorException('Proposal campaign option found but formatting failed');
        }
    }

    // Returns one proposal campaign (with 1 selected option)
    async getProposalCampaign(data: GetProposalCampaignDto, userInfo: UserPayload): Promise<ProposalCampaignWithOptionDto> {
        const campaignId = data.campaignId;

        if (!campaignId) throw new BadRequestException("Invalid campaign id");

        let proposalCampaign: ProposalCampaign = await this.proposalCampaignRepo.findById(campaignId)

        if (!proposalCampaign) throw new NotFoundException('Proposal campaign not found');

        const proposalCampaignOption = await this.getProposalCampaignOption(data, userInfo);

        if (!proposalCampaignOption) throw new InternalServerErrorException("Can't get selected proposal campaign option");
        return {
            campaignId: campaignId,
            campaignName: proposalCampaign.campaignName,
            socialMedia: proposalCampaign.socialMedia as SocialMediaEnum,
            existingOptions: proposalCampaign.optionsIds.map((option: Types.ObjectId, index: number) => index),
            selectedOption: proposalCampaignOption,
        };
    }

    // Deletes proposal campaign option
    async deleteProposalCampaignOption(data: GetProposalCampaignDto, userInfo: UserPayload) {
        if (!this.checkCanEdit(userInfo)) throw new ForbiddenException("Not enough access");

        const campaign = await this.proposalCampaignRepo.findById(data.campaignId);

        if (!campaign) throw new NotFoundException('Proposal campaign not found');

        if (userInfo.role === Role.client && campaign.creatorId.toString() !== userInfo._id) throw new ForbiddenException('Not enough access to delete this option');

        const session = await this.proposalCampaignRepo.startSession();
        const selectedOptionId = campaign.optionsIds[data.optionIndex];

        if (!selectedOptionId) throw new BadRequestException('Unexisting option index');

        const optionObj = await this.proposalCampaignOptionRepo.findById(selectedOptionId.toString());

        if (userInfo.role === Role.client && optionObj.creatorId.toString() !== userInfo._id) {
            throw new ForbiddenException('Not enough access to delete this option');
        }

        session.startTransaction();

        try {
            await this.proposalCampaignOptionRepo.deleteById(selectedOptionId, {session});

            campaign.optionsIds.splice(data.optionIndex, 1);
            await campaign.save({session});

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            this.logger.error('Error deleting proposal campaign option', err);
            throw new InternalServerErrorException('Error deleting selected option');
        } finally {
            await session.endSession();
        }
    }
}
