import { SetMetadata } from '@nestjs/common';

export const PROPOSAL_ACCESS_KEY = 'proposal_access';

export type ProposalAccessType =
    | 'proposalClientOnly'
    | 'adminOnly'
    | 'adminOrProposalClient';

export const ProposalAccess = (type: ProposalAccessType) =>
    SetMetadata(PROPOSAL_ACCESS_KEY, type);
