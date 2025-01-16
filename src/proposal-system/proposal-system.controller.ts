import {Controller, Get, Param} from "@nestjs/common";
import {ProposalSystemService} from "./proposal-system.service";

@Controller('proposal-system')
export class ProposalSystemController {
    constructor(private readonly proposalSystemService: ProposalSystemService) {
    }
    
    @Get('get-all-clients')
    getAllClients() {
        return this.proposalSystemService.getAllClients();
    }
    
    @Get('get-all-brand-accounts/:socialMedia')
    getAllBrandAccounts(@Param('socialMedia') socialMedia: string) {
        return this.proposalSystemService.getAllBrandAccounts(socialMedia);
    }
}