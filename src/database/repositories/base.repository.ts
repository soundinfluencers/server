import {FilterQuery, Model, Types, UpdateQuery} from "mongoose";
import {RepoOptions} from "../types/repo.types";
import {applyQueryOptions} from "../utils/apply-query-options.util";

export class BaseRepository<T> {
    constructor(protected readonly model: Model<T>) {}

    findById(id: string | Types.ObjectId, options?: RepoOptions) {
        const query = this.model.findById(id);
        return applyQueryOptions(query, options);
    }

    async findOne(filter: any, options?: RepoOptions) {
        const query = this.model.findOne(filter);
        return applyQueryOptions(query, options);
    }

    async findMany(
        filter: FilterQuery<T> = {},
        options?: RepoOptions & { select?: string[] }
    ) {
        let query = this.model.find(filter);
        query = applyQueryOptions(query, options);

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
        return applyQueryOptions(query, options);
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

        return applyQueryOptions(query, options);
    }

    async deleteById(id: string | Types.ObjectId) {
        return this.model.findByIdAndDelete(id).exec();
    }

    async findOneAndDelete(filter: FilterQuery<T>, options?: RepoOptions) {
        const query = this.model.findOneAndDelete(filter);
        return applyQueryOptions(query, options);
    }
}
