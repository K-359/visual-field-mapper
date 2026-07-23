import { useState } from 'react'
import type { HistoryRecord } from './historyStore'
import {
  averageBoundaryDeg,
  averageRadiusDeg,
  clearHistory,
  deleteRecord,
  formatSavedAt,
  loadHistory,
} from './historyStore'
import { EYE_LABEL, isPointResult } from './types'

interface Props {
  onView: (record: HistoryRecord) => void
  onBack: () => void
}

export default function History({ onView, onBack }: Props) {
  const [records, setRecords] = useState<HistoryRecord[]>(loadHistory)

  const handleDelete = (id: string) => {
    setRecords(deleteRecord(id))
  }

  const handleClear = () => {
    if (!window.confirm('すべての測定履歴を削除します。よろしいですか？')) return
    clearHistory()
    setRecords([])
  }

  return (
    <div className="history">
      <h1>測定履歴</h1>
      <p className="lead">
        履歴はこの端末のブラウザ内にのみ保存されています。
      </p>

      {records.length === 0 ? (
        <p className="history-empty">保存された測定履歴はまだありません。</p>
      ) : (
        <ul className="history-list">
          {records.map((r) => {
            const avg = averageBoundaryDeg(r.results)
            const avgRadius = averageRadiusDeg(r.results)
            const repeatCount =
              r.results.length > 0 && isPointResult(r.results[0])
                ? r.results[0].sampleCount
                : undefined
            return (
              <li key={r.id} className="history-item">
                <div className="meta">
                  <div className="date">{formatSavedAt(r.savedAt)}</div>
                  <div className="detail">
                    {EYE_LABEL[r.settings.eye]} ／{' '}
                    {avgRadius !== null
                      ? `${r.results.length}箇所${
                          repeatCount !== undefined
                            ? `（各${repeatCount}回）`
                            : ''
                        } ／ 平均検出半径 約 ${avgRadius.toFixed(2)}°`
                      : avg !== null
                      ? `平均境界 約 ${avg.toFixed(1)}°`
                      : '範囲内では応答なし'}
                  </div>
                </div>
                <button className="primary" onClick={() => onView(r)}>
                  表示
                </button>
                <button className="danger" onClick={() => handleDelete(r.id)}>
                  削除
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="button-row">
        <button onClick={onBack}>もどる</button>
        {records.length > 0 && (
          <button className="danger" onClick={handleClear}>
            すべて削除
          </button>
        )}
      </div>
    </div>
  )
}
