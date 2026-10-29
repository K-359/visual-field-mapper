export type Phase =
  | 'setup'
  | 'calibrate'
  | 'test'
  | 'result'
  | 'history'
  | 'simulate'

export type Eye = 'right' | 'left' | 'both'

/** 目から画面までの距離 (cm)。20cm 固定 */
export const VIEWING_DISTANCE_CM = 20

/**
 * 測定に使った刺激。
 * - 'landolt': 大きくなるランドルト環の切れ目の向きを矢印キーで答える
 * - 'circle': 大きくなる赤い円に気付いたら Enter を押す（以前の方式）
 */
export type Stimulus = 'landolt' | 'circle'

export const STIMULUS_LABEL: Record<Stimulus, string> = {
  landolt: 'ランドルト環',
  circle: '赤い円',
}

/** 結果の値（応答した時点の刺激の半径）の呼び名 */
export const STIMULUS_RADIUS_NAME: Record<Stimulus, string> = {
  landolt: '判別半径',
  circle: '検出半径',
}

export interface Settings {
  /** 目から画面までの距離 (cm) */
  distanceCm: number
  /** 画面上の 1mm あたりのピクセル数 */
  pxPerMm: number
  eye: Eye
  /** 測定に使った刺激。ランドルト環にする前の記録では未設定（赤い円） */
  stimulus?: Stimulus
}

/** 記録の刺激。未設定の記録は、ランドルト環にする前の赤い円とみなす */
export function stimulusOf(settings: Settings): Stimulus {
  return settings.stimulus ?? 'circle'
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

/** 固定地点で行った測定結果 */
export interface PointResult {
  /** 固視点を原点とする水平方向の位置（視角、度。右が正） */
  xDeg: number
  /** 固視点を原点とする垂直方向の位置（視角、度。上が正） */
  yDeg: number
  /**
   * 応答した時点の刺激の半径（視角、度）。ランドルト環では切れ目の向きを
   * 正しく答えた時点の外側の半径、赤い円では気付いて Enter を押した時点の半径
   */
  radiusDeg: number
  /** 同じ地点で集約した試行数。旧形式の結果では未設定 */
  sampleCount?: number
  /** この地点で円が拡大した最大半径（視角、度）。旧形式の結果では未設定 */
  maxRadiusDeg?: number
  /** ランドルト環で、正しく答えるまでに違う向きを答えた回数。赤い円では未設定 */
  wrongCount?: number
}

/** 現行の点測定と、旧バージョンの方向測定の両方を読める結果型 */
export type MeasurementResult = PointResult | DirectionResult

export function isPointResult(result: MeasurementResult): result is PointResult {
  return 'xDeg' in result
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
