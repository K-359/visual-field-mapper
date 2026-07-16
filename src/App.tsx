import { useState } from 'react'
import Setup from './Setup'
import Test from './Test'
import Result from './Result'
import History from './History'
import type { DirectionResult, Phase, Settings } from './types'
import { DIRECTIONS } from './types'
import { addRecord } from './historyStore'

/** 結果画面のイメージを掴むためのサンプルデータ（中心約6〜10°の暗点を模擬） */
function demoResults(): DirectionResult[] {
  return DIRECTIONS.map((dirDeg) => ({
    dirDeg,
    maxDeg: 15,
    boundaryDeg: Math.round((6 + Math.random() * 4) * 10) / 10,
  }))
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [results, setResults] = useState<DirectionResult[]>([])
  // 表示中の結果の保存日時。サンプル表示など未保存のときは null
  const [savedAt, setSavedAt] = useState<string | null>(null)

  return (
    <>
      {phase === 'setup' && (
        <Setup
          onStart={(s) => {
            setSettings(s)
            setPhase('test')
          }}
          onDemo={(s) => {
            setSettings(s)
            setResults(demoResults())
            setSavedAt(null)
            setPhase('result')
          }}
          onHistory={() => setPhase('history')}
        />
      )}
      {phase === 'test' && settings && (
        <Test
          settings={settings}
          onFinish={(r) => {
            const record = addRecord(settings, r)
            setResults(r)
            setSavedAt(record.savedAt)
            setPhase('result')
          }}
          onCancel={() => setPhase('setup')}
        />
      )}
      {phase === 'result' && settings && (
        <Result
          settings={settings}
          results={results}
          savedAt={savedAt}
          onRetry={() => setPhase('test')}
          onReset={() => setPhase('setup')}
          onHistory={() => setPhase('history')}
        />
      )}
      {phase === 'history' && (
        <History
          onView={(record) => {
            setSettings(record.settings)
            setResults(record.results)
            setSavedAt(record.savedAt)
            setPhase('result')
          }}
          onBack={() => setPhase('setup')}
        />
      )}
    </>
  )
}
