export interface MeasurementLocation {
  id: string
  /** 固視点からの距離（視角、度） */
  eccentricityDeg: number
  /** 右方向を0とする角度（ラジアン） */
  angleRad: number
}

export const REPETITIONS_PER_LOCATION = 1

interface RingDefinition {
  /** 固視点からの距離（視角、度） */
  eccentricityDeg: number
  /** そのリングに等間隔で並べる地点数 */
  pointCount: number
}

/**
 * ランドルト環が拡大する最大の外側の半径（視角、度）。全地点で同じ条件に
 * するため、内側の地点で環が固視点に重なっても拡大を止めない
 * （固視点は環の上に白い縁付きで描く）
 */
export const MAX_STIMULUS_RADIUS_DEG = 5

/** 中心の固視点（赤い丸）の半径（視角、度） */
export const FIXATION_DOT_RADIUS_DEG = 0.75

/**
 * 測定点の配置は視角で固定し、画面の大きさに左右されないようにする
 * （端末や測定日が違っても同じ網膜上の位置を比べられるようにするため）。
 * 範囲は中心15°とし、5°刻みに加えて、暗点の内側を見るため2.5°にも
 * リングを置いている。最内周は8方向（東西南北とその間）、それ以外は16方向。
 * 片眼の測定では、耳側15°付近の地点が生理的な盲点（マリオット盲点）に重なる。
 */
export const RINGS: readonly RingDefinition[] = [
  { eccentricityDeg: 2.5, pointCount: 8 },
  { eccentricityDeg: 5, pointCount: 16 },
  { eccentricityDeg: 10, pointCount: 16 },
  { eccentricityDeg: 15, pointCount: 16 },
]

/** 環が最大まで広がったときの、固視点から環の端までの最大距離（視角、度） */
export const REQUIRED_EXTENT_DEG =
  Math.max(...RINGS.map((ring) => ring.eccentricityDeg)) +
  MAX_STIMULUS_RADIUS_DEG

/** 同心円ごとに等間隔の方向を配置した固定測定地点 */
export const MEASUREMENT_LOCATIONS: MeasurementLocation[] = RINGS.flatMap(
  ({ eccentricityDeg, pointCount }, ringIndex) => {
    const angleStep = (Math.PI * 2) / pointCount

    return Array.from({ length: pointCount }, (_, pointIndex) => ({
      id: `ring-${ringIndex + 1}-point-${pointIndex + 1}`,
      eccentricityDeg,
      angleRad: pointIndex * angleStep,
    }))
  },
)

export const TOTAL_TRIAL_COUNT =
  MEASUREMENT_LOCATIONS.length * REPETITIONS_PER_LOCATION

/** 全地点を指定回数ずつ含む配列を、Fisher–Yates法でシャッフルする */
export function createShuffledTrialPlan(): MeasurementLocation[] {
  const trials = MEASUREMENT_LOCATIONS.flatMap((location) =>
    Array.from({ length: REPETITIONS_PER_LOCATION }, () => location),
  )

  for (let index = trials.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = trials[index]
    trials[index] = trials[swapIndex]
    trials[swapIndex] = current
  }

  return trials
}
