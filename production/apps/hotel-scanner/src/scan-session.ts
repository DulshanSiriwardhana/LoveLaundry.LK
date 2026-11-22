/** Pure helpers for one hotel-side scanning session.
 *
 * Kept independent of React and the network so the counters and category
 * logic can be unit tested. The server remains the source of truth: these
 * helpers only shape what the operator sees before/after a scan is submitted.
 */
import type { TransitionCatalogue } from "./api";

export type ScanCategory =
  | "bath_towel"
  | "pool_towel"
  | "single_bedsheet"
  | "double_bedsheet"
  | "other";

export interface ScanRow {
  code: string;
  outcome: "queued" | "accepted" | "duplicate" | "error";
  category?: ScanCategory;
  verified?: boolean;
  status?: string;
  /** Informational text shown to the operator (verification notes, live updates). */
  message?: string;
  /** Set only when an admin transition rule forbids this scan. Blocks submit. */
  blocked?: boolean;
  at: number;
}

export interface SessionSummary {
  total: number;
  distinct: number;
  bathTowels: number;
  poolTowels: number;
  singleBedsheets: number;
  doubleBedsheets: number;
  other: number;
  verified: number;
  errors: number;
}

const CODE_PARAM = /[?&#](?:code|linen_id|linen|tag|id)=([^&#\s]+)/i;
const LL_TOKEN = /\bLL-[A-Za-z0-9][A-Za-z0-9._-]*/;
const CODE_SHAPE = /^[A-Z0-9][A-Z0-9._-]{1,63}$/;
const CODE_IN_URL = /^LL-[A-Z0-9][A-Z0-9._-]*$/;
const WRAPPERS = /^[\s"'`<([{]+|[\s"'`>)[\]}]+$/g;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function percentDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Extract the canonical linen code from a bare tag, a deep link, or label
 * text. Mirrors the quotations/mobile parser so every scanner reads tags the
 * same way. Returns null when the payload is not a linen tag (e.g. an EPC). */
export function parseLinenCode(raw: string | null | undefined): string | null {
  const original = (raw ?? "").replace(CONTROL_CHARS, " ").replace(WRAPPERS, "").trim();
  if (!original) return null;

  const fromUrl = original.includes("://") || original.toLowerCase().startsWith("www.");
  let candidate = original;

  const param = CODE_PARAM.exec(original);
  if (param) {
    candidate = percentDecode(param[1]);
  } else if (fromUrl) {
    const segments = original.split(/[?#]/)[0].split("/").filter(Boolean);
    if (segments.length) candidate = percentDecode(segments[segments.length - 1]);
  }

  candidate = candidate.replace(CONTROL_CHARS, " ").replace(WRAPPERS, "").trim().toUpperCase();
  if (fromUrl ? CODE_IN_URL.test(candidate) : CODE_SHAPE.test(candidate)) return candidate;

  const embedded = LL_TOKEN.exec(original.toUpperCase());
  return embedded ? embedded[0].replace(/[._-]+$/, "") : null;
}

/** Canonical code for a tag, falling back to the cleaned raw value so RFID/EPC
 * identifiers that are not LL-codes still flow through unchanged. */
export function normaliseCode(raw: string): string {
  return parseLinenCode(raw) ?? (raw ?? "").replace(CONTROL_CHARS, " ").trim().toUpperCase();
}

export function classifyLinen(row: {
  category?: string;
  item_type?: string;
  description?: string;
  size?: string;
}): ScanCategory {
  const text = [row.category, row.item_type, row.description, row.size]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  const isBathMat = /\bBATH[\s_-]*MAT\b/.test(text);
  if (/TOWEL/.test(text)) {
    if (/POOL/.test(text)) return "pool_towel";
    if (/BATH/.test(text) && !isBathMat) return "bath_towel";
  }
  if (/SHEET/.test(text)) {
    if (/DOUBLE|QUEEN|KING/.test(text)) return "double_bedsheet";
    if (/SINGLE|TWIN/.test(text)) return "single_bedsheet";
  }
  return "other";
}

export function summarise(rows: ScanRow[]): SessionSummary {
  const summary: SessionSummary = {
    total: rows.length,
    distinct: 0,
    bathTowels: 0,
    poolTowels: 0,
    singleBedsheets: 0,
    doubleBedsheets: 0,
    other: 0,
    verified: 0,
    errors: rows.filter((r) => r.outcome === "error").length,
  };

  // One linen can be read many times (a re-read or a duplicate). Keep the
  // newest row per code so its verification proof and category win, then count
  // each code once — matching the summary cards in the quotations scanner.
  const unique = new Map<string, ScanRow>();
  for (const row of rows) {
    if (row.outcome === "error") continue;
    const existing = unique.get(row.code);
    if (!existing || row.at >= existing.at) unique.set(row.code, row);
  }

  for (const row of unique.values()) {
    summary.distinct += 1;
    if (row.verified) summary.verified += 1;
    switch (row.category) {
      case "bath_towel":
        summary.bathTowels += 1;
        break;
      case "pool_towel":
        summary.poolTowels += 1;
        break;
      case "single_bedsheet":
        summary.singleBedsheets += 1;
        break;
      case "double_bedsheet":
        summary.doubleBedsheets += 1;
        break;
      default:
        summary.other += 1;
    }
  }
  return summary;
}

/** Human reason a move is not allowed, or null when it is fine. */
export function transitionViolation(
  catalogue: TransitionCatalogue | null,
  fromStatus: string | undefined,
  toStatus: string,
): string | null {
  const rules = catalogue?.transition_rules || [];
  if (!rules.length || !fromStatus) return null;
  const rule = rules.find((r) => r.from_status === fromStatus);
  if (!rule || rule.to_statuses.includes(toStatus)) return null;
  return `Cannot move linen from ${fromStatus.toLowerCase()} to ${toStatus.toLowerCase()}`;
}
