/**
 * Public order tracking client.
 *
 * The quotation-service exposes possession-based tracking endpoints: a
 * garment tag code resolves with `/tags/{code}/tracking`, while a numeric
 * quotation id resolves with `/quotations/{id}/tracking`. Neither endpoint
 * requires a session and neither returns customer PII.
 *
 * Set VITE_TRACKING_API_URL to the quotation-service base URL. If it is not
 * set, VITE_CHAT_API_URL is used as a fallback because it already points at
 * the same service in existing deployments.
 */

export type TrackingErrorKind = "config" | "not_found" | "unavailable";

export interface TrackingHistoryEntry {
    status: string;
    changed_at: string;
    changed_by?: string | null;
    note?: string | null;
}

export interface TrackingResult {
    id: string | number;
    quotation_title?: string | null;
    tag?: string | null;
    status: string;
    status_history: TrackingHistoryEntry[];
    created_at?: string | null;
    updated_at?: string | null;
    garment_label?: string | null;
    code?: string;
}

export class TrackingError extends Error {
    kind: TrackingErrorKind;

    constructor(kind: TrackingErrorKind, message: string) {
        super(message);
        this.name = "TrackingError";
        this.kind = kind;
    }
}

const configuredBase =
    (import.meta.env.VITE_TRACKING_API_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_CHAT_API_URL as string | undefined)?.trim() ||
    "";

export function isTrackingConfigured(): boolean {
    return configuredBase.length > 0;
}

function apiBase(): string {
    if (!configuredBase) {
        throw new TrackingError(
            "config",
            "Tracking is not configured. Set VITE_TRACKING_API_URL to the quotation-service URL.",
        );
    }
    return configuredBase.replace(/\/+$/, "");
}

/** Accept a bare code, a QR URL, or a URL containing `?tag=CODE`. */
export function extractTrackingCode(input: string): string {
    const value = input.trim();
    if (!value) return "";

    try {
        const url = new URL(value);
        for (const key of ["tag", "order", "id"]) {
            const found = url.searchParams.get(key);
            if (found) return decodeURIComponent(found).trim();
        }
    } catch {
        // Not an absolute URL — fall through to the query-string check.
    }

    const queryMatch = value.match(/[?&](?:tag|order|id)=([^&#]+)/i);
    if (queryMatch?.[1]) {
        try {
            return decodeURIComponent(queryMatch[1]).trim();
        } catch {
            return queryMatch[1].trim();
        }
    }

    return value.replace(/^#/, "").trim();
}

async function getJson(path: string): Promise<TrackingResult> {
    // Resolve the base before the network try/catch so configuration errors
    // keep their own error kind instead of being reported as "unavailable".
    const base = apiBase();
    let response: Response;
    try {
        response = await fetch(`${base}${path}`, {
            headers: { Accept: "application/json" },
        });
    } catch {
        throw new TrackingError(
            "unavailable",
            "Could not reach the tracking service. Please try again.",
        );
    }

    if (response.status === 404) {
        throw new TrackingError("not_found", "No order found for that code.");
    }

    if (!response.ok) {
        throw new TrackingError(
            "unavailable",
            `Tracking service error (${response.status}).`,
        );
    }

    return (await response.json()) as TrackingResult;
}

export async function fetchTracking(rawInput: string): Promise<TrackingResult> {
    const code = extractTrackingCode(rawInput);
    if (!code) {
        throw new TrackingError("not_found", "Enter a tag code or order id.");
    }

    if (/^\d+$/.test(code)) {
        return getJson(`/quotations/${encodeURIComponent(code)}/tracking`);
    }

    return getJson(`/tags/${encodeURIComponent(code)}/tracking`);
}
