import Dexie, { type Table } from 'dexie'
import type { DailyReportSnapshot } from './types'

interface ReportsKvRow {
  key: string
  value: unknown
  updated_at: number
}

export interface LastBackupMeta {
  report_date: string
  period_kind?: 'day' | 'month'
  started_at: string
  finished_at: string
  folder_name: string
  files: { name: string; size: number }[]
  modes: ('pdf' | 'json')[]
  snapshot_summary: {
    income: number
    expenses: number
    net: number
    sources_ok: number
    sources_total: number
  }
}

class ReportsDb extends Dexie {
  kv!: Table<ReportsKvRow, string>

  constructor() {
    super('lovelaundry_reports')
    this.version(1).stores({ kv: 'key' })
  }
}

const db = new ReportsDb()

async function getStoreValue(key: string): Promise<unknown> {
  const row = await db.kv.get(key)
  return row?.value
}

export async function getFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const value = await getStoreValue('folder_handle')
  if (value && typeof value === 'object' && 'queryPermission' in value) {
    return value as unknown as FileSystemDirectoryHandle
  }
  return null
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await db.kv.put({ key: 'folder_handle', value: handle, updated_at: Date.now() })
}

export async function getFolderName(): Promise<string | null> {
  const value = await getStoreValue('folder_name')
  return typeof value === 'string' ? value : null
}

export async function saveFolderName(name: string): Promise<void> {
  await db.kv.put({ key: 'folder_name', value: name, updated_at: Date.now() })
}

export async function getFolderConfiguredAt(): Promise<number | null> {
  const value = await getStoreValue('folder_configured_at')
  return typeof value === 'number' ? value : null
}

export async function saveFolderConfiguredAt(at: number): Promise<void> {
  await db.kv.put({ key: 'folder_configured_at', value: at, updated_at: Date.now() })
}

export async function getLastBackup(): Promise<LastBackupMeta | null> {
  const value = await getStoreValue('last_backup')
  return value as LastBackupMeta | null
}

export async function saveLastBackup(meta: LastBackupMeta): Promise<void> {
  await db.kv.put({ key: 'last_backup', value: meta, updated_at: Date.now() })
}

export type { DailyReportSnapshot }