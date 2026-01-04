import {Body, Controller, Patch, Req, UnauthorizedException} from '@nestjs/common';
import {ScrapersService} from './scrapers.service';
import {ReqUpdatePostDetailsDto} from './dto/req-update-post-details.dto';
import {ReqUpdateAllPostsDetailsDto} from "./dto/req-update-all-posts-details-dto";
import {ReqUpdateAllAccountsDto} from "./dto/req-update-all-accounts.dto";
import {ApiOperation, ApiTags} from "@nestjs/swagger";
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {AuthenticatedRequest, Role} from "../../common/types/auth.types";
import {
    UpdateAllAccountsResponseDto,
    UpdateAllPostDetailsResponseDto,
    UpdatePostDetailsResponseDto
} from "./dto/scrapers-responses.dto";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";

@Roles(Role.admin)
@ApiTags('scrapers')
@Controller('scrapers')
export class ScrapersController {
    constructor(private readonly scrapersService: ScrapersService) {
    }

    @Auth()
    @ApiOperation({summary: "Updates one account's post details in campaign"})
    @ApiResponseDto(UpdatePostDetailsResponseDto, { successStatusCode: 201 })
    @Patch('post-details/one')
    async updatePostDetails(@Req() req: AuthenticatedRequest, @Body() data: ReqUpdatePostDetailsDto): Promise<UpdatePostDetailsResponseDto> {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');

        return this.scrapersService.updatePostDetailsInCampaign({...data, refreshInitiatorId: req.user._id});
    }

    @Auth()
    @ApiOperation({summary: "Updates all post details for available social medias in campaign"})
    // Using undefined in ApiResponseDto because client will get all data through socket
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Patch('post-details/all')
    async updateAllPostsDetails(@Req() req: AuthenticatedRequest, @Body() data: ReqUpdateAllPostsDetailsDto): Promise<UpdateAllPostDetailsResponseDto> {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');

        return this.scrapersService.updateAllPostsDetailsInCampaign({...data, refreshInitiatorId: req.user._id});
    }

    @Auth()
    @ApiOperation({summary: "Updates all accounts for one social media"})
    // Using undefined in ApiResponseDto because client will get all data through socket
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Patch('account-details/all')
    async updateAllAccountsDetails(@Req() req: AuthenticatedRequest, @Body() data: ReqUpdateAllAccountsDto): Promise<UpdateAllAccountsResponseDto> {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');

        return this.scrapersService.updateAllAccountsDetails({...data, refreshInitiatorId: req.user._id});
    }
}
