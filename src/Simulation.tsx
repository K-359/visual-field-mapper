import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import type { Eye, PointResult, Stimulus } from './types'
import { EYE_LABEL, pxPerDeg } from './types'
import {
  SIMULATION_LAYERS,
  acuityBlurDeg,
  createFixedMasks,
  createMeasuredMasks,
} from './simulationModel'
import { CodeEditorScene, DocumentScene } from './SimulationScenes'

interface Props {
  results: PointResult[]
  /** 測定した眼。片眼の測定では生理的な盲点を体験から除く */
  eye: Eye
  /** 測定に使った刺激。ランドルト環では、各地点の測定値から視力を求める */
  stimulus: Stimulus
  /** 体験する画面の 1mm あたりのピクセル数 */
  pxPerMm: number
  /** pxPerMm がこの画面で合わせた値か。false なら大きさは目安 */
  isCalibrated: boolean
  onBack: () => void
}

type Scene = 'code' | 'document'

/**
 * ぼかしのもと。
 * - 'fixed': 測定結果を使わず、カーソルの位置が最も強くぼけて外側へ薄れる
 *   固定の形（以前の試作 origin/simulator と同じ考え方）
 * - 'measured': 開いた記録の測定結果から、場所ごとのぼかしを求める
 *
 * 患者さんの測定結果では中心があまりぼけず、思ったより見えてしまうため、
 * 中心視野の見えにくさが分かりやすい固定の形を既定にする
 */
type Source = 'fixed' | 'measured'

const SOURCE_LABEL: Record<Source, string> = {
  fixed: '固定のぼかし',
  measured: '測定結果',
}
const DEFAULT_SOURCE: Source = 'fixed'

/** 固定のぼかしで、カーソルの位置でのぼかしの幅（視角、度）の範囲と既定値 */
const CENTER_BLUR_MAX_DEG = 3
const DEFAULT_CENTER_BLUR_DEG = 2
/** 固定のぼかしで、ぼかしが 0 になるまでの距離（視角、度）の範囲と既定値 */
const RANGE_MIN_DEG = 5
const RANGE_MAX_DEG = 40
const DEFAULT_RANGE_DEG = 25

const SCENE_LABEL: Record<Scene, string> = {
  code: 'コードエディタ風',
  document: '文書作成ソフト風',
}

/**
 * 体験する人が画面を見る距離の選択肢 (cm)。LHON の方は視力が低く
 * （例: 0.03）、画面に近づいて 20cm ほどで見ることが多いため、20cm を既定にする
 */
const DISTANCE_OPTIONS = [15, 20, 25, 30, 40, 50, 60]
const DEFAULT_DISTANCE_CM = 20

/**
 * 本文（コードや文書）の拡大率の選択肢 (%)。LHON の方は文字をかなり大きくして
 * 使う（協力いただいた方は 500% より大きくしていた）ため、700% を既定にする。
 * 実際のアプリでも、拡大するのは本文だけでメニューなどはそのままのことが多い
 */
const ZOOM_OPTIONS = [100, 200, 300, 500, 700, 1000, 1500]
const DEFAULT_ZOOM_PERCENT = 700

/**
 * 再現する視力の選択肢（赤い円の記録だけで使う）。'none' は視力を再現しない
 * （視野の結果だけを再現する）。既定は、体験に協力いただいた LHON の方の
 * 視力 0.03 にする。ランドルト環の記録は各地点の視力が分かるため使わない
 */
const ACUITY_OPTIONS = ['none', '0.5', '0.2', '0.1', '0.05', '0.03', '0.02', '0.01']
const DEFAULT_ACUITY = '0.03'

/**
 * 体験画面に出すカーソルの、拡大率 100% のときの高さ（px）。体験する人は
 * カーソルを見続けるため、OS のカーソルは隠し、本文の拡大率に合わせて
 * 大きくしたカーソルを代わりに出す（LHON の方もカーソルを大きくして使うことが多い）
 */
const CURSOR_BASE_HEIGHT_PX = 24

/**
 * 文字を入力するときの I 字型のカーソルの形（一辺 24 の座標で、中心が (12, 12)）。
 * コードや文書の本文を読む画面なので、矢印ではなくこの形にする。
 * 白地に黒い縁取りで、明るい画面でも暗い画面でも見えるようにする
 */
const CURSOR_PATH =
  'M8 1 H11 L12 2 L13 1 H16 V3 H13 V21 H16 V23 H13 L12 22 L11 23 H8 V21 H11 V3 H8 Z'

/** 効果をかける範囲の半径を、この刻み（度）で切り上げる（作り直しを減らすため） */
const COVER_RADIUS_STEP_DEG = 10

