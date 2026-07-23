import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointResult, Settings } from './types'
import { pxPerDeg } from './types'
import {
  createShuffledTrialPlan,
  MEASUREMENT_LOCATIONS,
  REPETITIONS_PER_LOCATION,
  TOTAL_TRIAL_COUNT,
} from './measurementPlan'
import type { MeasurementLocation } from './measurementPlan'

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
  x: number
  y: number
  maxRadiusDeg: number
}

interface TrialResult extends PointResult {
  locationId: string
}

const GROWTH_DEG_PER_SECOND = 0.15
const MAX_RADIUS_DEG = 5
const EDGE_MARGIN_PX = 20
const HUD_RESERVED_PX = 100

const round2 = (value: number) => Math.round(value * 100) / 100

/** 固定測定地点を、現在の画面内の座標へ変換する */
function resolvePoint(
  location: MeasurementLocation,
  ppd: number,
  viewport: Viewport,
): TestPoint {
  const centerX = viewport.w / 2
  const centerY = viewport.h / 2
  const availableFromCenterPx = Math.max(
    0,
    Math.min(
      centerX - EDGE_MARGIN_PX,
      viewport.w - EDGE_MARGIN_PX - centerX,
      centerY - EDGE_MARGIN_PX,
      viewport.h - HUD_RESERVED_PX - centerY,
    ),
  )
  const maxRadiusPx = Math.min(
    MAX_RADIUS_DEG * ppd,
    availableFromCenterPx,
  )
  const spawnRadiusPx = Math.max(0, availableFromCenterPx - maxRadiusPx)
  const distance = location.radiusRatio * spawnRadiusPx

  return {
    locationId: location.id,
    x: centerX + Math.cos(location.angleRad) * distance,
    y: centerY - Math.sin(location.angleRad) * distance,
    maxRadiusDeg: maxRadiusPx / ppd,
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
  const viewportRef = useRef(initialViewport)
  const [trialPlan] = useState(createShuffledTrialPlan)
  const [activeIndex, setActiveIndex] = useState(0)
  const activePoint = useMemo(
    () => resolvePoint(trialPlan[activeIndex], ppd, viewport),
    [activeIndex, ppd, trialPlan, viewport],
  )
  const [radiusDeg, setRadiusDeg] = useState(0)
  const startTimeRef = useRef(performance.now())
  const radiusRef = useRef(0)
  const maxRadiusRef = useRef(activePoint.maxRadiusDeg)
  const resultsRef = useRef<TrialResult[]>([])

  useEffect(() => {
    const onResize = () => {
      const next = { w: window.innerWidth, h: window.innerHeight }
      viewportRef.current = next
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
        maxRadiusRef.current,
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
    const confirmActiveCircle = () => {
      const result: TrialResult = {
        locationId: activePoint.locationId,
        xDeg: round2((activePoint.x - viewport.w / 2) / ppd),
        yDeg: round2((viewport.h / 2 - activePoint.y) / ppd),
        radiusDeg: round2(radiusRef.current),
      }
      const updated = [...resultsRef.current, result]
      resultsRef.current = updated

      if (updated.length === TOTAL_TRIAL_COUNT) {
        onFinish(averageLocationResults(updated))
      } else {
        const nextPoint = resolvePoint(
          trialPlan[updated.length],
          ppd,
          viewportRef.current,
        )
        // Enter の処理中に時計をリセットし、次の円の拡大を直ちに開始する。
        startTimeRef.current = performance.now()
        radiusRef.current = 0
        maxRadiusRef.current = nextPoint.maxRadiusDeg
        setRadiusDeg(0)
        setActiveIndex(updated.length)
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      } else if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault()
        confirmActiveCircle()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activePoint, onCancel, onFinish, ppd, trialPlan, viewport])

  const diameterPx = radiusDeg * ppd * 2
  const reachedMax = radiusDeg >= activePoint.maxRadiusDeg

  return (
    <div className="test-screen">
      <div className="fix-cross horizontal" />
      <div className="fix-cross vertical" />

      <div
        key={activeIndex}
        className="circle-target"
        style={{
          left: activePoint.x,
          top: activePoint.y,
          width: diameterPx,
          height: diameterPx,
        }}
        role="img"
        aria-label="大きくなる赤い円"
      />

      <div className="test-hud">
        <span>
          {activeIndex + 1} / {TOTAL_TRIAL_COUNT} 回目
        </span>
        <span>
          {reachedMax ? '最大サイズです　' : ''}
          円に気付いたら Enter　各地点{REPETITIONS_PER_LOCATION}回　Esc 中止
        </span>
        <button type="button" onClick={onCancel}>
          測定を中止
        </button>
      </div>
    </div>
  )
}
