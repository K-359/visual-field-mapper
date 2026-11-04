import type { Eye, PointResult, Stimulus } from './types'
import { createFieldInterpolator } from './fieldInterpolation'
import { LANDOLT_GAP_PER_OUTER_RADIUS } from './landolt'

/** 視力 1.0 の人が見分けられる最も細かい縞（視角 1 度あたりの周期数） */
const CYCLES_PER_DEG_AT_ACUITY_1 = 30

/**
 * 見分けられる最小の角度（最小分離角、分）が m の目の見え方を再現するために
 * かけるぼかしの幅（ガウスぼかしの標準偏差、視角、度）。小数視力は 1/m。
 * その目が見分けられる最も細かい縞（30/m 周期/度）のコントラストが約 5% まで
 * 下がる幅にする。ガウスぼかしは細かさ f の縞のコントラストを exp(-2π²σ²f²) 倍に
 * するので、これが e⁻³ ≈ 5% となる σ を使う。体験用の近似で、例えば最小分離角
 * 33 分（視力 0.03）では約 0.43° になる。
 */
function blurDegForMarArcmin(marArcmin: number): number {
  const cutoffCyclesPerDeg = CYCLES_PER_DEG_AT_ACUITY_1 / marArcmin
  return Math.sqrt(3 / (2 * Math.PI ** 2)) / cutoffCyclesPerDeg
}

/** 小数視力 acuity の見え方を再現するために、画面全体にかけるぼかしの幅（度） */
export function acuityBlurDeg(acuity: number): number {
  return blurDegForMarArcmin(1 / acuity)
}

/**
 * 健常な目の最小分離角（分）。中心窩で 1 分（視力 1.0）とし、周辺ほど
 * 離心度に比例して大きくなる（離心度 2.5° ごとに 1 分ずつ増える）という、
 * 周辺視力の一般的な近似を使う。例えば 10° で 5 分（視力 0.2）、15° で 7 分。
 */
const NORMAL_FOVEAL_MAR_ARCMIN = 1
const NORMAL_MAR_DOUBLING_ECCENTRICITY_DEG = 2.5

function normalMarArcmin(eccentricityDeg: number): number {
  return (
    NORMAL_FOVEAL_MAR_ARCMIN *
    (1 + eccentricityDeg / NORMAL_MAR_DOUBLING_ECCENTRICITY_DEG)
  )
}

/**
 * ランドルト環で正しく答えた環の外側の半径（度）から、その場所の最小分離角
 * （分）を求める。切れ目の幅が、その場所で見分けられた最小の角度になる。
 * 例えば半径 1.8° なら切れ目は 0.72° = 43 分（視力 約 0.023）。
 * 応答までの時間のぶん環は大きくなっているので、実際よりやや大きめに出る。
 */
function landoltMarArcmin(radiusDeg: number): number {
  return radiusDeg * LANDOLT_GAP_PER_OUTER_RADIUS * 60
}

/**
 * 赤い円（以前の方式）の記録では、気付いた円の半径を次のように「見えにくさ」
 * (0〜1) に置き換え、見えにくさ 1 で CIRCLE_FULL_BLUR_DEG のぼかしをかける。
 * 円に気付く大きさは視力と直接は結び付かないため、健常者と LHON 患者の
 * 測定記録を 1 件ずつ比べて決めた暫定値（健常者は全地点 0.22° 以下、患者は
 * 中央値 0.51°・最大 1.12° だった）で、医学的に確かめられた換算ではない。
 *
 * - 半径がこの値以下なら、見えにくさ 0（健常とみなす）
 */
export const NORMAL_RADIUS_DEG = 0.5
/** - 半径がこの値以上なら、見えにくさ 1。その間は直線的に変える */
export const FULL_SEVERITY_RADIUS_DEG = 1.5
/** - 見えにくさ 1 でかけるぼかしの幅（度） */
const CIRCLE_FULL_BLUR_DEG = 0.7

function circleSeverity(radiusDeg: number): number {
  const value =
    (radiusDeg - NORMAL_RADIUS_DEG) /
    (FULL_SEVERITY_RADIUS_DEG - NORMAL_RADIUS_DEG)
  return Math.max(0, Math.min(1, value))
}

