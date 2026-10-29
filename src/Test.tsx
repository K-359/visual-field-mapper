import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointResult, Settings } from './types'
import { pxPerDeg } from './types'
import {
  createShuffledTrialPlan,
  FIXATION_DOT_RADIUS_DEG,
  MAX_STIMULUS_RADIUS_DEG,
  MEASUREMENT_LOCATIONS,
  REPETITIONS_PER_LOCATION,
  REQUIRED_EXTENT_DEG,
  TOTAL_TRIAL_COUNT,
} from './measurementPlan'
import type { MeasurementLocation } from './measurementPlan'
import LandoltRing from './LandoltRing'
import { ARROW_KEY_DIRECTION, randomGapDirection } from './landolt'

interface Props {
  settings: Settings
  onFinish: (results: PointResult[]) => void
  onCancel: () => void
}

interface Viewport {
  w: number
  h: number
}

interface TestPoint {
  locationId: string
  /** 画面上の位置（px） */
  x: number
  y: number
  /** 固視点を原点とする位置（視角、度。右・上が正） */
  xDeg: number
  yDeg: number
}

interface TrialResult extends PointResult {
  locationId: string
}

const GROWTH_DEG_PER_SECOND = 0.15
const EDGE_MARGIN_PX = 20
const HUD_RESERVED_PX = 100

const round2 = (value: number) => Math.round(value * 100) / 100

/** 最外周の環が最大まで広がっても欠けずに収まる、最小の画面サイズ（px） */
function requiredViewport(ppd: number): Viewport {
  const extentPx = Math.ceil(REQUIRED_EXTENT_DEG * ppd)
  return {
    w: (extentPx + EDGE_MARGIN_PX) * 2,
    h: (extentPx + Math.max(EDGE_MARGIN_PX, HUD_RESERVED_PX)) * 2,
  }
}

function fitsViewport(viewport: Viewport, ppd: number): boolean {
  const required = requiredViewport(ppd)
  return viewport.w >= required.w && viewport.h >= required.h
}

/** 視角で決まっている測定地点を、現在の画面内の座標へ変換する */
function resolvePoint(
  location: MeasurementLocation,
  ppd: number,
  viewport: Viewport,
): TestPoint {
  const xDeg = Math.cos(location.angleRad) * location.eccentricityDeg
  const yDeg = Math.sin(location.angleRad) * location.eccentricityDeg

  return {
    locationId: location.id,
    x: viewport.w / 2 + xDeg * ppd,
    y: viewport.h / 2 - yDeg * ppd,
    xDeg,
    yDeg,
  }
}

/** 各地点の複数回ぶんの結果を、地点ごとの平均へまとめる */
function averageLocationResults(results: TrialResult[]): PointResult[] {
  return MEASUREMENT_LOCATIONS.map((location) => {
    const samples = results.filter(
      (result) => result.locationId === location.id,
    )
    const average = (key: 'xDeg' | 'yDeg' | 'radiusDeg') =>
      samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length

    return {
      xDeg: round2(average('xDeg')),
      yDeg: round2(average('yDeg')),
      radiusDeg: round2(average('radiusDeg')),
      sampleCount: samples.length,
      maxRadiusDeg: MAX_STIMULUS_RADIUS_DEG,
      wrongCount: samples.reduce((sum, sample) => sum + (sample.wrongCount ?? 0), 0),
    }
  })
}

