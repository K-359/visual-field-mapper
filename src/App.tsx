import { useState } from 'react'
import Setup from './Setup'
import Test from './Test'
import Result from './Result'
import type { DirectionResult, Phase, Settings } from './types'
import { DIRECTIONS } from './types'

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
            setPhase('result')
          }}
        />
      )}
      {phase === 'test' && settings && (
        <Test
          settings={settings}
          onFinish={(r) => {
            setResults(r)
            setPhase('result')
          }}
          onCancel={() => setPhase('setup')}
        />
      )}
      {phase === 'result' && settings && (
        <Result
          settings={settings}
          results={results}
          onRetry={() => setPhase('test')}
          onReset={() => setPhase('setup')}
        />
      )}
    </>
  )
}
