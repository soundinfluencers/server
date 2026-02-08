import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ProposalAccessGuard } from '../guards/proposal-access.guard';

export const PROPOSAL_ACCESS_KEY = 'proposal_access';

export type ProposalAccessType =
    | 'proposalClientOnly'
    | 'adminOnly'
    | 'adminOrProposalClient';

export const ProposalAccess = (type: ProposalAccessType) =>
    applyDecorators(
        SetMetadata(PROPOSAL_ACCESS_KEY, type),
        UseGuards(ProposalAccessGuard),
    );