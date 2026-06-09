import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RequestForAdminRepository } from '../../../../../database/repositories/requests/request-for-admin.repository';
import {
  AdminRequestResponseAction,
  RequestForAdminType,
  RequestLifecycleState,
  RequestSpecifiedStatus,
} from '../../../../../common/types/request-for-admin/request-for-admin.types';
import { ClientRepository } from '../../../../../database/repositories/users/client.repository';
import { ObjId } from '../../../../../common/types/base.types';
import { AccountVerifiedStatus } from '../../../../../common/types/user.types';

export const NEW_CLIENT_REQUEST_HANDLER = Symbol('NEW_CLIENT_REQUEST_HANDLER');

export type RespondNewClientRequestProps = {
  requestId: string;
  response: AdminRequestResponseAction;
  clientId: string;
};

@Injectable()
export class NewClientRequestHandler {
  private readonly logger = new Logger(NewClientRequestHandler.name);

  constructor(
    private readonly requestRepository: RequestForAdminRepository,
    private readonly clientRepository: ClientRepository,
  ) {}

  async exec({ requestId, response, clientId }: RespondNewClientRequestProps): Promise<void> {
    switch (response) {
      case AdminRequestResponseAction.APPROVE:
        return this.handle(
          requestId,
          clientId,
          AccountVerifiedStatus.accept,
          RequestSpecifiedStatus.APPROVED,
        );
      case AdminRequestResponseAction.REJECT:
        return this.handle(
          requestId,
          clientId,
          AccountVerifiedStatus.decline,
          RequestSpecifiedStatus.REJECTED,
        );
      default:
        throw new BadRequestException('Unsupported response action for this request type.');
    }
  }

  private async handle(
    requestId: string,
    clientId: string,
    verifiedStatus: AccountVerifiedStatus,
    requestStatus: RequestSpecifiedStatus,
  ): Promise<void> {
    const session = await this.clientRepository.startSession();
    session.startTransaction();

    try {
      const clientUpdResult = await this.clientRepository.updateOne(
        {
          _id: new ObjId(clientId),
          verifiedStatus: {
            $in: [AccountVerifiedStatus.waitForUser, AccountVerifiedStatus.waitForAdmin],
          },
        },
        { verifiedStatus },
        { session },
      );

      if (clientUpdResult.matchedCount === 0) {
        throw new Error('Client not found or already processed. Account may have been deleted.');
      }

      const requestUpdResult = await this.requestRepository.updateOne(
        {
          _id: new ObjId(requestId),
          type: RequestForAdminType.NEW_CLIENT_REQUEST,
          lifecycleStatus: RequestLifecycleState.OPEN,
          specifiedStatus: {
            $in: [RequestSpecifiedStatus.WAITING_FOR_ADMIN, RequestSpecifiedStatus.NEGOTIATION],
          },
        },
        {
          $set: {
            specifiedStatus: requestStatus,
            lifecycleStatus: RequestLifecycleState.CLOSED,
            reviewedAt: new Date(),
          },
          $unset: { rejectionReason: '' },
        },
        { session },
      );

      if (requestUpdResult.matchedCount === 0) {
        throw new Error('Request is already closed or has an invalid status.');
      }

      await session.commitTransaction();
    } catch (err) {
      this.logger.error(err);
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
