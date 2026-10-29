import type { CSSProperties } from 'react'
import type { GapDirection } from './landolt'

/** 右向きの環を回す角度（度、画面上で時計回り） */
const ROTATION_DEG: Record<GapDirection, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
}

/**
 * 外側の半径を 1 とした、切れ目が右向きのランドルト環。
 * 標準的なランドルト環と同じく、環の太さと切れ目の幅を外径の 1/5 にする
 * （内側の半径 0.6、切れ目の幅 0.4）
 */
const OUTER = 1
const INNER = 0.6
const HALF_GAP = 0.2
const outerX = Math.sqrt(OUTER ** 2 - HALF_GAP ** 2)
const innerX = Math.sqrt(INNER ** 2 - HALF_GAP ** 2)
const RING_PATH =
  `M ${outerX} ${-HALF_GAP} ` +
  `A ${OUTER} ${OUTER} 0 1 0 ${outerX} ${HALF_GAP} ` +
  `L ${innerX} ${HALF_GAP} ` +
  `A ${INNER} ${INNER} 0 1 1 ${innerX} ${-HALF_GAP} Z`

interface Props {
  /** 外径（px） */
  diameterPx: number
  direction: GapDirection
  className?: string
  style?: CSSProperties
  label?: string
}

export default function LandoltRing({
  diameterPx,
  direction,
  className,
  style,
  label,
}: Props) {
  return (
    <svg
      className={className}
      style={style}
      width={diameterPx}
      height={diameterPx}
      viewBox="-1 -1 2 2"
      role="img"
      aria-label={label}
    >
      <path d={RING_PATH} transform={`rotate(${ROTATION_DEG[direction]})`} />
    </svg>
  )
}
