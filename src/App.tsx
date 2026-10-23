import { useState } from 'react'
import Setup from './Setup'
import Test from './Test'
import Result from './Result'
import History from './History'
import Calibration from './Calibration'
import type { Eye, MeasurementResult, Phase, PointResult, Settings } from './types'
import { VIEWING_DISTANCE_CM } from './types'
import { addRecord } from './historyStore'
import {
  DEFAULT_PX_PER_MM,
  isCalibrationCurrent,
  loadCalibration,
  saveCalibration,
} from './calibrationStore'
import {
  MAX_STIMULUS_RADIUS_DEG,
  MEASUREMENT_LOCATIONS,
  REPETITIONS_PER_LOCATION,
} from './measurementPlan'

/** 固定地点測定の結果画面を確認するためのサンプルデータ */
function demoResults(): PointResult[] {
  return MEASUREMENT_LOCATIONS.map((location) => {
    const distanceFromCenter = location.eccentricityDeg
    return {
      xDeg: Math.cos(location.angleRad) * distanceFromCenter,
      yDeg: Math.sin(location.angleRad) * distanceFromCenter,
      radiusDeg: Math.max(
        0.2,
        Math.min(
          MAX_STIMULUS_RADIUS_DEG,
          2.8 - distanceFromCenter * 0.2 + Math.random() * 0.8,
        ),
      ),
      sampleCount: REPETITIONS_PER_LOCATION,
      maxRadiusDeg: MAX_STIMULUS_RADIUS_DEG,
    }
  })
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [results, setResults] = useState<MeasurementResult[]>([])
  // 表示中の結果の保存日時。サンプル表示など未保存のときは null
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [calibration, setCalibration] = useState(loadCalibration)
  // 画面の大きさを合わせた後に測定する眼。設定画面から合わせるだけのときは null
  const [pendingEye, setPendingEye] = useState<Eye | null>(null)

  const settingsFor = (eye: Eye, pxPerMm: number): Settings => ({
    distanceCm: VIEWING_DISTANCE_CM,
    pxPerMm,
    eye,
  })

  /** 今の画面に合った校正値で測定を始める。合っていなければ先に画面の大きさを合わせる */
  const startTest = (eye: Eye) => {
    if (calibration === null || !isCalibrationCurrent(calibration)) {
      setPendingEye(eye)
      setPhase('calibrate')
      return
    }
    setSettings(settingsFor(eye, calibration.pxPerMm))
    setPhase('test')
  }

  return (
    <>
      {phase === 'setup' && (
        <Setup
          calibration={calibration}
          onStart={startTest}
          onDemo={(eye) => {
            setSettings(settingsFor(eye, calibration?.pxPerMm ?? DEFAULT_PX_PER_MM))
            setResults(demoResults())
            setSavedAt(null)
            setPhase('result')
          }}
          onCalibrate={() => {
            setPendingEye(null)
            setPhase('calibrate')
          }}
          onHistory={() => setPhase('history')}
        />
      )}
      {phase === 'calibrate' && (
        <Calibration
          initialPxPerMm={calibration?.pxPerMm ?? DEFAULT_PX_PER_MM}
          continueToTest={pendingEye !== null}
          onSave={(pxPerMm) => {
            setCalibration(saveCalibration(pxPerMm))
            if (pendingEye === null) {
              setPhase('setup')
            } else {
              setSettings(settingsFor(pendingEye, pxPerMm))
              setPendingEye(null)
              setPhase('test')
            }
          }}
          onCancel={() => {
            setPendingEye(null)
            setPhase('setup')
          }}
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
          onRetry={() => startTest(settings.eye)}
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
