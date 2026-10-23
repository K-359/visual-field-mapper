import type { MeasurementResult, Settings } from './types'
import { EYE_LABEL, isPointResult } from './types'

/** 保存される 1 回ぶんの測定記録 */
export interface HistoryRecord {
  id: string
  /** 保存日時 (ISO 8601) */
  savedAt: string
  settings: Settings
  results: MeasurementResult[]
}

const STORAGE_KEY = 'visual-field-mapper-history'
/**
 * 古い記録から削除して、この件数までに抑える。1件は約7千文字なので、
 * localStorage の容量（ブラウザにより約250万〜500万文字）に収まる件数にしている
 */
export const MAX_RECORDS = 300

function isRecord(value: unknown): value is HistoryRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.savedAt === 'string' &&
    typeof r.settings === 'object' &&
    r.settings !== null &&
    Array.isArray(r.results)
  )
}

/** 履歴を新しい順に読み込む。壊れたデータは黙って捨てる */
export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecord)
  } catch {
    return []
  }
}

/** 履歴を保存する。プライベートブラウズや容量不足で保存できなければ false */
function persist(records: HistoryRecord[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    return true
  } catch {
    return false
  }
}

/** 測定結果を履歴の先頭に保存する */
export function addRecord(
  settings: Settings,
  results: MeasurementResult[],
): HistoryRecord {
  const record: HistoryRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    settings,
    results,
  }
  const records = [record, ...loadHistory()].slice(0, MAX_RECORDS)
  persist(records)
  return record
}

/** 指定 id の記録を削除し、削除後の一覧を返す */
export function deleteRecord(id: string): HistoryRecord[] {
  const records = loadHistory().filter((r) => r.id !== id)
  persist(records)
  return records
}

/** 書き出したファイルを見分けるための識別子と、ファイル形式の版 */
const BACKUP_FORMAT = 'visual-field-mapper-history'
const BACKUP_VERSION = 1

interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  /** 書き出した日時 (ISO 8601) */
  exportedAt: string
  records: HistoryRecord[]
}

/** 記録をバックアップ用の JSON 文字列にする */
export function createBackup(records: HistoryRecord[]): string {
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    records,
  }
  return JSON.stringify(backup, null, 2)
}

/** ファイル名に使う日時（例: 20261023-1430） */
function fileTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  )
}

/** 全件を書き出すときのファイル名 */
export function backupFileName(): string {
  return `visual-field-history-${fileTimestamp(new Date())}.json`
}

/** 1件だけ書き出すときのファイル名。測定日時と眼を含める */
export function recordFileName(record: HistoryRecord): string {
  return `visual-field-${fileTimestamp(new Date(record.savedAt))}-${record.settings.eye}.json`
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isOptionalNumber = (value: unknown) =>
  value === undefined || isFiniteNumber(value)

function isValidResult(value: unknown): value is MeasurementResult {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  if ('xDeg' in r) {
    return (
      isFiniteNumber(r.xDeg) &&
      isFiniteNumber(r.yDeg) &&
      isFiniteNumber(r.radiusDeg) &&
      isOptionalNumber(r.sampleCount) &&
      isOptionalNumber(r.maxRadiusDeg)
    )
  }
  return (
    isFiniteNumber(r.dirDeg) &&
    isFiniteNumber(r.maxDeg) &&
    (r.boundaryDeg === null || isFiniteNumber(r.boundaryDeg))
  )
}

/**
 * 読み込むファイルは手で書き換えられている可能性もあるため、結果画面が
 * 壊れないよう、表示に使う値まで確かめる
 */
function isValidRecord(value: unknown): value is HistoryRecord {
  if (!isRecord(value)) return false
  const settings = value.settings as unknown as Record<string, unknown>
  return (
    !Number.isNaN(Date.parse(value.savedAt)) &&
    isFiniteNumber(settings.distanceCm) &&
    settings.distanceCm > 0 &&
    isFiniteNumber(settings.pxPerMm) &&
    settings.pxPerMm > 0 &&
    typeof settings.eye === 'string' &&
    Object.hasOwn(EYE_LABEL, settings.eye) &&
    value.results.length > 0 &&
    value.results.every(isValidResult)
  )
}

export type ParsedBackup =
  | { ok: true; records: HistoryRecord[]; invalidCount: number }
  | { ok: false }

/** 書き出したファイルの中身を読み取る。形式が正しくない記録は除く */
export function parseBackup(text: string): ParsedBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false }
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false }
  const file = parsed as Record<string, unknown>
  if (file.format !== BACKUP_FORMAT || !Array.isArray(file.records)) {
    return { ok: false }
  }
  const records = file.records.filter(isValidRecord)
  return { ok: true, records, invalidCount: file.records.length - records.length }
}

export interface ImportPlan {
  /** 読み込み後の履歴（新しい順、上限件数まで） */
  records: HistoryRecord[]
  /** 新しく加わる記録の数 */
  addedCount: number
  /** すでに履歴にあったため読み込まない記録の数 */
  duplicateCount: number
  /** 上限を超えるため削除される古い記録の数 */
  overflowCount: number
}

/** 読み込んだ記録を今の履歴に合わせた結果を求める（まだ保存はしない） */
export function planImport(imported: HistoryRecord[]): ImportPlan {
  const current = loadHistory()
  const ids = new Set(current.map((r) => r.id))
  const added: HistoryRecord[] = []
  for (const record of imported) {
    if (ids.has(record.id)) continue
    ids.add(record.id)
    added.push(record)
  }
  const merged = [...current, ...added].sort(
    (a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt),
  )
  return {
    records: merged.slice(0, MAX_RECORDS),
    addedCount: added.length,
    duplicateCount: imported.length - added.length,
    overflowCount: Math.max(0, merged.length - MAX_RECORDS),
  }
}

/** 読み込み後の履歴を保存する。保存できなければ false */
export function saveImportedHistory(plan: ImportPlan): boolean {
  return persist(plan.records)
}

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 何もしない
  }
}

/** 応答があった方向の境界視角の平均。応答がひとつもなければ null */
export function averageBoundaryDeg(results: MeasurementResult[]): number | null {
  const known = results.filter(
    (r) => !isPointResult(r) && r.boundaryDeg !== null,
  )
  if (known.length === 0) return null
  return (
    known.reduce(
      (sum, r) => sum + (!isPointResult(r) ? (r.boundaryDeg ?? 0) : 0),
      0,
    ) / known.length
  )
}

/** 新方式の各点で、円に気付いた半径の平均 */
export function averageRadiusDeg(results: MeasurementResult[]): number | null {
  const points = results.filter(isPointResult)
  if (points.length === 0) return null
  return points.reduce((sum, point) => sum + point.radiusDeg, 0) / points.length
}

export function formatSavedAt(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
