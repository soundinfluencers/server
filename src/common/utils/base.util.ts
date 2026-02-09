// return array with unique values
import {formatDate} from "./formatters";

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

// Build safe name for file
export const buildSafeFileName = (
    rawName: string,
    {
        maxLength = 80,
        fallback = `${formatDate(new Date())}`,
        extension = 'csv'
    }: { maxLength?: number; fallback?: string, extension?: 'csv' | 'pdf' } = {},
): string => {
    const baseName = rawName || fallback;

    let safe = baseName.replace(/[\r\n]/g, ' ');

    safe = safe.replace(/[\/\\:*?"<>|]/g, '');

    safe = safe.normalize('NFKD');

    safe = safe.replace(/\s+/g, ' ').trim();

    if (safe.length > maxLength) {
        safe = safe.slice(0, maxLength).trim();
    }

    if (!safe) safe = fallback;

    const asciiFallback = safe.replace(/[^\x20-\x7E]/g, '');

    const encoded = encodeURIComponent(safe)
        .replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
        .replace(/\*/g, '%2A');

    return `attachment; filename="${asciiFallback}.${extension}"; filename*=UTF-8''${encoded}.${extension}`;
};
