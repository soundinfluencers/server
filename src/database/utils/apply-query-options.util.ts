export interface QueryLike {
    lean?(value?: boolean): this;
    session?(session: any): this;
    populate?(path: any): this;

    // TODO: add other options
}

type QueryOptionApplier = <Q extends QueryLike>(
    query: Q,
    value: any,
) => Q;

const optionAppliers: Record<string, QueryOptionApplier> = {
    lean: (query, value) => (value ? query.lean() : query),
    session: (query, value) => query.session(value),
    populate: (q, v) => q.populate(v),

    // TODO: add other options
};

export function applyQueryOptions<T extends QueryLike>(
    query: T,
    options?: Record<string, any>,
): T {
    if (!options) return query;

    return Object.entries(options).reduce<T>((q, [key, value]) => {
        const applier = optionAppliers[key];
        return applier ? applier(q, value) : q;
    }, query);
}