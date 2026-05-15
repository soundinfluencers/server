import {BadRequestException, Injectable, Logger} from "@nestjs/common";
import {RequestForAdminRepository} from "../../../../../database/repositories/requests/request-for-admin.repository";
import {
    AdminRequestResponseAction, NewClientRequestStatus,
    RequestForAdminType, RequestLifecycleState
} from "../../../../../common/types/request-for-admin/request-for-admin.types";
import {ClientRepository} from "../../../../../database/repositories/users/client.repository";
import {ObjId} from "../../../../../common/types/base.types";
import {AccountVerifiedStatus} from "../../../../../common/types/user.types";

type RespondNewClientRequestProps = {
    requestId: string;
    response: AdminRequestResponseAction;
    clientId: string;
}

export const NEW_CLIENT_REQUEST_HANDLER = Symbol('NEW_CLIENT_REQUEST_HANDLER');

// Service for handling new client request
@Injectable()
export class NewClientRequestHandler {
    private readonly logger = new Logger(NewClientRequestHandler.name);

    constructor(
        private readonly requestRepository: RequestForAdminRepository,
        private readonly clientRepository: ClientRepository,
    ) {
    }

    async exec(props: RespondNewClientRequestProps) {
        const {requestId, response, clientId} = props;

        switch (response) {
            case AdminRequestResponseAction.ACCEPT:
                return this.acceptNewClientRequest(requestId, clientId);

            case AdminRequestResponseAction.DECLINE:
                return this.declineNewClientRequest(requestId, clientId);

            default:
                throw new BadRequestException("Looks like this type of request doesn't support your response.");
        }
    }

    private async acceptNewClientRequest(
        requestId: string,
        clientId: string,
    ): Promise<{success: boolean, action: AdminRequestResponseAction}> {
        const session = await this.clientRepository.startSession();
        session.startTransaction();

        try {
            const clientUpdResult = await this.clientRepository.updateOne(
                {
                    _id: new ObjId(clientId),
                    verifiedStatus: {
                        $in: [
                            AccountVerifiedStatus.waitForUser,
                            AccountVerifiedStatus.waitForAdmin,
                        ],
                    }
                },
                {
                    verifiedStatus: AccountVerifiedStatus.accept
                },
                {
                    session
                }
            );

            if (clientUpdResult.matchedCount === 0) {
                throw new Error(
                    "Client cannot be accepted. Account may already be deleted.",
                );
            }

            const requestUpdResult = await this.requestRepository.updateOne(
                {
                    _id: new ObjId(requestId),
                    type: RequestForAdminType.NEW_CLIENT_REQUEST,
                    state: RequestLifecycleState.OPEN,
                    status: NewClientRequestStatus.WAITING_FOR_ADMIN,
                },
                {
                    $set: {
                        status: NewClientRequestStatus.APPROVED,
                        state: RequestLifecycleState.CLOSED,
                        reviewedAt: new Date(),
                    },
                    $unset: {
                        rejectionReason: "",
                    },
                },
                {
                    session
                }
            );

            if (requestUpdResult.matchedCount === 0) {
                throw new Error(
                    "Request cannot be accepted. It may already be closed or has invalid status.",
                );
            }

            await session.commitTransaction();
        } catch (err) {
            this.logger.error(err);
            await session.abortTransaction();
            return {
                success: false,
                action: AdminRequestResponseAction.ACCEPT,
            };
        } finally {
            await session.endSession();
        }

        return {
            success: true,
            action: AdminRequestResponseAction.ACCEPT,
        };
    }

    private async declineNewClientRequest(
        requestId: string,
        clientId: string,
    ): Promise<{success: boolean, action: AdminRequestResponseAction}> {
        const session = await this.clientRepository.startSession();
        session.startTransaction();

        try {
            const clientUpdResult = await this.clientRepository.updateOne(
                {
                    _id: new ObjId(clientId),
                    verifiedStatus: {
                        $in: [
                            AccountVerifiedStatus.waitForUser,
                            AccountVerifiedStatus.waitForAdmin,
                        ],
                    }
                },
                {
                    verifiedStatus: AccountVerifiedStatus.decline
                },
                {
                    session
                }
            );

            if (clientUpdResult.matchedCount === 0) {
                throw new Error(
                    "Client cannot be declined. Account may already be deleted.",
                );
            }

            const requestUpdResult = await this.requestRepository.updateOne(
                {
                    _id: new ObjId(requestId),
                    type: RequestForAdminType.NEW_CLIENT_REQUEST,
                    state: RequestLifecycleState.OPEN,
                    status: NewClientRequestStatus.WAITING_FOR_ADMIN,
                },
                {
                    $set: {
                        status: NewClientRequestStatus.REJECTED,
                        state: RequestLifecycleState.CLOSED,
                        reviewedAt: new Date(),
                    },
                    $unset: {
                        rejectionReason: "",
                    },
                },
                {
                    session
                }
            );

            if (requestUpdResult.matchedCount === 0) {
                throw new Error(
                    "Request cannot be declined. It may already be closed or has invalid status.",
                );
            }

            await session.commitTransaction();
        } catch (err) {
            this.logger.error(err);
            await session.abortTransaction();
            return {
                success: false,
                action: AdminRequestResponseAction.DECLINE,
            };
        } finally {
            await session.endSession();
        }

        return {
            success: true,
            action: AdminRequestResponseAction.DECLINE,
        };
    }
}