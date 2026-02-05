// return array with unique values
export const uniq = <T>(arr: T[]) => [...new Set(arr)];

// safe parse to int
export const safeParseToNumber = (val: any, fallback = 0): number => {
    // if already number
    if (typeof val === "number") {
        return Number.isFinite(val) ? val : fallback;
    }

    // string (even like '12.3')
    if (typeof val === "string") {
        const s = val.trim();
        if (s === "") return fallback;

        const n = Number(s);
        return Number.isFinite(n) ? n : fallback;
    }

    // boolean / null / undefined / object / etc
    if (val == null) return fallback;

    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
};