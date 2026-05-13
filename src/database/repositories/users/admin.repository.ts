import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {Admin} from "../../schemas/users/admin.schema";

@Injectable()
export class AdminRepository extends BaseRepository<Admin> {
    constructor(
        @InjectModel(Admin.name)
        private readonly adminModel: Model<Admin>,
    ) {
        super(adminModel);
    }

    async findAdminByEmail(email: string, options?: RepoOptions): Promise<Admin> {
        const query = this.adminModel.findOne({ email });
        return applyQueryOptions(query, options);
    }
}