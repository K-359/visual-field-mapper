/**
 * 中心ほどぼやける「見え方」のプロファイル。
 *
 * Phase 0 はモックなので、計測データではなく手で決めたパラメータで作る。
 * 単位はピクセル。視角（度）で持つべきなのは分かっているが、体験時の視距離を
 * まだ決めていないので、ここではピクセルのまま扱う。
 *
 * Phase 1 で計測結果（48点の radiusDeg）を入れるときは、この一箇所を
 * 「座標 → σ」を返す関数に差し替えれば描画側は変えずに済む。そのために
 * sigmaAt() という形にしてある。
 */
export interface BlurProfile {
  /** 中心のぼかし強さ（ガウスσ, px） */
  centerSigmaPx: number
  /** この半径までは中心と同じ強さでぼける（px）。0 にすると中心から即座に減り始める */
  plateauPx: number
  /** plateau の外側、σ が 0 に落ちきるまでの幅（px） */
  falloffPx: number
  /**
   * 減り方の形。σ = centerSigma * (1-t)^curve （t は falloff 内の位置 0→1）
   *
   * 1 で直線。1 より大きいと中心付近で速く落ちて外側に長く尾を引き、
   * 1 より小さいと強いぼけが広く残ってから急に切れる。
   *
   * 以前は smoothstep を使っていたが、あれは中心側の傾きが 0 なので
   * 「一定にぼけた円」に見えてしまい、中心から少しずつ変化する感じが出ない。
   */
  curve: number
}

export const DEFAULT_PROFILE: BlurProfile = {
  centerSigmaPx: 16,
  // 中心に一定領域を作らない。中心が一番ぼけて、そこから連続的に薄れていく
  plateauPx: 0,
  falloffPx: 560,
  curve: 1.6,
}

/** 注視点からの距離 r における σ。 */
export function sigmaAt(profile: BlurProfile, distancePx: number): number {
  const { centerSigmaPx, plateauPx, falloffPx, curve } = profile
  if (distancePx <= plateauPx) return centerSigmaPx
  if (distancePx >= plateauPx + falloffPx) return 0
  const t = (distancePx - plateauPx) / falloffPx
  return centerSigmaPx * Math.pow(1 - t, curve)
}

/**
 * σ から半径を逆算する。上の式は解析的に解けるので探索は要らない。
 *   σ = centerSigma * (1-t)^curve  →  t = 1 - (σ/centerSigma)^(1/curve)
 */
export function radiusForSigma(profile: BlurProfile, sigma: number): number {
  const { centerSigmaPx, plateauPx, falloffPx, curve } = profile
  if (centerSigmaPx <= 0) return plateauPx
  if (sigma >= centerSigmaPx) return plateauPx
  if (sigma <= 0) return plateauPx + falloffPx
  const t = 1 - Math.pow(sigma / centerSigmaPx, 1 / curve)
  return plateauPx + t * falloffPx
}