/**
 * ぼかしを段階に分けて重ねる層。各層までを重ねたときのぼかしの幅
 * （視角、度）が次の値になるように、層ごとのぼかしを決める。ガウスぼかしを
 * 重ねると幅は二乗和の平方根で増えるので、層 k のぼかしは
 * sqrt(S_k² - S_(k-1)²)。必要なぼかしが大きい場所ほど多くの層を効かせる。
 */
const CUMULATIVE_BLUR_DEG = [0.1, 0.2, 0.4, 0.8, 1.6] as const

/**
 * 層ごとの色の薄れ。LHON では見えにくい場所で色も分かりにくくなるため、
 * ぼかしが大きい場所ほど色を薄くする。コントラストを下げると暗い背景が
 * 灰色に浮いて見えるため、明るさとコントラストは変えない。
 */
const LAYER_SATURATE = 0.85

export const SIMULATION_LAYERS = CUMULATIVE_BLUR_DEG.map((total, index) => {
  const previous = index === 0 ? 0 : CUMULATIVE_BLUR_DEG[index - 1]
  return {
    blurDeg: Math.sqrt(total ** 2 - previous ** 2),
    saturate: LAYER_SATURATE,
  }
})

/** マスク画像の細かさの上限（1 ピクセルあたりの視角、度） */
const MIN_MASK_DEG_PER_PIXEL = 0.25
/** マスク画像の一辺の最大ピクセル数（作る時間を抑えるため） */
const MAX_MASK_SIZE = 720
/** 測定範囲の外で値を延長するときの、方向の刻み（度） */
const OUTSIDE_ANGLE_STEP_DEG = 0.5

/**
 * 補間のなめらかさを決める視野の半径を、最外周の地点からどれだけ外側に取るか
 * （視角、度）。結果画面と同じく、最外周より少し外側までを視野とみなす
 */
const INTERPOLATION_MARGIN_DEG = 5

/** 片眼の測定で、生理的な盲点（マリオット盲点）の中心とみなす位置（耳側、度） */
const BLIND_SPOT_CENTER = { temporalDeg: 15, yDeg: -1.5 }
/** この距離（視角、度）以内の地点を盲点の測定点とみなす */
const BLIND_SPOT_RADIUS_DEG = 4

/**
 * 生理的な盲点は健常な眼にもあり、両眼で見ていれば気付かないため、
 * 体験には含めない。片眼の測定では盲点に重なる地点を除き、周りの地点から補う。
 * 右眼は右側、左眼は左側が耳側になる。
 */
function excludeBlindSpot(results: PointResult[], eye: Eye): PointResult[] {
  if (eye === 'both') return results
  const centerX =
    eye === 'right' ? BLIND_SPOT_CENTER.temporalDeg : -BLIND_SPOT_CENTER.temporalDeg
  const remaining = results.filter(
    (result) =>
      Math.hypot(result.xDeg - centerX, result.yDeg - BLIND_SPOT_CENTER.yDeg) >
      BLIND_SPOT_RADIUS_DEG,
  )
  return remaining.length > 0 ? remaining : results
}

export interface SimulationMasks {
  /** マスクが覆う範囲の半径（視角、度）。マスクの中心がカーソル位置になる */
  radiusDeg: number
  /** 各層のマスク画像（データURL）。SIMULATION_LAYERS と同じ順 */
  layerUrls: string[]
}

/**
 * 測定結果から、各層をどこに効かせるかを表すマスク画像を作る。
 *
 * ランドルト環の記録では、各地点の最小分離角から患者さんの見え方に必要な
 * ぼかしを求め、体験する人の目がその離心度でもともと見分けられない分を
 * 差し引いて、足りない分だけをぼかす（健常者の記録ならほとんどぼけない）。
 * 体験する人はカーソルの先を見るので、マスクの中心からの距離がそのまま
 * 体験する人の離心度になる。
 *
 * 測定範囲（最外周の地点）より外側は、同じ方向の最外周の値をそのまま延長する。
 * coverRadiusDeg は効果をかける範囲の半径（度）で、画面全体を覆う大きさを渡す。
 * 強さ (intensity) はぼかしの幅に掛ける倍率で、1 で測定値どおり。
 */
