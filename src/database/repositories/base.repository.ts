import { Model, Types } from "mongoose";
import {RepoOptions} from "../types/repo.types";
import {applyLean} from "../utils/apply-lean.util";

export class BaseRepository<T> {
    constructor(protected readonly model: Model<T>) {}

    async findById(id: string | Types.ObjectId, options?: RepoOptions) {
        const query = this.model.findById(id);
        return applyLean(query, options);
    }

    async findOne(filter: any, options?: RepoOptions) {
        const query = this.model.findOne(filter);
        return applyLean(query, options);
    }

    async findMany(filter: any = {}, options?: RepoOptions) {
        const query = this.model.find(filter);
        return applyLean(query, options);
    }

    async create(data: Partial<T>) {
        return this.model.create(data);
    }

    async updateById(id: string | Types.ObjectId, data: Partial<T>, options?: RepoOptions) {
        const query = this.model.findByIdAndUpdate(id, data, { new: true });
        return applyLean(query, options);
    }

    async deleteById(id: string | Types.ObjectId) {
        return this.model.findByIdAndDelete(id).exec();
    }
}
