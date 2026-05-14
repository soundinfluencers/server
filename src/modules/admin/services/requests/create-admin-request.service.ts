import {BadRequestException, Injectable, Logger} from "@nestjs/common";
import {RequestForAdminRepository} from "../../../../database/repositories/requests/request-for-admin.repository";
import {
    CreateNewClientRequestProps, NewClientRequestStatus,
    RequestForAdminType, RequestLifecycleState
} from "../../../../common/types/request-for-admin/request-for-admin.types";
import {ClientSession} from "mongoose";
import {ObjId} from "../../../../common/types/base.types";
import {Role} from "../../../../common/types/user.types";

export const CREATE_ADMIN_REQUEST_SERVICE = Symbol('CREATE_ADMIN_REQUEST_SERVICE');

type CreateAdminRequestProps = {
    requestType: RequestForAdminType;
    session?: ClientSession;
    payload?: CreateNewClientRequestProps;
}

@Injectable()
export class CreateAdminRequestService {
    private readonly logger = new Logger(CreateAdminRequestService.name);

    constructor(
        private readonly requestRepository: RequestForAdminRepository,
    ) {
    }

    async exec(props: CreateAdminRequestProps): Promise<{ success: boolean }> {
        const {requestType, session, payload} = props;

        let success = false;

        try {
            switch (requestType) {
                case RequestForAdminType.NEW_CLIENT_REQUEST: {
                    if (!payload.clientId) {
                        success = false;
                        this.logger.error(`Failed to create ${requestType} request: clientId is required`);
                    }
                    await this.createClientRequest(requestType, payload, session);
                    success = true;
                    break;
                }

                default: {
                    throw new BadRequestException(`Request type ${requestType} is not supported yet.`);
                }
            }
        } catch (err) {
            this.logger.error(`Failed to create ${requestType} request: ${err.message}`);
            success = false;
        }

        return {success};
    }

    private async createClientRequest(
        requestType: RequestForAdminType,
        props: CreateNewClientRequestProps,
        session?: ClientSession,
    ): Promise<void> {
        const {clientId, clientName} = props;

        await this.requestRepository.create({
            type: requestType,
            state: RequestLifecycleState.OPEN,
            status: NewClientRequestStatus.WAITING_FOR_ADMIN,
            userFirstName: clientName,
            userRole: Role.client,
            clientId: new ObjId(clientId),
        }, {session});
    }
}