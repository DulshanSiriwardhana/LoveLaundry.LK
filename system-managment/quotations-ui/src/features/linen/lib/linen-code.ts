/**
 * Turns whatever a scanned tag carries into the identifier
 * `/linens/by-code/{code}` and `POST /linens/bulk-scan` expect, or `null` when
 * the text is not a current linen tag.
 *
 * A printed tag holds the bare structured ID (`BSG-A0001XY`). A tag that has
 * been through a phone wallet, a re-printed label, or a Bluetooth scanner in
 * keyboard mode arrives as a deep link, a quoted string, or with control bytes
 * glued on. This is a port of `parseLinenCode` in the mobile scanner so both
 * clients accept and reject the same payloads. Legacy LL-xxxxxx labels and the
 * earlier numeric IDs are deliberately rejected: only checksummed tags are
 * valid now.
 */
const CODE_PARAM = /[?&#](?:code|linen_id|linen|tag|id)=([^&#\s]+)/i
const STRUCTURED_ID = /^([A-Z]{2}[A-Z0-9]{1,5})-([A-Z])(\d{4})([A-Z]{2})$/
/** Matches a whole tag inside partly-read label text. */
const TAG_TOKEN = /\b[A-Z]{2}[A-Z0-9]{1,5}-[A-Z]\d{4}[A-Z]{2}\b/
const WRAPPERS = /^[\s"'`<([{]+|[\s"'`>)[\]}]+$/g
/** NFC/keyboard artefacts: NUL, the URI-record status byte, CR/LF and TAB. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

/** Two check letters: weighted mod-676 over the tag base, same as both APIs. */
export function checkLetters(base: string): string {
  const text = base.replace(/-/g, '').toUpperCase()
  let total = 0
  for (let index = 0; index < text.length; index += 1) {
    total += (index + 1) * text.charCodeAt(index)
  }
  const value = total % 676
  return String.fromCharCode(65 + Math.floor(value / 26), 65 + (value % 26))
}

export function isValidStructuredId(value: string): boolean {
  const match = STRUCTURED_ID.exec(value.trim().toUpperCase())
  if (!match) return false
  const [, prefix, series, digits, check] = match
  const number = Number(digits)
  if (number < 1 || number > 9999) return false
  return check === checkLetters(`${prefix}-${series}${digits}`)
}

export function parseLinenCode(raw: string | null | undefined): string | null {
  const original = (raw ?? '').replace(CONTROL_CHARS, ' ').replace(WRAPPERS, '').trim()
  if (!original) return null

  const fromUrl = original.includes('://') || original.toLowerCase().startsWith('www.')
  let candidate = original

  const param = CODE_PARAM.exec(original)
  if (param) {
    candidate = percentDecode(param[1])
  } else if (fromUrl) {
    // In a deep link the code is the last path segment; anything after a query
    // string or fragment belongs to the link, not to the tag.
    const segments = original.split(/[?#]/)[0].split('/').filter(Boolean)
    if (segments.length) candidate = percentDecode(segments[segments.length - 1])
  }

  candidate = candidate.replace(CONTROL_CHARS, ' ').replace(WRAPPERS, '').trim().toUpperCase()
  if (isValidStructuredId(candidate)) return candidate

  // A partly-read tag still identifies the piece: pull the code out of the
  // surrounding label text instead of rejecting the whole scan.
  const embedded = TAG_TOKEN.exec(original.toUpperCase())
  return embedded && isValidStructuredId(embedded[0]) ? embedded[0] : null
}

function percentDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
