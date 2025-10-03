import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ScrapersService } from './scrapers.service';
import { ReqUpdatePostDetailsDto } from './dto/req-update-post-details.dto';
import {ReqUpdateAllPostsDetailsDto} from "./dto/req-update-all-posts-details-dto";

@Controller('scrapers')
export class ScrapersController {
  constructor(private readonly scrapersService: ScrapersService) {}

  @Patch('update-post-details')
  async updatePostDetails(@Body() data: ReqUpdatePostDetailsDto) {
    return this.scrapersService.updatePostDetailsInCampaign(data);
  }

  @Patch('update-all-posts-details')
    async updateAllPostsDetails(@Body() data: ReqUpdateAllPostsDetailsDto) {
      return this.scrapersService.updateAllPostsDetailsInCampaign(data);
  }
}
