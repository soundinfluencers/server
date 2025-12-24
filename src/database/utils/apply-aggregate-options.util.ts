import { Aggregate } from 'mongoose';

export interface AggregateLike<T = any> {
    session?(session: any): this;
    allowDiskUse?(value: boolean): this;
}

type AggregateOptionApplier = <Q extends AggregateLike>(
    aggregate: Q,
    value: any,
) => Q;

const aggregateOptionAppliers: Record<string, AggregateOptionApplier> = {
    session: (agg, value) => agg.session(value),
    allowDiskUse: (agg, value) => agg.allowDiskUse(value),
};

export function applyAggregateOptions<T extends AggregateLike>(
    aggregate: T,
    options?: Record<string, any>,
): T {
    if (!options) return aggregate;

    return Object.entries(options).reduce<T>((agg, [key, value]) => {
        const applier = aggregateOptionAppliers[key];
        return applier ? applier(agg, value) : agg;
    }, aggregate);
}
