import { useEffect, useRef, useState } from 'react'
import type { DirectionResult, Settings } from './types'
import { DIRECTIONS, pxPerDeg } from './types'

interface Props {
  settings: Settings
  onFinish: (results: DirectionResult[]) => void
  onCancel: () => void
}

interface Sweep {
  dirDeg: number
  maxDeg: number
}

const SPEED_DEG_S = 2.5 // 点の移動速度（視角 度/秒）
const DOT_SIZE_DEG = 0.4 // 点の直径（視角、度）
const START_DEG = 2 // 点の初期位置（中心からの視角、度）
const PAUSE_MS = 1000 // 次の点が動き出すまでの待ち時間
const MARGIN_PX = 24 // 画面端の余白
const MAX_DEG_CAP = 30 // 測定する離心度の上限

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 各方向について、画面内に収まる最大離心度を計算する */
function planSweeps(ppd: number, w: number, h: number): Sweep[] {
  const cx = w / 2
  const cy = h / 2
  return shuffle(
    DIRECTIONS.map((dirDeg) => {
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
      return { dirDeg, maxDeg: Math.round(maxDeg * 10) / 10 }
    }),
  )
}

/** 測定が終わった点の表示情報（応答した位置にとどめて表示し続ける） */
interface FinishedDot {
  dirDeg: number
  eccDeg: number
}

export default function Test({ settings, onFinish, onCancel }: Props) {
  const ppd = pxPerDeg(settings)
  const [sweeps] = useState(() =>
    planSweeps(ppd, window.innerWidth, window.innerHeight),
  )
  const [index, setIndex] = useState(0)
  const [eccDeg, setEccDeg] = useState(START_DEG)
  const [finished, setFinished] = useState<FinishedDot[]>([])

  const eccRef = useRef(START_DEG)
  const movingRef = useRef(false)
  const responseRef = useRef<number | null>(null)
  const finishedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let anim = 0
    const timers: number[] = []
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms))
      })
    const results: DirectionResult[] = []

    async function run() {
      for (let i = 0; i < sweeps.length; i++) {
        if (cancelled) return
        setIndex(i)
        responseRef.current = null
        eccRef.current = START_DEG
        setEccDeg(START_DEG)

        // 固視を安定させるための待ち時間
        await wait(PAUSE_MS)
        if (cancelled) return

        const sweep = sweeps[i]
        movingRef.current = true
        await new Promise<void>((resolve) => {
          // requestAnimationFrame はタブが非表示だと止まるため、時刻ベースの interval で駆動する
          const start = performance.now()
          anim = window.setInterval(() => {
            if (cancelled) {
              clearInterval(anim)
              resolve()
              return
            }
            const e =
              START_DEG + ((performance.now() - start) / 1000) * SPEED_DEG_S
            eccRef.current = e
            setEccDeg(e)
            if (responseRef.current !== null || e >= sweep.maxDeg) {
              clearInterval(anim)
              resolve()
            }
          }, 16)
        })
        movingRef.current = false
        if (cancelled) return

        const boundary =
          responseRef.current !== null
            ? Math.round(responseRef.current * 10) / 10
            : null
        results.push({
          dirDeg: sweep.dirDeg,
          maxDeg: sweep.maxDeg,
          boundaryDeg: boundary,
        })
        setFinished((prev) => [
          ...prev,
          { dirDeg: sweep.dirDeg, eccDeg: boundary ?? sweep.maxDeg },
        ])
      }
      if (!cancelled && !finishedRef.current) {
        finishedRef.current = true
        onFinish(results)
      }
    }
    run()

    return () => {
      cancelled = true
      clearInterval(anim)
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweeps])

  useEffect(() => {
    const respond = () => {
      if (movingRef.current && responseRef.current === null) {
        responseRef.current = eccRef.current
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        respond()
      }
    }
    const onPointer = () => respond()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dotPx = Math.max(8, DOT_SIZE_DEG * ppd)
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2

  return (
    <div className="test-screen">
      {/* 固視ガイド: 中心の小さな赤い十字。ここを見続けてもらう */}
      <div className="fix-cross horizontal" />
      <div className="fix-cross vertical" />

      {/* 16方向すべての点を最初から表示しておき、1つずつ順番に外へ動かす。
          突然現れる刺激は視線を引きつけてしまうため。
          応答済みの点は、応答した位置にとどまり続ける */}
      {sweeps.map((s, i) => {
        const done = finished.find((f) => f.dirDeg === s.dirDeg)
        const ecc = done
          ? done.eccDeg
          : i === index
            ? Math.min(eccDeg, s.maxDeg)
            : START_DEG
        const rad = (s.dirDeg * Math.PI) / 180
        const x = cx + Math.cos(rad) * ecc * ppd
        const y = cy - Math.sin(rad) * ecc * ppd
        return (
          <div
            key={s.dirDeg}
            className="dot"
            style={{
              left: x - dotPx / 2,
              top: y - dotPx / 2,
              width: dotPx,
              height: dotPx,
            }}
          />
        )
      })}

      <div className="test-hud">
        <span>
          {index + 1} / {sweeps.length} 方向
        </span>
        <span>
          動いている点がはっきり見えたら スペース または タップ ／ Esc で中止
        </span>
      </div>
    </div>
  )
}
