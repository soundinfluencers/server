import {Module} from '@nestjs/common';
import {ProposalSystemController} from './proposal-system.controller';
import {ProposalSystemService} from './proposal-system.service';
import {MediaModule} from "../media/media.module";
import {ProposalCampaignDetailsService} from "./services/proposal-campaign-details.service";
import {ProposalCampaignUpdateService} from "./services/proposal-campaign-update.service";
import {ProposalAccountsBuilderService} from "./services/proposal-accounts-builder.service";

@Module({
    imports: [MediaModule],
    controllers: [ProposalSystemController],
    providers: [
        ProposalSystemService,
        ProposalCampaignDetailsService,
        ProposalCampaignUpdateService,
        ProposalAccountsBuilderService,
    ],
    exports: [
        ProposalCampaignDetailsService,
        ProposalCampaignUpdateService,
        ProposalAccountsBuilderService,
    ],
})
export class ProposalSystemModule {
}
