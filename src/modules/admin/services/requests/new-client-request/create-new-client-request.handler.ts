import {Injectable} from "@nestjs/common";
import {RequestForAdminRepository} from "../../../../../database/repositories/requests/request-for-admin.repository";
import {
    NewClientRequestStatus,
    RequestLifecycleState
} from "../../../../../common/types/request-for-admin/request-for-admin.types";
import {ObjId} from "../../../../../common/types/base.types";
import {ClientSession} from "mongoose";
import {Role} from "../../../../../common/types/user.types";

export const CREATE_NEW_CLIENT_REQUEST_HANDLER = Symbol('CREATE_NEW_CLIENT_REQUEST_HANDLER');

type CreateNewClientRequestProps = {
    clientId: string;
    clientName: string;
    session: ClientSession;
}

@Injectable()
export class CreateNewClientRequestHandler {
    constructor(
        private readonly requestRepository: RequestForAdminRepository,
    ) {
    }

    async exec(
        props: CreateNewClientRequestProps,
    ) {
        const {clientId, clientName, session} = props;

        await this.requestRepository.create({
            type: 'NEW_CLIENT_REQUEST',
            state: RequestLifecycleState.OPEN,
            status: NewClientRequestStatus.WAITING_FOR_ADMIN,
            userFirstName: clientName,
            userRole: Role.client,
            clientId: new ObjId(clientId),
        }, {session});
    }
}