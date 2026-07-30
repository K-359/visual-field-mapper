export interface MeasurementLocation {
  id: string
  /** 最外周を1とする、固視点からの距離 */
  radiusRatio: number
  /** 右方向を0とする角度（ラジアン） */
  angleRad: number
}

export const REPETITIONS_PER_LOCATION = 1

interface RingDefinition {
  /** 最外周を1とする、固視点からの距離 */
  radiusRatio: number
  /** そのリングに等間隔で並べる地点数 */
  pointCount: number
}

/**
 * 中心寄りの感度をより細かく見るため、最内周（1/3）と固視点のちょうど中間に
 * 8方向（東西南北とその間）のリングを追加している
 */
export const RINGS: readonly RingDefinition[] = [
  { radiusRatio: 1 / 6, pointCount: 8 },
  { radiusRatio: 1 / 3, pointCount: 16 },
  { radiusRatio: 2 / 3, pointCount: 16 },
  { radiusRatio: 1, pointCount: 16 },
]

/** 同心円ごとに等間隔の方向を配置した固定測定地点 */
export const MEASUREMENT_LOCATIONS: MeasurementLocation[] = RINGS.flatMap(
  ({ radiusRatio, pointCount }, ringIndex) => {
    const angleStep = (Math.PI * 2) / pointCount

    return Array.from({ length: pointCount }, (_, pointIndex) => ({
      id: `ring-${ringIndex + 1}-point-${pointIndex + 1}`,
      radiusRatio,
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
