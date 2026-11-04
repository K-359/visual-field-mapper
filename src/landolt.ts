/**
 * ランドルト環の切れ目の幅を、外側の半径の何倍にするか。標準的なランドルト環と
 * 同じく切れ目の幅は外径の 1/5 なので、外側の半径の 0.4 倍になる
 */
export const LANDOLT_GAP_PER_OUTER_RADIUS = 0.4

/** ランドルト環の切れ目の向き */
export type GapDirection = 'up' | 'down' | 'left' | 'right'

export const GAP_DIRECTIONS: readonly GapDirection[] = ['up', 'down', 'left', 'right']

/** 矢印キーと、それが答える切れ目の向き */
export const ARROW_KEY_DIRECTION: Partial<Record<string, GapDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/** 今の向き以外から、新しい切れ目の向きをランダムに選ぶ */
export function randomGapDirection(except?: GapDirection): GapDirection {
  const candidates = GAP_DIRECTIONS.filter((direction) => direction !== except)
  return candidates[Math.floor(Math.random() * candidates.length)]
}
