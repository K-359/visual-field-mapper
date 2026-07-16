import type { DirectionResult, Settings } from './types'

/** 保存される 1 回ぶんの測定記録 */
export interface HistoryRecord {
  id: string
  /** 保存日時 (ISO 8601) */
  savedAt: string
  settings: Settings
  results: DirectionResult[]
}

const STORAGE_KEY = 'visual-field-mapper-history'
/** 古い記録から削除して、この件数までに抑える */
const MAX_RECORDS = 100

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

function persist(records: HistoryRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // プライベートブラウズや容量不足で保存できない場合は諦める
  }
}

/** 測定結果を履歴の先頭に保存する */
export function addRecord(
  settings: Settings,
  results: DirectionResult[],
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

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 何もしない
  }
}

/** 応答があった方向の境界視角の平均。応答がひとつもなければ null */
export function averageBoundaryDeg(results: DirectionResult[]): number | null {
  const known = results.filter((r) => r.boundaryDeg !== null)
  if (known.length === 0) return null
  return known.reduce((sum, r) => sum + r.boundaryDeg!, 0) / known.length
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
