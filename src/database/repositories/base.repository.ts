import {
    AnyBulkWriteOperation,
    ClientSession,
    FilterQuery,
    Model,
    PipelineStage,
    QueryOptions,
    Types,
    UpdateQuery
} from "mongoose";
import { RepoOptions } from "../types/repo.types";
import { applyQueryOptions } from "../utils/apply-query-options.util";
import { applyAggregateOptions } from "../utils/apply-aggregate-options.util";

// Interface for base repository with default mongo methods
export interface IBaseRepository<T> {
    findById(id: string, options?: RepoOptions & { select?: string[] }): any;
    findOne(filter: FilterQuery<T>, options?: RepoOptions & { select?: string[] }): Promise<T | null>;
    findMany(filter?: FilterQuery<T>, options?: RepoOptions & { select?: string[] }): Promise<T[]>;
    create<U>(data: U, options?: { session?: any }): Promise<T>;
    updateById(id: string | Types.ObjectId, data: Partial<T>, options?: RepoOptions): any;
    updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>, options?: RepoOptions & { upsert?: boolean }): any;
    deleteById(id: string | Types.ObjectId, options?: RepoOptions): any;
}

export class BaseRepository<T> implements IBaseRepository<T> {
    constructor(protected readonly model: Model<T>) { }

    findById(id: string, options?: RepoOptions & { select?: string[] }) {
        let query = this.model.findById(new Types.ObjectId(id));

        if (options?.select?.length) {
            query = query.select(options.select.join(' '));
        }

        return applyQueryOptions(query, options);
    }

    async findOne(filter: any, options?: RepoOptions & { select?: string[] }) {
        let query = this.model.findOne(filter);

        if (options?.select?.length) {
            query = query.select(options.select.join(' '));
        }

        return applyQueryOptions(query, options);
    }

    async findMany(
        filter: FilterQuery<T> = {},
        options?: RepoOptions & { select?: string[] }
    ) {
        let query = this.model.find(filter);

        query = applyQueryOptions(query, options);

        if (options?.select?.length) {
            query = query.select(options.select.join(' '));
        }

        if (typeof options?.limit === 'number') {
            query = query.limit(options.limit);
        }

        if (typeof options?.skip === 'number') {
            query = query.skip(options.skip);
        }

        return query.exec();
    }

    async create<U>(data: U, options?: { session?: any }): Promise<T> {
        return this.model.create([data], { session: options?.session })
            .then(docs => docs[0] as T);
    }

    async exists(filter: FilterQuery<T>): Promise<boolean> {
        const result = await this.model.exists(filter);
        return !!result;
    }

    async updateById(id: string | Types.ObjectId, data: Partial<T>, options?: RepoOptions) {
        const query = this.model.findByIdAndUpdate(id, data, { new: true });
        return applyQueryOptions(query, options);
    }

    async updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>, options?: RepoOptions & { upsert?: boolean }) {
        const query = this.model.updateOne(filter, update, { ...options });
        return applyQueryOptions(query, options);
    }

    async updateOneWithArrayFilters(
        filter: FilterQuery<T>,
        update: UpdateQuery<T>,
        options?: { session?: any; upsert?: boolean; arrayFilters?: QueryOptions['arrayFilters'] },
    ) {
        return this.model.updateOne(filter, update, {
            session: options?.session,
            upsert: options?.upsert,
            arrayFilters: options?.arrayFilters,
        }).exec();
    }

    async findOneAndUpdate(
        filter: FilterQuery<T>,
        update: UpdateQuery<T>,
        options: RepoOptions & { new?: boolean; upsert?: boolean; runValidators?: boolean, select?: string[] } = {}
    ) {
        let query = this.model.findOneAndUpdate(filter, update, {
            new: true,
            runValidators: true,
            ...options,
        });

        if (options?.select?.length) {
            query = query.select(options.select.join(' '));
        }

        return applyQueryOptions(query, options);
    }

    async deleteById(id: string | Types.ObjectId, options?: RepoOptions) {
        const _id = typeof id === 'string' ? new Types.ObjectId(id) : id;
        const query = this.model.findByIdAndDelete(_id);
        return applyQueryOptions(query, options);
    }

    async findOneAndDelete(filter: FilterQuery<T>, options?: RepoOptions) {
        const query = this.model.findOneAndDelete(filter);
        return applyQueryOptions(query, options);
    }

    aggregate<R = any>(
        pipeline: PipelineStage[],
        options?: RepoOptions & {
            allowDiskUse?: boolean;
        },
    ) {
        const aggregate = this.model.aggregate<R>(pipeline);
        return applyAggregateOptions(aggregate, options);
    }

    startSession(): Promise<ClientSession> {
        return this.model.db.startSession();
    }

    async bulkWrite(
        operations: AnyBulkWriteOperation<any>[],
        options?: { ordered?: boolean },
    ) {
        return this.model.bulkWrite(operations, options);
    }
}