export default function Simulation({
  results,
  eye,
  stimulus,
  pxPerMm,
  isCalibrated,
  onBack,
}: Props) {
  const [scene, setScene] = useState<Scene>('code')
  const [source, setSource] = useState<Source>(DEFAULT_SOURCE)
  const [centerBlurDeg, setCenterBlurDeg] = useState(DEFAULT_CENTER_BLUR_DEG)
  const [rangeDeg, setRangeDeg] = useState(DEFAULT_RANGE_DEG)
  const [distanceCm, setDistanceCm] = useState(DEFAULT_DISTANCE_CM)
  const [zoomPercent, setZoomPercent] = useState(DEFAULT_ZOOM_PERCENT)
  const [acuity, setAcuity] = useState(DEFAULT_ACUITY)
  const [intensityPercent, setIntensityPercent] = useState(100)
  const [enabled, setEnabled] = useState(true)
  const lensRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageDiagonalPx, setStageDiagonalPx] = useState(0)

  // カーソルが画面のどこにあっても、画面全体に効果がかかる大きさにする
  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return
    const observer = new ResizeObserver(() => {
      setStageDiagonalPx(Math.hypot(stage.clientWidth, stage.clientHeight))
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const ppd = pxPerDeg({ distanceCm, pxPerMm, eye })
  const coverRadiusDeg =
    Math.ceil(stageDiagonalPx / ppd / COVER_RADIUS_STEP_DEG) * COVER_RADIUS_STEP_DEG
  const isMeasured = source === 'measured'
  const masks = useMemo(
    () =>
      isMeasured
        ? createMeasuredMasks(
            results,
            eye,
            stimulus,
            intensityPercent / 100,
            coverRadiusDeg,
          )
        : createFixedMasks({ centerBlurDeg, rangeDeg }),
    [
      isMeasured,
      results,
      eye,
      stimulus,
      intensityPercent,
      coverRadiusDeg,
      centerBlurDeg,
      rangeDeg,
    ],
  )
  const lensSizePx = masks.radiusDeg * 2 * ppd
  const usesAcuitySetting = isMeasured && stimulus === 'circle'
  const acuityBlurPx =
    enabled && usesAcuitySetting && acuity !== 'none'
      ? acuityBlurDeg(Number(acuity)) * ppd
      : 0

  // 効果の層は画面と同じ大きさのまま、マスクの位置だけをカーソルに合わせて動かす。
  // （画面より大きな層にすると、ブラウザが描画できる大きさを超えて表示が崩れる）
  // 再描画せずに、マスクの位置を表す変数だけを書き換える
  const cursorHeightPx = (CURSOR_BASE_HEIGHT_PX * zoomPercent) / 100

  // カーソルも同じく、再描画せずに位置だけを書き換える
  const moveLens = (event: PointerEvent<HTMLDivElement>) => {
    const stage = event.currentTarget.getBoundingClientRect()
    const pointerX = event.clientX - stage.left
    const pointerY = event.clientY - stage.top
    const cursor = cursorRef.current
    if (cursor !== null) {
      // I 字の中心が実際のカーソルの位置に来るようにずらす
      const half = cursorHeightPx / 2
      cursor.style.transform = `translate(${pointerX - half}px, ${pointerY - half}px)`
      cursor.style.visibility = 'visible'
    }
    const lens = lensRef.current
    if (lens === null) return
    lens.style.setProperty('--mask-x', `${pointerX - lensSizePx / 2}px`)
    lens.style.setProperty('--mask-y', `${pointerY - lensSizePx / 2}px`)
    lens.style.visibility = 'visible'
  }

  const hideLens = () => {
    if (lensRef.current !== null) lensRef.current.style.visibility = 'hidden'
    if (cursorRef.current !== null) cursorRef.current.style.visibility = 'hidden'
  }


  return (
    <div className="simulation">
      <div className="simulation-toolbar">
        <div className="simulation-title">
          <strong>見え方の体験</strong>
          {isMeasured ? `（${EYE_LABEL[eye]}の測定結果）` : '（固定のぼかし）'}
        </div>
        <label>
          ぼかしのもと
          <select value={source} onChange={(e) => setSource(e.target.value as Source)}>
            {(Object.keys(SOURCE_LABEL) as Source[]).map((key) => (
              <option key={key} value={key}>
                {SOURCE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <label>
          画面
          <select value={scene} onChange={(e) => setScene(e.target.value as Scene)}>
            {(Object.keys(SCENE_LABEL) as Scene[]).map((key) => (
              <option key={key} value={key}>
                {SCENE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <label>
          画面までの距離
          <select
            value={distanceCm}
            onChange={(e) => setDistanceCm(Number(e.target.value))}
          >
            {DISTANCE_OPTIONS.map((cm) => (
              <option key={cm} value={cm}>
                {cm}cm
              </option>
            ))}
          </select>
        </label>
        <label>
          文字の拡大
          <select
            value={zoomPercent}
            onChange={(e) => setZoomPercent(Number(e.target.value))}
          >
            {ZOOM_OPTIONS.map((percent) => (
              <option key={percent} value={percent}>
                {percent}%
              </option>
            ))}
          </select>
        </label>
        {usesAcuitySetting && (
          <label>
            視力
            <select value={acuity} onChange={(e) => setAcuity(e.target.value)}>
              {ACUITY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === 'none' ? 'なし' : value}
                </option>
              ))}
            </select>
          </label>
        )}
        {/* 桁数が変わってもスライダが横にずれないよう、数値の幅を固定する */}
        {isMeasured ? (
          <label>
            強さ
            <span className="simulation-intensity">{intensityPercent}%</span>
            <input
              type="range"
              min={0}
              max={200}
              step={10}
              value={intensityPercent}
              onChange={(e) => setIntensityPercent(Number(e.target.value))}
            />
          </label>
        ) : (
          <>
            <label>
              中心のぼかし
              <span className="simulation-intensity">{centerBlurDeg.toFixed(1)}°</span>
              <input
                type="range"
                min={0}
                max={CENTER_BLUR_MAX_DEG}
                step={0.1}
                value={centerBlurDeg}
                onChange={(e) => setCenterBlurDeg(Number(e.target.value))}
              />
            </label>
            <label>
              ぼける半径
              <span className="simulation-intensity">{rangeDeg}°</span>
              <input
                type="range"
                min={RANGE_MIN_DEG}
                max={RANGE_MAX_DEG}
                step={1}
                value={rangeDeg}
                onChange={(e) => setRangeDeg(Number(e.target.value))}
              />
            </label>
          </>
        )}
        <button
          className={enabled ? 'primary' : undefined}
          aria-pressed={enabled}
          onClick={() => setEnabled((value) => !value)}
        >
          効果 {enabled ? 'ON' : 'OFF'}
        </button>
        <button onClick={onBack}>もどる</button>
        <p className="simulation-hint">
          選んだ距離から、大きなカーソル（I 字の形）を見続けたまま画面を読んでみてください。
          {isMeasured
            ? stimulus === 'landolt' && 'ぼかしは各地点で測った視力から計算しています。'
            : 'カーソルの位置が最も強くぼけ、離れるほど薄れます（測定結果は使いません）。'}
          {!isCalibrated && '（画面の大きさが未調整のため、範囲の大きさは目安です）'}
        </p>
      </div>

      <div
        ref={stageRef}
        className="simulation-stage"
        onPointerMove={moveLens}
        onPointerDown={moveLens}
        onPointerLeave={hideLens}
      >
        {/* 視力の低さは、どこを見ていても同じなので画面全体をぼかす */}
        <div
          className="simulation-scene"
          style={
            acuityBlurPx > 0
              ? { filter: `blur(${acuityBlurPx.toFixed(1)}px)` }
              : undefined
          }
        >
          {scene === 'code' ? (
            <CodeEditorScene contentZoom={zoomPercent / 100} />
          ) : (
            <DocumentScene contentZoom={zoomPercent / 100} />
          )}
        </div>

        {enabled && stageDiagonalPx > 0 && masks.layerUrls.length > 0 && (
          <div
            ref={lensRef}
            className="simulation-lens"
            style={{ '--mask-size': `${lensSizePx}px` } as CSSProperties}
            aria-hidden="true"
          >
            {SIMULATION_LAYERS.map((layer, index) => {
              const url = masks.layerUrls[index]
              if (url === null) return null
              const filter =
                `blur(${(layer.blurDeg * ppd).toFixed(1)}px) ` +
                `saturate(${layer.saturate})`
              const mask = `url(${url})`
              return (
                <div
                  key={index}
                  className="simulation-layer"
                  style={{
                    backdropFilter: filter,
                    WebkitBackdropFilter: filter,
                    maskImage: mask,
                    WebkitMaskImage: mask,
                  }}
                />
              )
            })}
          </div>
        )}

        {/* 見続ける目印なので、効果の層より上に置き、ぼかさない */}
        <svg
          ref={cursorRef}
          className="simulation-cursor"
          width={cursorHeightPx}
          height={cursorHeightPx}
          viewBox={`0 0 ${CURSOR_BASE_HEIGHT_PX} ${CURSOR_BASE_HEIGHT_PX}`}
          aria-hidden="true"
        >
          <path d={CURSOR_PATH} />
        </svg>
      </div>
    </div>
  )
}
