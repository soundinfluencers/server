import { Module } from '@nestjs/common';
import { ProposalSystemController } from './proposal-system.controller';
import { ProposalSystemService } from './proposal-system.service';

@Module({
  controllers: [ProposalSystemController],
  providers: [ProposalSystemService],
})
export class ProposalSystemModule {}
