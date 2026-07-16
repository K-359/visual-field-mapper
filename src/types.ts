export type Phase = 'setup' | 'test' | 'result' | 'history'

export type Eye = 'right' | 'left' | 'both'

export interface Settings {
  /** 目から画面までの距離 (cm) */
  distanceCm: number
  /** 画面上の 1mm あたりのピクセル数 */
  pxPerMm: number
  eye: Eye
}

/** 1方向ぶんの測定結果 */
export interface DirectionResult {
  /** 方向（度、0=右、90=上、反時計回り） */
  dirDeg: number
  /** この方向で画面内に表示できた最大離心度（視角、度） */
  maxDeg: number
  /** キー操作で円がくっきり見えた境界の離心度（視角、度） */
  boundaryDeg: number | null
}

/** 検査に使う 16 方向（22.5° 刻み） */
export const DIRECTIONS = Array.from({ length: 16 }, (_, i) => i * 22.5)

/** 視角 1 度あたりのピクセル数を計算する */
export function pxPerDeg(s: Settings): number {
  return s.distanceCm * 10 * Math.tan(Math.PI / 180) * s.pxPerMm
}

export const EYE_LABEL: Record<Eye, string> = {
  right: '右眼',
  left: '左眼',
  both: '両眼',
}

const MAIN_DIR_LABEL: Record<number, string> = {
  0: '右',
  45: '右上',
  90: '上',
  135: '左上',
  180: '左',
  225: '左下',
  270: '下',
  315: '右下',
}

/** 方向のラベル。主要8方向は名前、それ以外は角度で表す */
export function dirLabel(dirDeg: number): string {
  return MAIN_DIR_LABEL[dirDeg] ?? `${dirDeg}°`
}
