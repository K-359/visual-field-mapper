export interface MeasurementLocation {
  id: string
  /** 最外周を1とする、固視点からの距離 */
  radiusRatio: number
  /** 右方向を0とする角度（ラジアン） */
  angleRad: number
}

export const REPETITIONS_PER_LOCATION = 1
export const RING_POINT_COUNTS = [16, 16, 16] as const

/** 3つの同心円それぞれに、共通する16方向を配置した固定測定地点 */
export const MEASUREMENT_LOCATIONS: MeasurementLocation[] =
  RING_POINT_COUNTS.flatMap((pointCount, ringIndex) => {
    const radiusRatio = (ringIndex + 1) / RING_POINT_COUNTS.length
    const angleStep = (Math.PI * 2) / pointCount

    return Array.from({ length: pointCount }, (_, pointIndex) => ({
      id: `ring-${ringIndex + 1}-point-${pointIndex + 1}`,
      radiusRatio,
      angleRad: pointIndex * angleStep,
    }))
  })

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
