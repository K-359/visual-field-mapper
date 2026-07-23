import { useState } from 'react'
import Setup from './Setup'
import Test from './Test'
import Result from './Result'
import History from './History'
import type { MeasurementResult, Phase, PointResult, Settings } from './types'
import { addRecord } from './historyStore'
import {
  MEASUREMENT_LOCATIONS,
  REPETITIONS_PER_LOCATION,
} from './measurementPlan'

/** 固定地点測定の結果画面を確認するためのサンプルデータ */
function demoResults(): PointResult[] {
  const outerRadiusDeg = 18
  return MEASUREMENT_LOCATIONS.map((location) => {
    const distanceFromCenter = location.radiusRatio * outerRadiusDeg
    return {
      xDeg: Math.cos(location.angleRad) * distanceFromCenter,
      yDeg: Math.sin(location.angleRad) * distanceFromCenter,
      radiusDeg: Math.max(
        0.2,
        Math.min(5, 2.8 - distanceFromCenter * 0.12 + Math.random() * 0.8),
      ),
      sampleCount: REPETITIONS_PER_LOCATION,
    }
  })
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [results, setResults] = useState<MeasurementResult[]>([])
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
