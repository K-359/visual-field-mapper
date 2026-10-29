import { useMemo, useState } from 'react'
import type {
  DirectionResult,
  MeasurementResult,
  PointResult,
  Settings,
} from './types'
import { dirLabel, EYE_LABEL, isPointResult } from './types'
import { averageBoundaryDeg, formatSavedAt } from './historyStore'
import { createFieldInterpolator } from './fieldInterpolation'

interface Props {
  settings: Settings
  results: MeasurementResult[]
  /** 履歴に保存された日時 (ISO 8601)。サンプル表示など未保存のときは null */
  savedAt: string | null
  onRetry: () => void
  onReset: () => void
  onHistory: () => void
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
const HEATMAP_RESOLUTION = 200
/** 最外周の地点から外側へ、色を透過させていく縁の幅（最外周の半径に対する比） */
const EDGE_FADE_RATIO = 0.08
/** 地点の同心円がこの数以下なら、点線を同心円に重ねる */
const MAX_RING_GUIDES = 6

type Rgba = [number, number, number, number]

/** 淡い黄色 → オレンジ → 濃い赤の連続色を返す */
function heatmapColor(value: number): Rgba {
  const low: Rgba = [255, 244, 179, 215]
  const middle: Rgba = [242, 142, 43, 225]
  const high: Rgba = [166, 24, 40, 235]
  const start = value < 0.5 ? low : middle
  const end = value < 0.5 ? middle : high
  const amount = value < 0.5 ? value * 2 : (value - 0.5) * 2

  return start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * amount),
  ) as Rgba
}

/**
 * 測定地点間を補間し、透過PNGのデータURLを作る。
 * 最外周の地点（fadeStartDeg）までは不透明に塗り、その外側だけを透過させる。
 */
