import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarBlank,
  CheckCircle,
  CloudArrowDown,
  Database,
  FileArchive,
  FilePdf,
  FolderSimplePlus,
  FolderSimple,
  GearSix,
  LockKey,
  MagnifyingGlass,
  ShieldCheck,
  Triangle,
  WarningCircle,
} from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Breadcrumb } from '../../components/ui/breadcrumb'
import { Button } from '../../components/ui/button'
import { collectDaySnapshot, REPORT_SOURCES } from './collect-snapshot'
import { collectMonthSnapshot } from './collect-month-snapshot'
import { buildVerifiedJsonBackup, supportsGzip } from './json-backup'
import { generateReportPdf } from './pdf-report'
import { generateMonthReportPdf } from './pdf-month-report'
import {
  checkExisting,
  checkExistingMonth,
  folderStructure,
  isFileSystemAccessSupported,
  monthFolderStructure,
  pickFolder,
  verifyFolder,
  writeDailyFiles,
  writeMonthFiles,
  type FolderCheck,
} from './folder'
import {
  getFolderConfiguredAt,
  getFolderHandle,
  getFolderName,
  getLastBackup,
  saveFolderConfiguredAt,
  saveFolderHandle,
  saveFolderName,
  saveLastBackup,
  type LastBackupMeta,
} from './folder-store'
import type { DailyReportSnapshot, MonthlyReportSnapshot, WrittenFile } from './types'

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function currentMonth(): string {
  return todayStr().slice(0, 7)
}

function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

