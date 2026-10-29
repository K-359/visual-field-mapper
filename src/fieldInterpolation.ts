/** 補間に使う 1 地点ぶんの値 */
export interface FieldSample {
  /** 固視点を原点とする水平方向の位置（視角、度。右が正） */
  xDeg: number
  /** 固視点を原点とする垂直方向の位置（視角、度。上が正） */
  yDeg: number
  value: number
}

/**
 * 平滑化幅を、その場所の測定点間隔の何倍にするか。
 * 1.0 に近づけるほど隣の地点と混ざって実測値の高低が潰れ、
 * 小さすぎると地点ごとの水玉模様になる。
 */
const SMOOTHING_FACTOR = 0.5
/**
 * 測定点間隔そのものをならすときの幅。地点ごとの間隔をこの幅で平均して
 * 平滑化幅を決めるので、平滑化幅は場所に対して連続に変化する。
 * （最寄りの地点の間隔をそのまま使うと、最寄りが入れ替わる線で
 *   平滑化幅が跳んで、地図に不自然な境界が出る）
 */
const GAP_SMOOTHING_DIVISOR = 4

/**
 * 測定地点間をガウス重みで補間する関数を作る。
 * 各地点の近くほどその地点の値が強く反映される。
 * 測定地点は中心ほど密・外周ほど粗いので、平滑化幅は一定にせず
 * その場所の測定点の間隔に合わせる。
 */
export function createFieldInterpolator(
  samples: FieldSample[],
  fieldRadiusDeg: number,
): (xDeg: number, yDeg: number) => number {
  // 各地点から最も近い地点までの距離＝その場所での測定の細かさ
  const nearestGapDeg = samples.map((sample, index) => {
    let smallest = Infinity
    samples.forEach((other, otherIndex) => {
      if (index === otherIndex) return
      smallest = Math.min(
        smallest,
        Math.hypot(sample.xDeg - other.xDeg, sample.yDeg - other.yDeg),
      )
    })
    return Number.isFinite(smallest) ? smallest : fieldRadiusDeg
  })
  const squaredDistances = new Float64Array(samples.length)
  const gapSmoothingDeg = Math.max(fieldRadiusDeg / GAP_SMOOTHING_DIVISOR, 1)
  const twoGapSigmaSquared = 2 * gapSmoothingDeg * gapSmoothingDeg

  return (xDeg, yDeg) => {
    // この場所での測定点間隔を、周囲の地点からなだらかに求める
    let weightedGap = 0
    let gapWeight = 0
    for (let index = 0; index < samples.length; index += 1) {
      const dx = xDeg - samples[index].xDeg
      const dy = yDeg - samples[index].yDeg
      const squared = dx * dx + dy * dy
      squaredDistances[index] = squared
      const weight = Math.exp(-squared / twoGapSigmaSquared)
      weightedGap += nearestGapDeg[index] * weight
      gapWeight += weight
    }

    const smoothingDeg = Math.max(
      (weightedGap / gapWeight) * SMOOTHING_FACTOR,
      0.5,
    )
    const twoSigmaSquared = 2 * smoothingDeg * smoothingDeg

    let weightedValue = 0
    let totalWeight = 0
    for (let index = 0; index < samples.length; index += 1) {
      const weight = Math.exp(-squaredDistances[index] / twoSigmaSquared)
      weightedValue += samples[index].value * weight
      totalWeight += weight
    }
    return weightedValue / totalWeight
  }
}