function createHeatmapDataUrl(
  results: PointResult[],
  fieldRadiusDeg: number,
  fadeStartDeg: number,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = HEATMAP_RESOLUTION
  canvas.height = HEATMAP_RESOLUTION
  const context = canvas.getContext('2d')
  if (context === null) return ''

  const image = context.createImageData(
    HEATMAP_RESOLUTION,
    HEATMAP_RESOLUTION,
  )
  const radii = results.map((result) => result.radiusDeg)
  const minRadius = Math.min(...radii)
  const maxRadius = Math.max(...radii)
  const valueRange = maxRadius - minRadius
  const interpolate = createFieldInterpolator(
    results.map((result) => ({
      xDeg: result.xDeg,
      yDeg: result.yDeg,
      value: result.radiusDeg,
    })),
    fieldRadiusDeg,
  )
  const fadeWidthDeg = Math.max(fieldRadiusDeg - fadeStartDeg, 0.001)

  for (let pixelY = 0; pixelY < HEATMAP_RESOLUTION; pixelY += 1) {
    const yDeg =
      (1 - pixelY / (HEATMAP_RESOLUTION - 1) * 2) * fieldRadiusDeg

    for (let pixelX = 0; pixelX < HEATMAP_RESOLUTION; pixelX += 1) {
      const xDeg =
        (pixelX / (HEATMAP_RESOLUTION - 1) * 2 - 1) * fieldRadiusDeg
      const distanceFromCenter = Math.hypot(xDeg, yDeg)
      if (distanceFromCenter > fieldRadiusDeg) continue

      const interpolated = interpolate(xDeg, yDeg)
      const normalized =
        valueRange > 0 ? (interpolated - minRadius) / valueRange : 0.5
      const color = heatmapColor(Math.max(0, Math.min(1, normalized)))
      // 最外周の地点より外側を滑らかに透過させる
      const edgeOpacity = Math.min(
        1,
        Math.max(0, (fieldRadiusDeg - distanceFromCenter) / fadeWidthDeg),
      )
      const dataIndex = (pixelY * HEATMAP_RESOLUTION + pixelX) * 4
      image.data[dataIndex] = color[0]
      image.data[dataIndex + 1] = color[1]
      image.data[dataIndex + 2] = color[2]
      image.data[dataIndex + 3] = Math.round(color[3] * edgeOpacity)
    }
  }

  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

export default function Result(props: Props) {
  const pointResults = props.results.filter(isPointResult)
  if (pointResults.length > 0) {
    return <PointResultView {...props} results={pointResults} />
  }

  return (
    <DirectionResultView
      {...props}
      results={props.results.filter(
        (result): result is DirectionResult => !isPointResult(result),
      )}
    />
  )
}

function ResultActions({
  onRetry,
  onReset,
  onHistory,
}: Pick<Props, 'onRetry' | 'onReset' | 'onHistory'>) {
  return (
    <div className="button-row">
      <button className="primary" onClick={onRetry}>
        同じ設定でもう一度
      </button>
      <button onClick={onReset}>設定からやり直す</button>
      <button onClick={onHistory}>測定履歴</button>
    </div>
  )
}

function PointResultView({
  settings,
  results,
  savedAt,
  onRetry,
  onReset,
  onHistory,
}: Omit<Props, 'results'> & { results: PointResult[] }) {
  const [showValues, setShowValues] = useState(true)
  const pointMapSize = 560
  const center = pointMapSize / 2
  const outerLocationRadius = Math.max(
    ...results.map((result) => Math.hypot(result.xDeg, result.yDeg)),
  )
  const maxDetectedRadius = Math.max(
    ...results.map((result) => result.radiusDeg),
  )
  // 最外周の地点の外側に、透過させるための縁を設ける
  const fieldRadius = Math.max(
    1,
    outerLocationRadius +
      Math.max(maxDetectedRadius / 2, outerLocationRadius * EDGE_FADE_RATIO),
  )
  const extent = Math.max(10, fieldRadius)
  // 数値ラベルは地点の外側に出るので、そのぶん描画を内側に寄せる。
  // 表示切り替えで円の大きさが変わらないよう、余白はラベルの有無によらず一定にする
  const mapMargin = 42
  const scale = (center - mapMargin) / extent
  // 測定地点は同心円状に並ぶので、点線はその同心円に重ねる
  const ringRadii = [
    ...new Set(
      results
        .map((result) => Math.hypot(result.xDeg, result.yDeg))
        .filter((eccentricity) => eccentricity > 0.01)
        .map((eccentricity) => Number(eccentricity.toFixed(2))),
    ),
  ].sort((a, b) => a - b)
  // 地点が同心円に並ばない旧形式の結果では、一定間隔の目盛りにする
  const gridInterval = extent <= 25 ? 5 : extent <= 50 ? 10 : 20
  const isRingGuide = ringRadii.length <= MAX_RING_GUIDES
  const gridSteps: number[] = []
  if (isRingGuide) {
    gridSteps.push(...ringRadii)
  } else {
    for (let deg = gridInterval; deg < extent; deg += gridInterval) {
      gridSteps.push(deg)
    }
  }

  const radii = results.map((result) => result.radiusDeg)
  const average = radii.reduce((sum, radius) => sum + radius, 0) / radii.length
  const min = Math.min(...radii)
  const max = Math.max(...radii)
  const sampleCount = results.every(
    (result) => result.sampleCount === results[0].sampleCount,
  )
    ? results[0].sampleCount
    : undefined
  const heatmapDataUrl = useMemo(
    () => createHeatmapDataUrl(results, fieldRadius, outerLocationRadius),
    [fieldRadius, outerLocationRadius, results],
  )

  return (
    <div className="result point-result">
      <h1>測定結果（{EYE_LABEL[settings.eye]}）</h1>

      {savedAt !== null && (
        <p className="saved-at">
          測定日時: {formatSavedAt(savedAt)}（この端末の履歴に保存済み）
        </p>
      )}

      <p className="lead">
        {sampleCount === 1
          ? `${results.length}箇所を1回ずつ測定した結果です。`
          : sampleCount !== undefined
          ? `${results.length}箇所を各${sampleCount}回測定した平均結果です。`
          : `${results.length}回の測定結果です。`}
        色の濃い赤い場所ほど、気付くまでに大きな刺激が必要だったことを示します。
        地点に添えた数字は、その場所で気付いた円の半径（度）です。
      </p>

      <div className="result-chart point-result-chart">
        <svg
          viewBox={`0 0 ${pointMapSize} ${pointMapSize}`}
          className="field-map"
          role="img"
          aria-label={`${results.length}箇所の円検出マップ`}
        >
          <rect
            width={pointMapSize}
            height={pointMapSize}
            fill="#fafafa"
            stroke="#ddd"
            rx={12}
          />

          {heatmapDataUrl !== '' && (
            <image
              href={heatmapDataUrl}
              x={center - fieldRadius * scale}
              y={center - fieldRadius * scale}
              width={fieldRadius * scale * 2}
              height={fieldRadius * scale * 2}
              aria-hidden="true"
            />
          )}

          {gridSteps.map((deg) => (
            <g key={deg}>
              <circle
                cx={center}
                cy={center}
                r={deg * scale}
                fill="none"
                stroke="#ccc"
                strokeDasharray="4 4"
              />
              {/* 同心円に重ねた点線には度数を添えない。旧形式の目盛りにだけ付ける */}
              {!isRingGuide && center + deg * scale + 3 < pointMapSize - 60 && (
                <text
                  x={center + deg * scale + 3}
                  y={center - 4}
                  fill="#555"
                  fontSize={15}
                >
                  {deg}°
                </text>
              )}
            </g>
          ))}

          <line x1={center} y1={20} x2={center} y2={pointMapSize - 20} stroke="#ddd" />
          <line x1={20} y1={center} x2={pointMapSize - 20} y2={center} stroke="#ddd" />

          {results.map((result, index) => {
            const pointX = center + result.xDeg * scale
            const pointY = center - result.yDeg * scale
            // ラベルは固視点から見て地点の外側に置き、地点どうしの間隔を稼ぐ
            const eccentricity = Math.hypot(result.xDeg, result.yDeg)
            const labelOffset = 12
            const labelX =
              eccentricity > 0
                ? pointX + (result.xDeg / eccentricity) * labelOffset
                : pointX
            const labelY =
              eccentricity > 0
                ? pointY - (result.yDeg / eccentricity) * labelOffset
                : pointY - labelOffset

            return (
              <g key={index}>
                <circle
                  cx={pointX}
                  cy={pointY}
                  r={2.5}
                  fill="#fff"
                  fillOpacity={0.8}
                  stroke="#7d1822"
                  strokeWidth={1}
                >
                  <title>
                    地点{index + 1}: 位置 ({result.xDeg.toFixed(1)}°,
                    {result.yDeg.toFixed(1)}°)、
                    {result.sampleCount !== undefined && result.sampleCount > 1
                      ? `${result.sampleCount}回の平均半径`
                      : '検出半径'}{' '}
                    {result.radiusDeg.toFixed(2)}°
                  </title>
                </circle>
                {showValues && (
                  <text
                    x={labelX}
                    y={labelY}
                    fill="#3d0a0f"
                    fontSize={13}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    stroke="#fff"
                    strokeWidth={3}
                    strokeOpacity={0.9}
                    paintOrder="stroke"
                    aria-hidden="true"
                  >
                    {result.radiusDeg.toFixed(1)}
                  </text>
                )}
              </g>
            )
          })}

          <text x={center} y={26} fill="#333" fontSize={20} fontWeight="bold" textAnchor="middle">
            上
          </text>
          <text x={center} y={pointMapSize - 8} fill="#333" fontSize={20} fontWeight="bold" textAnchor="middle">
            下
          </text>
          <text x={8} y={center + 7} fill="#333" fontSize={20} fontWeight="bold">
            左
          </text>
          <text x={pointMapSize - 28} y={center + 7} fill="#333" fontSize={20} fontWeight="bold">
            右
          </text>

          <circle cx={center} cy={center} r={5} fill="#d92020" />
        </svg>

        <label className="value-toggle">
          <input
            type="checkbox"
            checked={showValues}
            onChange={(event) => setShowValues(event.target.checked)}
          />
          各地点の数値（検出半径・度）を表示
        </label>

        <div
          className="heatmap-legend"
          role="img"
          aria-label={`検出半径 ${min.toFixed(2)}度から${max.toFixed(2)}度の色見本`}
        >
          <div className="heatmap-legend-bar" />
          <div className="heatmap-legend-labels">
            <span>小さい刺激で気付く　{min.toFixed(2)}°</span>
            <span>大きい刺激が必要　{max.toFixed(2)}°</span>
          </div>
        </div>

        <p className="summary-line">
          平均検出半径 <strong>{average.toFixed(2)}°</strong>
        </p>
        <p className="result-stats">
          測定 {results.length}箇所
          {sampleCount !== undefined ? `（各${sampleCount}回）` : ''} ／ 最小{' '}
          {min.toFixed(2)}° ／ 最大 {max.toFixed(2)}°
        </p>
      </div>

      <p className="warn">
        ⚠️ この結果は簡易測定による目安です。固視のずれや環境によって変わります。
        正確な評価は眼科の視野検査で行ってください。
      </p>

      <ResultActions onRetry={onRetry} onReset={onReset} onHistory={onHistory} />
    </div>
  )
}

function DirectionResultView({
  settings,
  results,
  savedAt,
  onRetry,
  onReset,
  onHistory,
}: Omit<Props, 'results'> & { results: DirectionResult[] }) {
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

  const avg = averageBoundaryDeg(results)

  return (
    <div className="result">
      <h1>測定結果（{EYE_LABEL[settings.eye]}）</h1>

      {savedAt !== null && (
        <p className="saved-at">
          測定日時: {formatSavedAt(savedAt)}（この端末の履歴に保存済み）
        </p>
      )}

      <p className="lead">
        グレーの領域が「円がくっきり見えなかった範囲」です。赤い点は
        円がくっきり見えるようになった場所、点線円の目盛りは中心からの
        視角（度）です。
      </p>

      <div className="result-columns">
        <div className="result-chart">
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
                {/* 右端の「右」ラベルと重なる位置の目盛りは表示しない */}
                {CENTER + deg * scale + 3 < SIZE - 70 && (
                  <text
                    x={CENTER + deg * scale + 3}
                    y={CENTER - 4}
                    fill="#555"
                    fontSize={16}
                  >
                    {deg}°
                  </text>
                )}
              </g>
            ))}

            {/* 方向ラベル */}
            <text x={CENTER} y={26} fill="#333" fontSize={22} fontWeight="bold" textAnchor="middle">
              上
            </text>
            <text x={CENTER} y={SIZE - 8} fill="#333" fontSize={22} fontWeight="bold" textAnchor="middle">
              下
            </text>
            <text x={8} y={CENTER + 8} fill="#333" fontSize={22} fontWeight="bold">
              左
            </text>
            <text x={SIZE - 30} y={CENTER + 8} fill="#333" fontSize={22} fontWeight="bold">
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
        </div>

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
      </div>

      <p className="warn">
        ⚠️ この結果は簡易測定による目安です。固視のずれや環境によって変わります。
        正確な評価は眼科の視野検査で行ってください。
      </p>

      <ResultActions onRetry={onRetry} onReset={onReset} onHistory={onHistory} />
    </div>
  )
}
