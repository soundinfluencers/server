import {Body, Controller, Get, Param, Patch, Query} from '@nestjs/common';
import {ScrapersService} from './scrapers.service';
import {ReqUpdatePostDetailsDto} from './dto/req-update-post-details.dto';
import {ReqUpdateAllPostsDetailsDto} from "./dto/req-update-all-posts-details-dto";
import {ReqUpdateAllAccountsDto} from "./dto/req-update-all-accounts.dto";

@Controller('scrapers')
export class ScrapersController {
    constructor(private readonly scrapersService: ScrapersService) {
    }

    @Patch('update-post-details')
    async updatePostDetails(@Body() data: ReqUpdatePostDetailsDto) {
        return this.scrapersService.updatePostDetailsInCampaign(data);
    }

    @Patch('update-all-posts-details')
    async updateAllPostsDetails(@Body() data: ReqUpdateAllPostsDetailsDto) {
        return this.scrapersService.updateAllPostsDetailsInCampaign(data);
    }

    @Patch('update-all-accounts-details')
    async updateAllAccountsDetails(@Body() data: ReqUpdateAllAccountsDto) {
        return this.scrapersService.updateAllAccountsDetails(data);
    }
}