export function createSimulationMasks(
  results: PointResult[],
  eye: Eye,
  stimulus: Stimulus,
  intensity: number,
  coverRadiusDeg: number,
): SimulationMasks {
  const samples = excludeBlindSpot(results, eye)
  const outerDeg = Math.max(...samples.map((r) => Math.hypot(r.xDeg, r.yDeg)))
  const radiusDeg = Math.max(coverRadiusDeg, outerDeg)
  // ランドルト環では患者さんの目に必要なぼかしの幅、赤い円では見えにくさを補間する
  const interpolate = createFieldInterpolator(
    samples.map((r) => ({
      xDeg: r.xDeg,
      yDeg: r.yDeg,
      value:
        stimulus === 'landolt'
          ? blurDegForMarArcmin(landoltMarArcmin(r.radiusDeg))
          : circleSeverity(r.radiusDeg),
    })),
    outerDeg + INTERPOLATION_MARGIN_DEG,
  )
  // 測定範囲の外は方向だけで値が決まるので、方向ごとにまとめて求めておく
  const outsideValues = new Map<number, number>()
  const valueAt = (xDeg: number, yDeg: number, distance: number) => {
    if (distance <= outerDeg) return interpolate(xDeg, yDeg)
    const step = (OUTSIDE_ANGLE_STEP_DEG * Math.PI) / 180
    const bin = Math.round(Math.atan2(yDeg, xDeg) / step)
    let value = outsideValues.get(bin)
    if (value === undefined) {
      const angle = bin * step
      value = interpolate(Math.cos(angle) * outerDeg, Math.sin(angle) * outerDeg)
      outsideValues.set(bin, value)
    }
    return value
  }
  // 体験する人の目に、追加でかけるぼかしの幅（度）
  const extraBlurDeg = (xDeg: number, yDeg: number, distance: number) => {
    const value = valueAt(xDeg, yDeg, distance)
    if (stimulus === 'circle') return value * CIRCLE_FULL_BLUR_DEG * intensity
    const viewerBlur = blurDegForMarArcmin(normalMarArcmin(distance))
    return Math.sqrt(Math.max(0, value ** 2 - viewerBlur ** 2)) * intensity
  }

  const size = Math.min(
    MAX_MASK_SIZE,
    Math.ceil((radiusDeg * 2) / MIN_MASK_DEG_PER_PIXEL),
  )
  const canvases = SIMULATION_LAYERS.map(() => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    return canvas
  })
  const contexts = canvases.map((canvas) => canvas.getContext('2d'))
  if (contexts.some((context) => context === null)) {
    return { radiusDeg, layerUrls: [] }
  }
  const images = contexts.map((context) => context!.createImageData(size, size))

  for (let pixelY = 0; pixelY < size; pixelY += 1) {
    const yDeg = radiusDeg - ((pixelY + 0.5) / size) * radiusDeg * 2
    for (let pixelX = 0; pixelX < size; pixelX += 1) {
      const xDeg = ((pixelX + 0.5) / size) * radiusDeg * 2 - radiusDeg
      const distance = Math.hypot(xDeg, yDeg)
      if (distance > radiusDeg) continue

      const blur = extraBlurDeg(xDeg, yDeg, distance)
      const dataIndex = (pixelY * size + pixelX) * 4
      // 必要なぼかしに届くまで内側の層から順に効かせ、最後の層は途中の濃さにする
      images.forEach((image, layer) => {
        const from = layer === 0 ? 0 : CUMULATIVE_BLUR_DEG[layer - 1]
        const to = CUMULATIVE_BLUR_DEG[layer]
        const alpha = Math.max(0, Math.min(1, (blur - from) / (to - from)))
        image.data[dataIndex] = 255
        image.data[dataIndex + 1] = 255
        image.data[dataIndex + 2] = 255
        image.data[dataIndex + 3] = Math.round(alpha * 255)
      })
    }
  }

  return {
    radiusDeg,
    layerUrls: canvases.map((canvas, layer) => {
      contexts[layer]!.putImageData(images[layer], 0, 0)
      return canvas.toDataURL('image/png')
    }),
  }
}
