import type { ReactNode } from 'react'
import type { BlurProfile } from './blurProfile'
import { sigmaAt } from './blurProfile'
import type { FocusPoint } from './focusPoint'

interface Props {
  focus: FocusPoint
  profile: BlurProfile
  /** ぼかしを止めて素の状態を見る（比較用） */
  disabled?: boolean
  stepCount?: number
  children: ReactNode
}

/**
 * 中心ほどぼやける表示。
 *
 * 本文は1回だけ描き、その上に `backdrop-filter` をかけた透明な層を重ねる。
 * 各層は半径方向のマスクで内側だけに効かせ、内側ほど層が重なって
 * ぼけが強くなる。
 *
 * 最初は「σ違いの本文を N 枚重ねてマスクでクロスフェード」で書いたが、
 * 本文全体を N 回ラスタライズすることになり、しかも文書はスクロールする
 * 長さぶんの面積を持つ。backdrop-filter なら本文の描画は1回きりで、層は
 * `position: fixed` でビューポートだけを覆えばよい。
 *
 * 層の置き方: 半径を等間隔に割る。
 *
 * 最初は σ を等間隔に割っていたが、これだと curve > 1 のときに層が中心付近へ
 * 密集し、外側に層が1枚も来ない。「ぼける範囲 560px」と指定しても実際の効果は
 * 278px で途切れていた。半径で割れば必ず指定した範囲全体に層が行き渡る。
 *
 * 各層の σ は、その帯での累積が profile の値に一致するよう逆算する。
 * ガウスぼかしの重ねがけは σ が二乗和の平方根で増えるので
 * σ_k = sqrt(S_k^2 - S_(k-1)^2)。
 */
export default function BlurredText({
  focus,
  profile,
  disabled = false,
  stepCount = 9,
  children,
}: Props) {
  if (disabled || profile.centerSigmaPx <= 0) {
    return <div className="blur-stack">{children}</div>
  }

  const { plateauPx, falloffPx } = profile
  const layers: { key: number; outer: number; soft: number; sigma: number }[] = []
  let cumulativeSq = 0

  for (let k = 1; k <= stepCount; k++) {
    // 外側から内側へ。k=1 が最外周
    const outer = plateauPx + (falloffPx * (stepCount - k + 1)) / stepCount
    const innerEdge = plateauPx + (falloffPx * (stepCount - k)) / stepCount
    // この帯の内側の縁で達していてほしい累積σ
    const target = sigmaAt(profile, innerEdge)
    const sigma = Math.sqrt(Math.max(0, target * target - cumulativeSq))
    if (sigma < 0.05) continue // 効果のない層は描かない
    cumulativeSq += sigma * sigma
    layers.push({
      key: k,
      outer,
      // 帯の幅ぶんかけて薄れさせる。ここを詰めると同心円の縞に見える
      soft: Math.max(2, outer - innerEdge),
      sigma,
    })
  }

  return (
    <div className="blur-stack">
      {children}
      {layers.map(({ key, outer, soft, sigma }) => {
        const gradient =
          `radial-gradient(circle ${outer}px at ${focus.x}px ${focus.y}px,` +
          ` #000 ${Math.max(0, outer - soft)}px, transparent ${outer}px)`
        return (
          <div
            key={key}
            className="blur-overlay"
            style={{
              backdropFilter: `blur(${sigma}px)`,
              WebkitBackdropFilter: `blur(${sigma}px)`,
              maskImage: gradient,
              WebkitMaskImage: gradient,
            }}
          />
        )
      })}
    </div>
  )
}