export default function Test({ settings, onFinish, onCancel }: Props) {
  const ppd = pxPerDeg(settings)
  const initialViewport = {
    w: window.innerWidth,
    h: window.innerHeight,
  }
  const [viewport, setViewport] = useState<Viewport>(initialViewport)
  const [trialPlan] = useState(createShuffledTrialPlan)
  const [activeIndex, setActiveIndex] = useState(0)
  const activePoint = useMemo(
    () => resolvePoint(trialPlan[activeIndex], ppd, viewport),
    [activeIndex, ppd, trialPlan, viewport],
  )
  const [radiusDeg, setRadiusDeg] = useState(0)
  const [gapDirection, setGapDirection] = useState(() => randomGapDirection())
  // この地点で、正しく答えるまでに違う向きを答えた回数
  const wrongCountRef = useRef(0)
  const startTimeRef = useRef(performance.now())
  const radiusRef = useRef(0)
  const resultsRef = useRef<TrialResult[]>([])
  const fits = fitsViewport(viewport, ppd)

  // 画面が小さすぎる間は測定を止め、収まるようになったら今の地点を最初からやり直す
  useEffect(() => {
    if (!fits) return
    startTimeRef.current = performance.now()
    radiusRef.current = 0
    wrongCountRef.current = 0
    setRadiusDeg(0)
  }, [fits])

  useEffect(() => {
    const onResize = () => {
      const next = { w: window.innerWidth, h: window.innerHeight }
      setViewport(next)
    }
    // window の resize イベントが発火しない環境（ビューポートエミュレーション等）
    // もあるため、ルート要素のサイズ変化を ResizeObserver で監視する
    const observer = new ResizeObserver(onResize)
    observer.observe(document.documentElement)
    window.addEventListener('resize', onResize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [ppd])

  useEffect(() => {
    let frameId = 0
    const animate = (now: number) => {
      const nextRadius = Math.min(
        MAX_STIMULUS_RADIUS_DEG,
        ((now - startTimeRef.current) / 1000) * GROWTH_DEG_PER_SECOND,
      )
      radiusRef.current = nextRadius
      setRadiusDeg(nextRadius)
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    const confirmActiveRing = () => {
      const result: TrialResult = {
        locationId: activePoint.locationId,
        xDeg: round2(activePoint.xDeg),
        yDeg: round2(activePoint.yDeg),
        radiusDeg: round2(radiusRef.current),
        wrongCount: wrongCountRef.current,
      }
      const updated = [...resultsRef.current, result]
      resultsRef.current = updated

      if (updated.length === TOTAL_TRIAL_COUNT) {
        onFinish(averageLocationResults(updated))
      } else {
        // 答えの処理中に時計をリセットし、次の環の拡大を直ちに開始する。
        startTimeRef.current = performance.now()
        radiusRef.current = 0
        wrongCountRef.current = 0
        setRadiusDeg(0)
        setGapDirection(randomGapDirection())
        setActiveIndex(updated.length)
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      const answer = ARROW_KEY_DIRECTION[e.key]
      if (answer === undefined) return
      // 矢印キーで画面がスクロールしないようにする
      e.preventDefault()
      // 押しっぱなしの連続入力は答えとして扱わない
      if (e.repeat || !fits) return

      const correct = answer === gapDirection
      if (!correct) wrongCountRef.current += 1
      // 正しい向きを答えたときだけ、その大きさで分かったとみなす。
      // 最大の大きさでも分からない場所で先へ進めるよう、最大に達した後は
      // どの向きでも次へ進む（記録は最大の半径になる）
      if (correct || radiusRef.current >= MAX_STIMULUS_RADIUS_DEG) {
        confirmActiveRing()
      } else {
        // 違う向きを答えたら、環は大きくし続けたまま切れ目の向きを変える
        // （順に押して当てることができないようにする）
        setGapDirection(randomGapDirection(gapDirection))
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activePoint, fits, gapDirection, onCancel, onFinish])

  const diameterPx = radiusDeg * ppd * 2
  const reachedMax = radiusDeg >= MAX_STIMULUS_RADIUS_DEG
  const required = requiredViewport(ppd)
  const fixationDiameterPx = FIXATION_DOT_RADIUS_DEG * ppd * 2

  return (
    <div className="test-screen">
      <div
        className="fixation-dot"
        style={{ width: fixationDiameterPx, height: fixationDiameterPx }}
        role="img"
        aria-label="中心の赤い丸（ここを見続ける）"
      />

      {fits ? (
        <LandoltRing
          key={activeIndex}
          className="landolt-target"
          style={{ left: activePoint.x, top: activePoint.y }}
          diameterPx={diameterPx}
          direction={gapDirection}
          label="大きくなるランドルト環"
        />
      ) : (
        <div className="test-too-small" role="alert">
          <p>画面が小さすぎるため、測定を一時停止しています。</p>
          <p>
            ウィンドウを広げるか、全画面表示にしてください
            （必要な大きさ: 横{required.w} × 縦{required.h}px、
            現在: 横{viewport.w} × 縦{viewport.h}px）。
          </p>
          {document.fullscreenElement === null &&
            document.documentElement.requestFullscreen !== undefined && (
              <button
                type="button"
                onClick={() => void document.documentElement.requestFullscreen()}
              >
                全画面表示にする
              </button>
            )}
        </div>
      )}

      <div className="test-hud">
        <span>
          {activeIndex + 1} / {TOTAL_TRIAL_COUNT} 回目
        </span>
        <span>
          {reachedMax
            ? '最大サイズです（どの矢印キーでも次へ進みます）　'
            : '切れ目の向きを矢印キー（↑ ↓ ← →）で答える　'}
          各地点{REPETITIONS_PER_LOCATION}回　Esc 中止
        </span>
        <button type="button" onClick={onCancel}>
          測定を中止
        </button>
      </div>
    </div>
  )
}
