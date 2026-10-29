import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { HistoryRecord } from './historyStore'
import {
  MAX_RECORDS,
  averageBoundaryDeg,
  averageRadiusDeg,
  backupFileName,
  clearHistory,
  createBackup,
  deleteRecord,
  formatSavedAt,
  loadHistory,
  parseBackup,
  planImport,
  recordFileName,
  saveImportedHistory,
} from './historyStore'
import {
  EYE_LABEL,
  STIMULUS_LABEL,
  STIMULUS_RADIUS_NAME,
  isPointResult,
  stimulusOf,
} from './types'

interface Message {
  text: string
  isError: boolean
}

/** 文字列をファイルとしてダウンロードさせる */
function downloadJson(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // ダウンロードが始まる前に URL を無効にしないよう、少し待ってから解放する
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

interface Props {
  onView: (record: HistoryRecord) => void
  /** 記録の見え方を体験する（固定地点の測定結果のみ） */
  onSimulate: (record: HistoryRecord) => void
  onBack: () => void
}

export default function History({ onView, onSimulate, onBack }: Props) {
  const [records, setRecords] = useState<HistoryRecord[]>(loadHistory)
  const [message, setMessage] = useState<Message | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDelete = (id: string) => {
    setRecords(deleteRecord(id))
    setMessage(null)
  }

  const handleClear = () => {
    if (!window.confirm('すべての測定履歴を削除します。よろしいですか？')) return
    clearHistory()
    setRecords([])
    setMessage(null)
  }

  const handleExportAll = () => {
    downloadJson(createBackup(records), backupFileName())
    setMessage({ text: `${records.length}件の記録を書き出しました。`, isError: false })
  }

  const handleExportOne = (record: HistoryRecord) => {
    downloadJson(createBackup([record]), recordFileName(record))
    setMessage({
      text: `${formatSavedAt(record.savedAt)}の記録を書き出しました。`,
      isError: false,
    })
  }

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // 同じファイルをもう一度選んでも change が起きるよう、選択を戻しておく
    e.target.value = ''
    if (file === undefined) return

    const parsed = parseBackup(await file.text())
    if (!parsed.ok) {
      setMessage({
        text: 'このファイルは視野マッパーの測定履歴として読み込めませんでした。',
        isError: true,
      })
      return
    }

    const plan = planImport(parsed.records)
    if (
      plan.overflowCount > 0 &&
      !window.confirm(
        `読み込むと記録が上限の${MAX_RECORDS}件を超えるため、古い記録${plan.overflowCount}件が削除されます。続けますか？`,
      )
    ) {
      return
    }
    if (plan.addedCount > 0 && !saveImportedHistory(plan)) {
      setMessage({
        text: 'ブラウザに保存できなかったため、読み込めませんでした。',
        isError: true,
      })
      return
    }

    const notes = [
      plan.duplicateCount > 0 && `${plan.duplicateCount}件はすでに履歴にありました`,
      parsed.invalidCount > 0 &&
        `${parsed.invalidCount}件は形式が正しくないため読み込みませんでした`,
    ].filter((note) => note !== false)
    setRecords(loadHistory())
    setMessage({
      text:
        `${plan.addedCount}件の記録を読み込みました。` +
        (notes.length > 0 ? `（${notes.join('。')}）` : ''),
      isError: plan.addedCount === 0,
    })
  }

  return (
    <div className="history">
      <h1>測定履歴</h1>
      <p className="lead">
        履歴はこの端末のブラウザ内に保存されています。
        「すべて書き出す」でファイルに保存しておくと、
        「ファイルから読み込む」で履歴に戻して結果を表示できます。
      </p>

      {message !== null && (
        <p
          className={`history-message${message.isError ? ' error' : ''}`}
          role="status"
        >
          {message.text}
        </p>
      )}

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
                      ? `${STIMULUS_LABEL[stimulusOf(r.settings)]} ／ ${r.results.length}箇所${
                          repeatCount !== undefined
                            ? `（各${repeatCount}回）`
                            : ''
                        } ／ 平均${STIMULUS_RADIUS_NAME[stimulusOf(r.settings)]} 約 ${avgRadius.toFixed(2)}°`
                      : avg !== null
                      ? `平均境界 約 ${avg.toFixed(1)}°`
                      : '範囲内では応答なし'}
                  </div>
                </div>
                <button className="primary" onClick={() => onView(r)}>
                  表示
                </button>
                {avgRadius !== null && (
                  <button onClick={() => onSimulate(r)}>体験する</button>
                )}
                <button onClick={() => handleExportOne(r)}>書き出す</button>
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
          <button onClick={handleExportAll}>すべて書き出す</button>
        )}
        <button onClick={() => fileInputRef.current?.click()}>
          ファイルから読み込む
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void handleImport(e)}
        />
        {records.length > 0 && (
          <button className="danger" onClick={handleClear}>
            すべて削除
          </button>
        )}
      </div>
    </div>
  )
}
