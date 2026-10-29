import type { Eye, PointResult } from './types'
import { createFieldInterpolator } from './fieldInterpolation'

/**
 * 見え方の体験では、記録された刺激の半径を次のように「見えにくさ」(0〜1) に置き換える。
 * 赤い円の方式で、健常者と LHON 患者の測定記録を 1 件ずつ比べて決めた暫定値で、
 * 医学的に確かめられた換算ではない（健常者は全地点 0.22° 以下、患者は中央値 0.51°・
 * 最大 1.12° だった）。ランドルト環の記録にも同じ換算を使っているが、切れ目が
 * 分かる大きさは円に気付く大きさより大きくなるため、ランドルト環の記録で見直す必要がある。
 *
 * - 半径がこの値以下なら、見えにくさ 0（健常とみなす）
 */
export const NORMAL_RADIUS_DEG = 0.5
/** - 半径がこの値以上なら、見えにくさ 1。その間は直線的に変える */
export const FULL_SEVERITY_RADIUS_DEG = 1.5

/** 最外周の測定点から外側へ、効果を弱めていく幅（視角、度） */
export const EDGE_FADE_DEG = 5

/**
 * 見えにくさを段階に分けて重ねる層。層ごとにぼかし・色の薄れ・コントラストの
 * 低下を加え、見えにくい場所ほど多くの層が重なるようにする。
 * ぼかしは視角で決め、表示時に画面までの距離からピクセルに直す。
 */
export const SIMULATION_LAYERS = [
  { blurDeg: 0.08, saturate: 0.85, contrast: 0.92 },
  { blurDeg: 0.15, saturate: 0.75, contrast: 0.85 },
  { blurDeg: 0.3, saturate: 0.65, contrast: 0.8 },
  { blurDeg: 0.6, saturate: 0.55, contrast: 0.75 },
] as const

/** 視力 1.0 の人が見分けられる最も細かい縞（視角 1 度あたりの周期数） */
const CYCLES_PER_DEG_AT_ACUITY_1 = 30

/**
 * 視力の低さを再現するために、画面全体にかけるぼかしの幅（ガウスぼかしの
 * 標準偏差、視角、度）を求める。視力 v の人が見分けられる最も細かい縞
 * （30v 周期/度）のコントラストが約 5% まで下がる幅にする。ガウスぼかしは
 * 細かさ f の縞のコントラストを exp(-2π²σ²f²) 倍にするので、これが e⁻³ ≈ 5% と
 * なる σ を使う。体験用の近似で、例えば視力 0.03 では約 0.43° になる。
 */
export function acuityBlurDeg(acuity: number): number {
  const cutoffCyclesPerDeg = CYCLES_PER_DEG_AT_ACUITY_1 * acuity
  return Math.sqrt(3 / (2 * Math.PI ** 2)) / cutoffCyclesPerDeg
}

/** マスク画像の細かさ（1 ピクセルあたりの視角、度） */
const MASK_DEG_PER_PIXEL = 0.25

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

/** 記録された刺激の半径を見えにくさ (0〜1) に直す */
function severityOf(radiusDeg: number): number {
  const value =
    (radiusDeg - NORMAL_RADIUS_DEG) /
    (FULL_SEVERITY_RADIUS_DEG - NORMAL_RADIUS_DEG)
  return Math.max(0, Math.min(1, value))
}

export interface SimulationMasks {
  /** マスクが覆う範囲の半径（視角、度）。マスクの中心がカーソル位置になる */
  radiusDeg: number
  /** 各層のマスク画像（データURL）。SIMULATION_LAYERS と同じ順 */
  layerUrls: string[]
}

/**
 * 測定結果から、各層をどこに効かせるかを表すマスク画像を作る。
 * 強さ (intensity) は見えにくさに掛ける倍率で、1 で測定値どおり。
 */
export function createSimulationMasks(
  results: PointResult[],
  eye: Eye,
  intensity: number,
): SimulationMasks {
  const samples = excludeBlindSpot(results, eye)
  const outerDeg = Math.max(...samples.map((r) => Math.hypot(r.xDeg, r.yDeg)))
  const radiusDeg = outerDeg + EDGE_FADE_DEG
  const interpolate = createFieldInterpolator(
    samples.map((r) => ({ xDeg: r.xDeg, yDeg: r.yDeg, value: severityOf(r.radiusDeg) })),
    radiusDeg,
  )

  const size = Math.ceil((radiusDeg * 2) / MASK_DEG_PER_PIXEL)
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
  const layerCount = SIMULATION_LAYERS.length

  for (let pixelY = 0; pixelY < size; pixelY += 1) {
    const yDeg = radiusDeg - ((pixelY + 0.5) / size) * radiusDeg * 2
    for (let pixelX = 0; pixelX < size; pixelX += 1) {
      const xDeg = ((pixelX + 0.5) / size) * radiusDeg * 2 - radiusDeg
      const distance = Math.hypot(xDeg, yDeg)
      if (distance > radiusDeg) continue

      // 測定した範囲の外側は、見えにくさを 0 へなだらかに戻す
      const edge = Math.min(1, Math.max(0, (radiusDeg - distance) / EDGE_FADE_DEG))
      const severity = Math.min(1, interpolate(xDeg, yDeg) * intensity) * edge
      // 見えにくさが大きいほど、上の層まで順に効かせる
      const scaled = severity * layerCount
      const dataIndex = (pixelY * size + pixelX) * 4
      images.forEach((image, layer) => {
        const alpha = Math.max(0, Math.min(1, scaled - layer))
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
