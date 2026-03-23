import {Injectable} from "@nestjs/common";
import {InfluencerRepository} from "../../../database/repositories/users/influencer.repository";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {AdminInfluencersListDto} from "../dto/influencers/admin-influencers.dto";
import {mapToAdminSocialAccountForListDto} from "../../../common/mappers/influencer.mapper";

// Interface for AdminInfluencersService, AdminInfluencersController
export interface IAdminInfluencersService {
    // Get paginated influencers list filtered by social media
    getInfluencersList(
        socialMedia: SocialMediaEnum,
        query: PaginationQueryDto,
    ): Promise<AdminInfluencersListDto>
}

@Injectable()
export class AdminInfluencersService implements IAdminInfluencersService {
    constructor(
        private readonly influencerRepo: InfluencerRepository,
    ) {
    }

    async getInfluencersList(socialMedia: SocialMediaEnum, query: PaginationQueryDto): Promise<AdminInfluencersListDto> {
        const accounts = await this.influencerRepo.findPaginated(
            socialMedia,
            query,
        );

        return {
            total: accounts.total,
            page: accounts.page,
            limit: accounts.limit,
            totalPages: accounts.totalPages,
            accounts: accounts.items?.length > 0 ?
                accounts.items.map(acc => mapToAdminSocialAccountForListDto(acc)) : []
        }
    }
}