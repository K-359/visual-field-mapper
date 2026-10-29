import { useEffect, useRef, useState } from 'react'

export type FocusMode = 'fixed' | 'mouse'

export interface FocusPoint {
  x: number
  y: number
}

/**
 * 見え方の中心をどこに置くか。
 *
 * Phase 2 で視線追従を足すときは、このフックに 'gaze' を増やすだけで
 * 描画側は変えずに済む。そのために座標の供給元をここに閉じ込めてある。
 *
 * 座標はビューポート基準の CSS ピクセル。
 */
export function useFocusPoint(mode: FocusMode): FocusPoint {
  const [point, setPoint] = useState<FocusPoint>(() => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }))
  // マウス座標は毎フレーム描画に渡すので、イベントごとに setState せず
  // rAF に1回だけまとめる。mousemove は 100Hz を超えることがある。
  const pending = useRef<FocusPoint | null>(null)
  const raf = useRef(0)

  useEffect(() => {
    if (mode === 'fixed') {
      const center = () =>
        setPoint({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      center()
      window.addEventListener('resize', center)
      return () => window.removeEventListener('resize', center)
    }

    const flush = () => {
      raf.current = 0
      if (pending.current) setPoint(pending.current)
    }
    const onMove = (e: PointerEvent) => {
      pending.current = { x: e.clientX, y: e.clientY }
      if (!raf.current) raf.current = requestAnimationFrame(flush)
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf.current) cancelAnimationFrame(raf.current)
      raf.current = 0
    }
  }, [mode])

  return point
}
