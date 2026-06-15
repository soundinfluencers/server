import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import {RequestForAdminRepository} from '../../../database/repositories/requests/request-for-admin.repository';
import {
    RequestNegotiationThreadRepository
} from '../../../database/repositories/negotiation/request-negotiation-thread.repository';
import {NegotiationParticipantResolver} from './negotiation-participant.resolver';
import {ObjId} from '../../../common/types/base.types';
import {
    RequestLifecycleState,
    RequestSpecifiedStatus,
} from '../../../common/types/request-for-admin/request-for-admin.types';
import {RequestNegotiationThread} from '../../../database/schemas/negotiation/request-negotiation-thread.schema';
import {FilteredNestLogger} from "../../../common/logger/filtered-nest-logger";

@Injectable()
export class StartNegotiationService {
    private readonly logger = new FilteredNestLogger(StartNegotiationService.name);

    constructor(
        private readonly requestRepository: RequestForAdminRepository,
        private readonly threadRepository: RequestNegotiationThreadRepository,
        private readonly participantResolver: NegotiationParticipantResolver,
    ) {
    }

    // Moves a request into NEGOTIATION and opens (or returns the existing)
    // conversation thread. Idempotent: a second call returns the active thread.
    async exec(requestId: string, adminId: string): Promise<RequestNegotiationThread> {
        const request = await this.requestRepository.findById(requestId);

        if (!request) {
            throw new NotFoundException('Request not found');
        }

        const existing = await this.threadRepository.findActiveByRequestId(requestId);
        if (existing) {
            return existing;
        }

        const participant = await this.participantResolver.resolve(requestId, request.type);

        const session = await this.requestRepository.startSession();
        session.startTransaction();

        try {
            const transition = await this.requestRepository.updateOne(
                {
                    _id: new ObjId(requestId),
                    lifecycleStatus: RequestLifecycleState.OPEN,
                    specifiedStatus: RequestSpecifiedStatus.WAITING_FOR_ADMIN,
                },
                {$set: {specifiedStatus: RequestSpecifiedStatus.NEGOTIATION}},
            );

            if (transition.matchedCount === 0) {
                throw new ConflictException(
                    'Request cannot enter negotiation (already decided or not pending)',
                );
            }

            return this.threadRepository.create({
                requestId: new ObjId(requestId),
                requestType: request.type,
                participantEmail: participant.email,
                participantName: participant.name,
                subject: `Your SoundInfluencers request (${request.type})`,
                createdBy: new ObjId(adminId),
            });
        } catch (err) {
          await session.abortTransaction();
          this.logger.error(`Failed to start negotiation for request ${requestId}`, err);
          if (err instanceof HttpException) throw err;
          throw new InternalServerErrorException('Failed to start negotiation. Please try again later.');
        } finally {
          await session.endSession();
        }
    }
}
