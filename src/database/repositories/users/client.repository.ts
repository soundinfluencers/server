import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {Client} from "../../schemas/users/client.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";

@Injectable()
export class ClientRepository extends BaseRepository<Client> {
    constructor(
        @InjectModel('Client')
        private readonly clientModel: Model<Client>,
    ) {
        super(clientModel);
    }

    async findClientByFirstName(firstName: string, options?: RepoOptions): Promise<Client> {
        const query = this.clientModel.findOne({ firstName });
        return applyQueryOptions(query, options);
    }

    async findClientByEmail(email: string, options?: RepoOptions): Promise<Client> {
        const query = this.clientModel.findOne({ email });
        return applyQueryOptions(query, options);
    }

    async findClientByInstagramUsername(username: string, options?: RepoOptions): Promise<Client> {
        const query = this.clientModel.findOne({ instagramUsername: username });
        return applyQueryOptions(query, options);
    }

    async findClientByPhone(phone: string, options?: RepoOptions): Promise<Client> {
        const query = this.clientModel.findOne({ phone })
        return applyQueryOptions(query, options);
    }
}