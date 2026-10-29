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
