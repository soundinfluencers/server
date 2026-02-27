export const escapeHtmlForEmail = (v: string) =>
    v
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

export const formatMoneyForEmail = (value: unknown) => {
    if (!value) return '-';
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return `${n.toLocaleString("en-US")} EUR`;
    return "—";
};

export const safeLinkForEmail = (url?: string) => {
    if (!url) return "—";
    const u = escapeHtmlForEmail(url);
    return `<a href="${u}" style="color:#2563eb; text-decoration:none;">${u}</a>`;
};