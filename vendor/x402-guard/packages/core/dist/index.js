export function parseResourceUrl(url, method = "GET") {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("resource URL must use http or https");
    }
    return {
        method: method.trim().toUpperCase() || "GET",
        url,
        domain: parsed.hostname.toLowerCase(),
        path: parsed.pathname || "/",
    };
}
export function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }
    if (value && typeof value === "object") {
        return `{${Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}
export { InvalidPaymentContextError, canonicalizeResource, validatePaymentContext, } from "./validation.js";
