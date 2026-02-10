import {Module} from '@nestjs/common';
import {ProposalSystemController} from './proposal-system.controller';
import {ProposalSystemService} from './proposal-system.service';
import {MediaModule} from "../media/media.module";

@Module({
    imports: [MediaModule],
    controllers: [ProposalSystemController],
    providers: [ProposalSystemService],
})
export class ProposalSystemModule {
}
