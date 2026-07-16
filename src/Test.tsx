import { useEffect, useState } from 'react'
import type { DirectionResult, Settings } from './types'
import { DIRECTIONS, dirLabel, pxPerDeg } from './types'

interface Props {
  settings: Settings
  onFinish: (results: DirectionResult[]) => void
  onCancel: () => void
}

interface CircleMeasurement {
  dirDeg: number
  maxDeg: number
  eccDeg: number
  boundaryDeg: number | undefined
}

const TARGET_SIZE_DEG = 2.2 // 円を配置する領域の直径（視角、度）
const MIN_DEG = 2 // ターゲットの初期位置
const MOVE_STEP_DEG = 0.2 // 矢印キー1回あたりの移動量（視角、度）
const MARGIN_PX = 30 // 画面端の余白
const MAX_DEG_CAP = 30 // 測定する離心度の上限

/** 各方向について、画面内に収まる最大離心度を計算する */
function planCircles(ppd: number, w: number, h: number): CircleMeasurement[] {
  const cx = w / 2
  const cy = h / 2
  return DIRECTIONS.map((dirDeg) => {
    const rad = (dirDeg * Math.PI) / 180
    const dx = Math.cos(rad)
    const dy = -Math.sin(rad) // 画面座標は y が下向き
    const tx =
      dx > 0
        ? (w - MARGIN_PX - cx) / dx
        : dx < 0
          ? (MARGIN_PX - cx) / dx
          : Infinity
    const ty =
      dy > 0
        ? (h - MARGIN_PX - cy) / dy
        : dy < 0
          ? (MARGIN_PX - cy) / dy
          : Infinity
    const maxPx = Math.min(tx, ty)
    const maxDeg = Math.min(maxPx / ppd, MAX_DEG_CAP)
    return {
      dirDeg,
      maxDeg: Math.round(maxDeg * 10) / 10,
      eccDeg: MIN_DEG,
      boundaryDeg: undefined,
    }
  })
}

export default function Test({ settings, onFinish, onCancel }: Props) {
  const ppd = pxPerDeg(settings)
  const [circles, setCircles] = useState(() =>
    planCircles(ppd, window.innerWidth, window.innerHeight),
  )
  const [activeIndex, setActiveIndex] = useState(0)

  const activeCircle = circles[activeIndex]

  useEffect(() => {
    const moveActiveCircle = (deltaDeg: number) => {
      setCircles((current) =>
        current.map((circle, index) =>
          index === activeIndex
            ? {
                ...circle,
                eccDeg: Math.min(
                  circle.maxDeg,
                  Math.max(MIN_DEG, circle.eccDeg + deltaDeg),
                ),
              }
            : circle,
        ),
      )
    }

    const confirmActiveCircle = () => {
      const updated = circles.map((circle, index) =>
        index === activeIndex
          ? {
              ...circle,
              boundaryDeg: Math.round(circle.eccDeg * 10) / 10,
            }
          : circle,
      )

      if (activeIndex === updated.length - 1) {
        onFinish(
          updated.map((circle) => ({
            dirDeg: circle.dirDeg,
            maxDeg: circle.maxDeg,
            boundaryDeg: circle.boundaryDeg ?? circle.eccDeg,
          })),
        )
      } else {
        setCircles(updated)
        setActiveIndex((index) => index + 1)
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault()
        moveActiveCircle(MOVE_STEP_DEG)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault()
        moveActiveCircle(-MOVE_STEP_DEG)
      } else if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault()
        confirmActiveCircle()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIndex, circles, onCancel, onFinish])

  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const targetPx = Math.max(50, TARGET_SIZE_DEG * ppd)

  const position = (dirDeg: number, distanceDeg: number) => {
    const rad = (dirDeg * Math.PI) / 180
    return {
      x: cx + Math.cos(rad) * distanceDeg * ppd,
      y: cy - Math.sin(rad) * distanceDeg * ppd,
    }
  }

  return (
    <div className="test-screen">
      <div className="fix-cross horizontal" />
      <div className="fix-cross vertical" />

      {circles.map((circle, index) => {
        const p = position(circle.dirDeg, circle.eccDeg)
        return (
          <div
            key={circle.dirDeg}
            className={`circle-target${index === activeIndex ? ' active' : ''}`}
            style={{ left: p.x, top: p.y }}
            aria-label={`${dirLabel(circle.dirDeg)}の円`}
          >
            <svg
              className="visibility-target"
              style={{ width: targetPx, height: targetPx }}
              viewBox="-28 -28 56 56"
              aria-hidden="true"
            >
              <circle r="12" strokeWidth="6" />
            </svg>
          </div>
        )
      })}

      <div className="test-hud">
        <span>
          {activeIndex + 1} / {circles.length} 個目（{dirLabel(activeCircle.dirDeg)}）
        </span>
        <span>↑・→ 外側　↓・← 内側　Enter 次の円　Esc 中止</span>
        <button type="button" onClick={onCancel}>
          測定を中止
        </button>
      </div>
    </div>
  )
}
