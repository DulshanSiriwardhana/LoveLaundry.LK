export function supportsGzip(): boolean {
  return (
    typeof CompressionStream !== 'undefined' &&
    typeof DecompressionStream !== 'undefined'
  )
}

export interface JsonBackupOutput {
  json: string
  jsonBlob: Blob
  gz: Blob | null
  gzip: boolean
  ok: boolean
  error?: string
}

export function snapshotToJson(snapshot: unknown): JsonBackupOutput {
  const json = JSON.stringify(snapshot, null, 2)
  const jsonBlob = new Blob([json], { type: 'application/json;charset=utf-8' })
  return { json, jsonBlob, gz: null, gzip: false, ok: true }
}

async function gzipBlob(input: Blob): Promise<Blob> {
  const response = new Response(input.stream().pipeThrough(new CompressionStream('gzip')))
  return response.blob()
}

export async function verifyGzipBlob(
  compressed: Blob,
  expectedText: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = new Response(compressed.stream().pipeThrough(new DecompressionStream('gzip')))
    const restoredText = await response.text()
    const parsed: unknown = JSON.parse(restoredText)
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Gzip did not restore a JSON document' }
    }
    if (restoredText.length !== expectedText.length) {
      return { ok: false, error: 'Gzip round-trip length mismatch' }
    }
    return { ok: true }
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gzip round-trip verification failed',
    }
  }
}

/**
 * Builds the JSON backup, gzip-compresses it (when supported) and verifies the
 * gzip round-trip before the compressed blob may be written to disk.
 */
export async function buildVerifiedJsonBackup(snapshot: unknown): Promise<JsonBackupOutput> {
  const out = snapshotToJson(snapshot)

  if (!supportsGzip()) {
    return out
  }

  try {
    const gz = await gzipBlob(out.jsonBlob)
    const check = await verifyGzipBlob(gz, out.json)
    if (!check.ok) {
      return {
        json: out.json,
        jsonBlob: out.jsonBlob,
        gz: null,
        gzip: false,
        ok: false,
        error: check.error,
      }
    }
    return { json: out.json, jsonBlob: out.jsonBlob, gz, gzip: true, ok: true }
  } catch (err: unknown) {
    return {
      json: out.json,
      jsonBlob: out.jsonBlob,
      gz: null,
      gzip: false,
      ok: false,
      error: err instanceof Error ? err.message : 'Compression failed',
    }
  }
}