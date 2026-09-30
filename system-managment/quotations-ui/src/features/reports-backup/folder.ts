import type { WrittenFile } from './types'

interface PermissionedDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission?: (opts?: { mode: 'readwrite' }) => Promise<string>
  requestPermission?: (opts?: { mode: 'readwrite' }) => Promise<string>
}

type WindowWithPicker = typeof window & { showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle> }

export const FOLDER_ROOT = 'Love Laundry Daily Reports'

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/**
 * Relative path components inside the chosen backup folder:
 *   YYYY / MM-MonthName / YYYY-MM-DD.{pdf|json.gz|json}
 */
export function folderStructure(date: string) {
  const [y, m] = date.split('-').map(Number)
  const monthName = MONTHS[(m || 1) - 1] ?? 'Unknown'
  const monthDir = `${String(m).padStart(2, '0')}-${monthName}`
  return { year: String(y), monthDir, datePrefix: date }
}

/**
 * Same layout for a monthly report: YYYY / MM-MonthName / YYYY-MM.{pdf|json.gz|json}
 */
export function monthFolderStructure(period: string) {
  const [y, m] = period.split('-').map(Number)
  const monthName = MONTHS[(m || 1) - 1] ?? 'Unknown'
  const monthDir = `${String(m).padStart(2, '0')}-${monthName}`
  return { year: String(y), monthDir, period }
}

export async function pickFolder(): Promise<{ handle: FileSystemDirectoryHandle; name: string } | null> {
  const w = window as WindowWithPicker
  if (!isFileSystemAccessSupported() || !w.showDirectoryPicker) return null
  try {
    const handle = await w.showDirectoryPicker({ mode: 'readwrite' })
    return { handle, name: handle.name }
  } catch (err: unknown) {
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'SecurityError')) {
      return null
    }
    throw err
  }
}

export async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<'granted' | 'prompt' | 'denied'> {
  try {
    const permissioned = handle as PermissionedDirectoryHandle
    const opts = { mode: 'readwrite' as const }
    if (permissioned.queryPermission && (await permissioned.queryPermission(opts)) === 'granted') {
      return 'granted'
    }
    if (!permissioned.requestPermission) return 'prompt'
    const granted = (await permissioned.requestPermission(opts)) ?? 'denied'
    return granted === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

export interface FolderCheck {
  ok: boolean
  writable: boolean
  error?: string
}

export async function verifyFolder(handle: FileSystemDirectoryHandle): Promise<FolderCheck> {
  const perm = await ensurePermission(handle)
  if (perm !== 'granted') {
    return { ok: false, writable: false, error: `Permission ${perm}` }
  }
  try {
    const probe = `.__lovelaundry_probe_${Date.now()}`
    const fileHandle = await handle.getFileHandle(probe, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write('ok')
    await writable.close()
    const check = await handle.getFileHandle(probe)
    const file = await check.getFile()
    const text = await file.text()
    await handle.removeEntry(probe)
    return { ok: text === 'ok', writable: true }
  } catch (err: unknown) {
    return { ok: false, writable: false, error: err instanceof Error ? err.message : 'Folder probe failed' }
  }
}

export async function fileExists(handle: FileSystemDirectoryHandle, date: string, name: string): Promise<boolean> {
  const { year, monthDir } = folderStructure(date)
  try {
    const yearDir = await handle.getDirectoryHandle(year)
    const month = await yearDir.getDirectoryHandle(monthDir)
    await month.getFileHandle(name)
    return true
  } catch {
    return false
  }
}

export async function checkExisting(handle: FileSystemDirectoryHandle, date: string): Promise<string[]> {
  const names = [`${date}.pdf`, `${date}.json.gz`, `${date}.json`]
  const found: string[] = []
  for (const name of names) {
    if (await fileExists(handle, date, name)) found.push(name)
  }
  return found
}

export async function checkExistingMonth(handle: FileSystemDirectoryHandle, period: string): Promise<string[]> {
  const names = [`${period}.pdf`, `${period}.json.gz`, `${period}.json`]
  const found: string[] = []
  for (const name of names) {
    if (await fileExists(handle, `${period}-01`, name)) found.push(name)
  }
  return found
}

async function writeBlob(
  monthDir: FileSystemDirectoryHandle,
  name: string,
  blob: Blob,
  overwrite: boolean
): Promise<WrittenFile> {
  const fileHandle = await monthDir.getFileHandle(name, { create: true })
  const existed = overwrite
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
  return { name, size: blob.size, overwritten: existed }
}

export interface WriteDailyFilesInput {
  date: string
  pdf?: Blob
  jsonGz?: Blob
  jsonPlain?: Blob
}

/**
 * Writes the daily files under <handle>/<year>/<monthDir>/.
 * Returns written files; one entry disappears if its blob is not provided.
 */
export async function writeDailyFiles(
  handle: FileSystemDirectoryHandle,
  input: WriteDailyFilesInput
): Promise<WrittenFile[]> {
  const { year, monthDir } = folderStructure(input.date)
  const yearDir = await handle.getDirectoryHandle(year, { create: true })
  const month = await yearDir.getDirectoryHandle(monthDir, { create: true })

  const written: WrittenFile[] = []
  if (input.pdf) written.push(await writeBlob(month, `${input.date}.pdf`, input.pdf, true))
  if (input.jsonGz) written.push(await writeBlob(month, `${input.date}.json.gz`, input.jsonGz, true))
  if (input.jsonPlain) written.push(await writeBlob(month, `${input.date}.json`, input.jsonPlain, true))
  return written
}

export interface WriteMonthFilesInput {
  period: string
  pdf?: Blob
  jsonGz?: Blob
  jsonPlain?: Blob
}

/**
 * Writes the monthly files under <handle>/<year>/<monthDir>/ with the naming
 * YYYY-MM.{pdf|json.gz|json}.
 */
export async function writeMonthFiles(
  handle: FileSystemDirectoryHandle,
  input: WriteMonthFilesInput
): Promise<WrittenFile[]> {
  const { year, monthDir } = monthFolderStructure(input.period)
  const yearDir = await handle.getDirectoryHandle(year, { create: true })
  const month = await yearDir.getDirectoryHandle(monthDir, { create: true })

  const written: WrittenFile[] = []
  if (input.pdf) written.push(await writeBlob(month, `${input.period}.pdf`, input.pdf, true))
  if (input.jsonGz) written.push(await writeBlob(month, `${input.period}.json.gz`, input.jsonGz, true))
  if (input.jsonPlain) written.push(await writeBlob(month, `${input.period}.json`, input.jsonPlain, true))
  return written
}