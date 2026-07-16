import type { DirectionResult, Settings } from './types'
import { dirLabel, EYE_LABEL } from './types'

interface Props {
  settings: Settings
  results: DirectionResult[]
  onRetry: () => void
  onReset: () => void
}

/** 閉じた Catmull-Rom スプラインを SVG パスに変換する */
function smoothClosedPath(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n < 3) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d + ' Z'
}

const SIZE = 480
const CENTER = SIZE / 2

export default function Result({ settings, results, onRetry, onReset }: Props) {
  // 応答がなかった方向は「測定範囲の外まで見えづらい」とみなす
  const effectiveDeg = (r: DirectionResult) => r.boundaryDeg ?? r.maxDeg + 2

  const rMax = Math.max(17, ...results.map((r) => effectiveDeg(r) + 3))
  const scale = (SIZE / 2 - 30) / rMax
  const gridSteps: number[] = []
  for (let d = 5; d <= rMax - 2; d += 5) gridSteps.push(d)

  const polar = (dirDeg: number, eccDeg: number) => {
    const rad = (dirDeg * Math.PI) / 180
    return {
      x: CENTER + Math.cos(rad) * eccDeg * scale,
      y: CENTER - Math.sin(rad) * eccDeg * scale,
    }
  }

  const ordered = [...results].sort((a, b) => a.dirDeg - b.dirDeg)
  const boundaryPts = ordered.map((r) => polar(r.dirDeg, effectiveDeg(r)))

  const known = results.filter((r) => r.boundaryDeg !== null)
  const avg =
    known.length > 0
      ? known.reduce((sum, r) => sum + r.boundaryDeg!, 0) / known.length
      : null

  return (
    <div className="result">
      <h1>測定結果（{EYE_LABEL[settings.eye]}）</h1>

      <p className="lead">
        グレーの領域が「円がくっきり見えなかった範囲」です。赤い点は
        円がくっきり見えるようになった場所、点線円の目盛りは中心からの
        視角（度）です。
      </p>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="field-map"
        role="img"
        aria-label="視野マップ"
      >
        <rect
          width={SIZE}
          height={SIZE}
          fill="#fafafa"
          stroke="#ddd"
          rx={12}
        />

        {/* 目盛り円 */}
        {gridSteps.map((deg) => (
          <g key={deg}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={deg * scale}
              fill="none"
              stroke="#ccc"
              strokeDasharray="4 4"
            />
            <text
              x={CENTER + deg * scale + 3}
              y={CENTER - 4}
              fill="#888"
              fontSize={11}
            >
              {deg}°
            </text>
          </g>
        ))}

        {/* 方向ラベル */}
        <text x={CENTER} y={16} fill="#777" fontSize={13} textAnchor="middle">
          上
        </text>
        <text x={CENTER} y={SIZE - 6} fill="#777" fontSize={13} textAnchor="middle">
          下
        </text>
        <text x={10} y={CENTER + 4} fill="#777" fontSize={13}>
          左
        </text>
        <text x={SIZE - 22} y={CENTER + 4} fill="#777" fontSize={13}>
          右
        </text>

        {/* 見えづらい領域 */}
        {boundaryPts.length >= 3 && (
          <path
            d={smoothClosedPath(boundaryPts)}
            fill="rgba(120, 120, 130, 0.2)"
            stroke="#999"
            strokeWidth={1.5}
          />
        )}

        {/* 点が動いた経路と応答位置 */}
        {ordered.map((r) => {
          const end = polar(r.dirDeg, effectiveDeg(r))
          const pathEnd = polar(r.dirDeg, r.boundaryDeg ?? r.maxDeg)
          return (
            <g key={r.dirDeg}>
              <line
                x1={CENTER}
                y1={CENTER}
                x2={pathEnd.x}
                y2={pathEnd.y}
                stroke="#e5e5e5"
                strokeWidth={1}
              />
              {r.boundaryDeg !== null ? (
                <circle cx={end.x} cy={end.y} r={6} fill="#d92020" />
              ) : (
                <g stroke="#aaa" strokeWidth={2}>
                  <line
                    x1={pathEnd.x - 5}
                    y1={pathEnd.y - 5}
                    x2={pathEnd.x + 5}
                    y2={pathEnd.y + 5}
                  />
                  <line
                    x1={pathEnd.x - 5}
                    y1={pathEnd.y + 5}
                    x2={pathEnd.x + 5}
                    y2={pathEnd.y - 5}
                  />
                </g>
              )}
            </g>
          )
        })}

        {/* 中心マーク */}
        <line
          x1={CENTER - 6}
          y1={CENTER}
          x2={CENTER + 6}
          y2={CENTER}
          stroke="#d92020"
          strokeWidth={2}
        />
        <line
          x1={CENTER}
          y1={CENTER - 6}
          x2={CENTER}
          y2={CENTER + 6}
          stroke="#d92020"
          strokeWidth={2}
        />
      </svg>

      {avg !== null && (
        <p className="summary-line">
          平均すると、中心からおよそ <strong>{avg.toFixed(1)}°</strong>{' '}
          のあたりから円がくっきり見えるようになっています。
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th>方向</th>
            <th>円がくっきり見えるようになった距離（視角）</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((r) => (
            <tr key={r.dirDeg}>
              <td>{dirLabel(r.dirDeg)}</td>
              <td>
                {r.boundaryDeg !== null
                  ? `約 ${r.boundaryDeg.toFixed(1)}°`
                  : `${r.maxDeg}° より外側（範囲内では応答なし）`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="warn">
        ⚠️ この結果は簡易測定による目安です。固視のずれや環境によって変わります。
        正確な評価は眼科の視野検査で行ってください。
      </p>

      <div className="button-row">
        <button className="primary" onClick={onRetry}>
          同じ設定でもう一度
        </button>
        <button onClick={onReset}>設定からやり直す</button>
      </div>
    </div>
  )
}
