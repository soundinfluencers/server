import {FilterQuery, Model, Types, UpdateQuery} from "mongoose";
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

    async findMany(
        filter: FilterQuery<T> = {},
        options?: RepoOptions & { select?: string[] }
    ) {
        let query = this.model.find(filter);
        query = applyLean(query, options);

        if (options?.select) {
            query = query.select(options.select.join(' '));
        }

        return query;
    }


    async create<U>(data: U): Promise<T> {
        return this.model.create(data);
    }

    async updateById(id: string | Types.ObjectId, data: Partial<T>, options?: RepoOptions) {
        const query = this.model.findByIdAndUpdate(id, data, { new: true });
        return applyLean(query, options);
    }

    async updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>) {
        return this.model.updateOne(filter, update);
    }

    async findOneAndUpdate(
        filter: FilterQuery<T>,
        update: UpdateQuery<T>,
        options: RepoOptions & { new?: boolean; upsert?: boolean; runValidators?: boolean } = {}
    ) {
        const query = this.model.findOneAndUpdate(filter, update, {
            new: true,
            runValidators: true,
            ...options,
        });

        return applyLean(query, options);
    }

    async deleteById(id: string | Types.ObjectId) {
        return this.model.findByIdAndDelete(id).exec();
    }

    async findOneAndDelete(filter: FilterQuery<T>, options?: RepoOptions) {
        const query = this.model.findOneAndDelete(filter);
        return applyLean(query, options);
    }
}
