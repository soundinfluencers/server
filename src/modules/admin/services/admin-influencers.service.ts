import {Injectable} from "@nestjs/common";
import {InfluencerRepository} from "../../../database/repositories/users/influencer.repository";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {AdminInfluencersListDto, AdminSocialAccountsSearchResponseDto} from "../dto/influencers/admin-influencers.dto";
import {mapToAdminSocialAccountForListDto} from "../../../common/mappers/influencer.mapper";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";

// Interface for AdminInfluencersService, AdminInfluencersController
export interface IAdminInfluencersService {
    // Get paginated influencers list filtered by social media
    getInfluencersList(
        socialMedia: SocialMediaEnum,
        query: PaginationQueryDto,
    ): Promise<AdminInfluencersListDto>;

    // Search social accounts
    searchSocialAccounts(query: SearchQueryDto): Promise<AdminSocialAccountsSearchResponseDto>;
}

@Injectable()
export class AdminInfluencersService implements IAdminInfluencersService {
    constructor(
        private readonly influencerRepo: InfluencerRepository,
    ) {
    }

    // Get paginated influencers list filtered by social media
    async getInfluencersList(socialMedia: SocialMediaEnum, query: PaginationQueryDto): Promise<AdminInfluencersListDto> {
        const list = await this.influencerRepo.findPaginated(
            socialMedia,
            query,
        );

        return {
            ...list,
            items: list.items?.length > 0 ? list.items.map(acc => mapToAdminSocialAccountForListDto(acc)) : []
        }
    }

    // Search social accounts
    async searchSocialAccounts(query: SearchQueryDto): Promise<AdminSocialAccountsSearchResponseDto> {
        const searchResult = await this.influencerRepo.findSocialAccountBySearch(query);
        return {
            ...searchResult,
            items: searchResult.items.map(acc => mapToAdminSocialAccountForListDto(acc))
        }
    }
}