function fmtDate(value: string): string {
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function logLinesKey(finished: boolean) {
  return finished ? 'line-clamp-6' : ''
}

interface RunResult {
  periodKind: 'day' | 'month'
  snapshot: DailyReportSnapshot | MonthlyReportSnapshot
  files: WrittenFile[]
  modes: ('pdf' | 'json')[]
  finishedAt: string
  downloadOnly: boolean
}

export default function ReportsBackupPage() {
  const fsSupported = isFileSystemAccessSupported()

  const [folder, setFolder] = useState<{ name: string; configuredAt?: number } | null>(null)
  const [folderCheck, setFolderCheck] = useState<FolderCheck | null>(null)
  const [periodKind, setPeriodKind] = useState<'day' | 'month'>('day')
  const [date, setDate] = useState(todayStr())
  const [month, setMonth] = useState(currentMonth())
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [existing, setExisting] = useState<string[]>([])
  const [result, setResult] = useState<RunResult | null>(null)
  const [lastBackup, setLastBackup] = useState<LastBackupMeta | null>(null)

  useEffect(() => {
    ;(async () => {
      const handle = await getFolderHandle()
      if (handle) {
        const name = (await getFolderName()) ?? handle.name
        const configuredAt = await getFolderConfiguredAt()
        setFolder({ name, configuredAt: configuredAt ?? undefined })
        const check = await verifyFolder(handle)
        setFolderCheck(check)
      }
      setLastBackup(await getLastBackup())
    })()
  }, [])

  const structure = useMemo(
    () => (periodKind === 'day' ? folderStructure(date) : monthFolderStructure(month)),
    [periodKind, date, month]
  )
  const gzipSupported = supportsGzip()

  const appendLog = (line: string) => setLog(prev => [...prev, line])

  async function chooseFolder() {
    try {
      const picked = await pickFolder()
      if (!picked) return
      await saveFolderHandle(picked.handle)
      await saveFolderName(picked.name)
      await saveFolderConfiguredAt(Date.now())
      setFolder({ name: picked.name, configuredAt: Date.now() })
      const check = await verifyFolder(picked.handle)
      setFolderCheck(check)
      toast.success(`Backup folder set: ${picked.name}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not pick a folder')
    }
  }

  async function recheckFolder() {
    const handle = await getFolderHandle()
    if (!handle) {
      toast.error('No folder selected yet')
      return
    }
    const check = await verifyFolder(handle)
    setFolderCheck(check)
    toast.success(check.ok ? 'Folder is writable' : `Folder check failed: ${check.error ?? 'n/a'}`)
  }

  async function findExisting() {
    const handle = await getFolderHandle()
    if (!handle) {
      toast.error('No folder selected yet')
      return
    }
    const found = periodKind === 'day' ? await checkExisting(handle, date) : await checkExistingMonth(handle, month)
    setExisting(found)
    if (found.length === 0) toast.success('No files yet for this period')
  }

  async function run(mode: 'pdf' | 'json' | 'both') {
    if (busy) return
    setBusy(true)
    setLog([])
    setResult(null)
    const startedAt = new Date().toISOString()
    const startedAtText = startedAt.replace('T', ' ').slice(0, 19)
    try {
      appendLog(`Started at ${startedAtText} (UTC)`)
      const isMonth = periodKind === 'month'
      appendLog(`Generating ${isMonth ? 'MONTHLY' : 'daily'} report for ${isMonth ? month : date} —${mode === 'both' ? ' PDF + JSON' : mode === 'pdf' ? ' PDF' : ' JSON'}`)

      appendLog(`Collecting ${isMonth ? 'monthly' : 'daily'} snapshot…`)
      const snapshot = isMonth ? await collectMonthSnapshot(month) : await collectDaySnapshot(date)
      const okCount = snapshot.sources.filter(s => s.ok).length
      appendLog(
        `Snapshot ready: ${okCount}/${snapshot.sources.length} sources` +
          (snapshot.sources.some(s => !s.ok) ? ` (unavailable: ${snapshot.sources.filter(s => !s.ok).map(s => s.label).join(', ')})` : '')
      )
      for (const s of snapshot.sources) {
        appendLog(
          `  ${s.ok ? 'ok  ' : 'FAIL'} ${s.label}: fetched ${s.fetched} → kept ${s.count}${s.error ? ` (${s.error})` : ''}`
        )
      }
      appendLog(`API bases → ${snapshot.meta.api_bases.mgmt_api} · ${snapshot.meta.api_bases.bills_api}`)
      appendLog(`Ledger: income ${fmtMoney(snapshot.totals.income)} • expenses ${fmtMoney(snapshot.totals.expenses)} • net ${fmtMoney(snapshot.totals.net)}`)

      const filePrefix = isMonth ? month : date
      const files: WrittenFile[] = []
      const modesUsed: ('pdf' | 'json')[] = []
      let pdfBlob: Blob | undefined
      let jsonBack: Awaited<ReturnType<typeof buildVerifiedJsonBackup>> | null = null

      if (mode === 'pdf' || mode === 'both') {
        appendLog('Building PDF (pdfmake)…')
        pdfBlob = isMonth
          ? await generateMonthReportPdf(snapshot as MonthlyReportSnapshot)
          : await generateReportPdf(snapshot as DailyReportSnapshot)
        appendLog(`PDF ready: ${fmtBytes(pdfBlob.size)}`)
        files.push({ name: `${filePrefix}.pdf`, size: pdfBlob.size, overwritten: false })
        modesUsed.push('pdf')
      }

      if (mode === 'json' || mode === 'both') {
        appendLog('Building JSON backup' + (gzipSupported ? ' + gzip' : ' (no gzip in this browser)') + '…')
        jsonBack = await buildVerifiedJsonBackup(snapshot)
        if (!jsonBack.ok) {
          appendLog(`JSON failed verification: ${jsonBack.error ?? 'unknown'}`)
          toast.error(`JSON backup failed: ${jsonBack.error ?? 'n/a'}`)
          return
        }
        if (jsonBack.gz) {
          appendLog(`JSON.gz ready: ${fmtBytes(jsonBack.gz.size)} (round-trip verified)`)
          files.push({ name: `${filePrefix}.json.gz`, size: jsonBack.gz.size, overwritten: false })
        } else {
          appendLog(`JSON ready: ${fmtBytes(jsonBack.jsonBlob.size)} (plain .json)`)
          files.push({ name: `${filePrefix}.json`, size: jsonBack.jsonBlob.size, overwritten: false })
        }
        modesUsed.push('json')
      }

      const folderHandle = await getFolderHandle()
      const existingFor =
        existing.length > 0
          ? existing
          : await (folderHandle
              ? isMonth
                ? checkExistingMonth(folderHandle, month)
                : checkExisting(folderHandle, date)
              : [])

      if (!folderHandle) {
        if (pdfBlob) {
          downloadBlob(pdfBlob, `${filePrefix}.pdf`)
          appendLog(`Downloaded ${filePrefix}.pdf (no folder selected)`)
        }
        if (jsonBack) {
          downloadBlob(jsonBack.gz ?? jsonBack.jsonBlob, jsonBack.gz ? `${filePrefix}.json.gz` : `${filePrefix}.json`)
          appendLog(`Downloaded ${jsonBack.gz ? `${filePrefix}.json.gz` : `${filePrefix}.json`}`)
        }
        appendLog('No backup folder — files were downloaded instead')
        setResult({
          periodKind,
          snapshot,
          files,
          modes: modesUsed,
          finishedAt: new Date().toISOString(),
          downloadOnly: true,
        })
        toast.success('Files downloaded')
        return
      }

      if (existingFor.length > 0) {
        appendLog(`Overwriting existing: ${existingFor.join(', ')}`)
      }
      appendLog(`Writing into ${folder?.name ?? ''}/${structure.year}/${structure.monthDir}…`)

      const writtenFiles = isMonth
        ? await writeMonthFiles(folderHandle, {
            period: month,
            pdf: pdfBlob,
            jsonGz: jsonBack?.gz ?? undefined,
            jsonPlain: jsonBack && !jsonBack.gz ? jsonBack.jsonBlob : undefined,
          })
        : await writeDailyFiles(folderHandle, {
            date,
            pdf: pdfBlob,
            jsonGz: jsonBack?.gz ?? undefined,
            jsonPlain: jsonBack && !jsonBack.gz ? jsonBack.jsonBlob : undefined,
          })

      const finishedAt = new Date().toISOString()
      appendLog(`Done at ${finishedAt.replace('T', ' ').slice(0, 19)} (UTC)`)
      setResult({ periodKind, snapshot, files: writtenFiles, modes: modesUsed, finishedAt, downloadOnly: false })

      const meta: LastBackupMeta = {
        report_date: filePrefix,
        period_kind: periodKind,
        started_at: startedAt,
        finished_at: finishedAt,
        folder_name: folder?.name ?? '',
        files: writtenFiles.map(f => ({ name: f.name, size: f.size })),
        modes: modesUsed,
        snapshot_summary: {
          income: snapshot.totals.income,
          expenses: snapshot.totals.expenses,
          net: snapshot.totals.net,
          sources_ok: okCount,
          sources_total: snapshot.sources.length,
        },
      }
      setLastBackup(meta)
      await saveLastBackup(meta)
      toast.success(`${isMonth ? 'Monthly' : 'Daily'} report saved (${files.map(f => f.name).join(', ')})`)
    } catch (err: unknown) {
      appendLog(`Error: ${err instanceof Error ? err.message : 'Unknown failure'}`)
      toast.error(err instanceof Error ? err.message : 'Report generation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'System' }, { label: 'Reports & Backup' }]} />

      <div>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
            <Database className="h-4 w-4 text-[#2563EB]" />
          </div>
          <h1 className="text-dashboard-title">Reports &amp; Backup</h1>
        </div>
        <p className="text-[13px] mt-0.5 text-[#98A2B3]">
          Generate a daily PDF report (with a full month view too) and a machine-readable JSON backup of every business
          area, filed under <span className="font-medium text-[#475467]">{structure.year}/{structure.monthDir}/</span> in
          your chosen folder.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#92400E]">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>
          Admin-only. This browser feature uses the File System Access API (Chrome / Edge) to write the selected
          folder. The folder choice is remembered by this browser only — on a new machine, re-select the folder once.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Backup folder ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderSimple className="h-4 w-4" />
              Backup Folder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!fsSupported && (
              <div className="flex items-start gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3">
                <WarningCircle className="h-4 w-4 text-[#DC2626] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[#B91C1C]">
                  This browser does not support writing to a folder. Use Chrome or Edge to save files into a chosen
                  folder; otherwise backups will be downloaded instead.
                </p>
              </div>
            )}

            {folder ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
                  <CheckCircle className="h-4 w-4 text-[#16A34A] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111827] truncate">{folder.name}</p>
                    <p className="text-[11px] text-[#6B7280]">
                      {folder.configuredAt ? `Configured ${new Date(folder.configuredAt).toLocaleString()}` : 'Configured on this browser'}
                      {folderCheck?.ok ? ' • writable' : folderCheck ? ` • ${folderCheck.error ?? 'check needed'}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={chooseFolder}>
                    <FolderSimplePlus className="mr-1 h-4 w-4" /> Change folder
                  </Button>
                  <Button variant="secondary" size="sm" onClick={recheckFolder}>
                    <GearSix className="mr-1 h-4 w-4" /> Verify access
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                  <MagnifyingGlass className="h-4 w-4 text-[#6B7280] mt-0.5 shrink-0" />
                  <p className="text-[12px] text-[#374151]">
                    Pick the folder that should hold your reports, e.g.{' '}
                    <span className="font-medium">D:\LoveLaundry\Data\Reports</span>. Reports are filed as
                    YYYY/MM-Month/YYYY-MM-DD.pdf + .json.gz (daily) and YYYY-MM.pdf + .json.gz (monthly) underneath it.
                  </p>
                </div>
                <Button size="sm" onClick={chooseFolder} disabled={!fsSupported}>
                  <FolderSimplePlus className="mr-1 h-4 w-4" /> Choose folder
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Generate ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudArrowDown className="h-4 w-4" />
              Generate Daily Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-1">
              <button
                type="button"
                onClick={() => {
                  setPeriodKind('day')
                  setExisting([])
                }}
                className={`h-7 rounded-md text-[12px] font-medium transition-colors ${
                  periodKind === 'day' ? 'bg-white shadow-sm text-[#111827]' : 'text-[#98A2B3]'
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodKind('month')
                  setExisting([])
                }}
                className={`h-7 rounded-md text-[12px] font-medium transition-colors ${
                  periodKind === 'month' ? 'bg-white shadow-sm text-[#111827]' : 'text-[#98A2B3]'
                }`}
              >
                Month
              </button>
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-[#475467]">
                <CalendarBlank className="h-3.5 w-3.5" /> Report {periodKind === 'day' ? 'date' : 'month'}
              </label>
              {periodKind === 'day' ? (
                <input
                  type="date"
                  value={date}
                  max={todayStr()}
                  onChange={e => {
                    setDate(e.target.value || todayStr())
                    setExisting([])
                  }}
                  className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
              ) : (
                <input
                  type="month"
                  value={month}
                  max={currentMonth()}
                  onChange={e => {
                    setMonth(e.target.value || currentMonth())
                    setExisting([])
                  }}
                  className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={findExisting} disabled={busy || !folder}>
                Check existing files
              </Button>
              {existing.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {existing.map(name => (
                    <span key={name} className="rounded-md border border-[#FCD34D] bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-medium text-[#92400E]">
                      {name} · will overwrite
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="secondary" onClick={() => run('pdf')} disabled={busy || !folder}>
                <FilePdf className="mr-1.5 h-4 w-4" /> PDF only
              </Button>
              <Button variant="secondary" onClick={() => run('json')} disabled={busy || !folder}>
                <FileArchive className="mr-1.5 h-4 w-4" /> JSON only
              </Button>
              <Button onClick={() => run('both')} disabled={busy || !folder}>
                <CloudArrowDown className="mr-1.5 h-4 w-4" /> PDF + JSON
              </Button>
            </div>

            <p className="text-[11px] text-[#98A2B3]">
              {gzipSupported
                ? 'JSON backups are gzipped (.json.gz) and round-trip verified before saving.'
                : 'Gzip is not available in this browser — the JSON backup will be saved as plain .json.'}
            </p>

            {log.length > 0 && (
              <div className="rounded-lg border border-[#E5E7EB] bg-[#111827] p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Run log</p>
                <div className={`${logLinesKey(false)} overflow-x-auto`}>
                  {log.map((line, i) => (
                    <p key={i} className="text-[11.5px] leading-5 font-mono text-[#D1D5DB]">
                      <span className="text-[#6B7280]">{String(i + 1).padStart(2, '0')}</span> {line}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {busy && (
              <div className="flex items-center gap-2 text-[12px] text-[#475467]">
                <Triangle className="h-3.5 w-3.5 animate-spin text-[#DC2626]" />
                Working…
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Last backup & run output ───────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKey className="h-4 w-4" />
              Last Backup
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastBackup ? (
              <div className="space-y-2 text-[13px]">
                <p className="text-[#111827]">
                  <span className="font-medium">
                    {lastBackup.period_kind === 'month'
                      ? monthLabel(lastBackup.report_date)
                      : fmtDate(lastBackup.report_date)}
                  </span>{' '}
                  <span className="text-[#98A2B3]"> · {lastBackup.finished_at.replace('T', ' ').slice(11, 19)} UTC</span>
                </p>
                <p className="text-[#475467]">
                  Net {fmtMoney(lastBackup.snapshot_summary.net)} ({fmtMoney(lastBackup.snapshot_summary.income)} income −{' '}
                  {fmtMoney(lastBackup.snapshot_summary.expenses)} expenses)
                </p>
                <p className="text-[12px] text-[#98A2B3]">
                  {lastBackup.snapshot_summary.sources_ok}/{lastBackup.snapshot_summary.sources_total} data sources · {lastBackup.modes.join(' + ')}
                </p>
                <ul className="space-y-1">
                  {lastBackup.files.map(f => (
                    <li key={f.name} className="flex items-center justify-between rounded-md border border-[#E5E7EB] px-2 py-1 text-[12px]">
                      <span className="font-mono text-[#6B7280]">{f.name}</span>
                      <span className="text-[#475467]">{fmtBytes(f.size)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[13px] text-[#98A2B3]">No backup has been generated yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudArrowDown className="h-4 w-4" />
              Data Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <StatBox label="Income" value={fmtMoney(result.snapshot.totals.income)} tone="green" />
                  <StatBox label="Expenses" value={fmtMoney(result.snapshot.totals.expenses)} tone="red" />
                  <StatBox label="Net" value={fmtMoney(result.snapshot.totals.net)} tone="red" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.snapshot.sources.map(s => (
                    <span
                      key={s.key}
                      title={s.error ?? s.label}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        s.ok
                          ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]'
                          : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]'
                      }`}
                    >
                      {s.ok ? <CheckCircle className="h-3 w-3" /> : <WarningCircle className="h-3 w-3" />}
                      {s.label} {s.ok ? `· ${s.fetched}→${s.count}` : '· failed'}
                    </span>
                  ))}
                </div>
                {result.downloadOnly && (
                  <p className="text-[12px] text-[#B45309]">Files were downloaded instead of written to a folder.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[13px] text-[#98A2B3]">
                  Run a generation to see which data sources were included for that day.
                </p>
                <ul className="grid grid-cols-1 gap-1 text-[12px] text-[#475467] sm:grid-cols-2">
                  {REPORT_SOURCES.map(s => (
                    <li key={s.key} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#D1D5DB]" />
                      {s.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatBox({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-[#15803D]' : 'text-[#DC2626]'
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-center">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">{label}</p>
      <p className={`mt-0.5 text-[15px] font-bold ${color}`}>{value}</p>
    </div>
  )
}

function fmtMoney(n: number): string {
  return `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}