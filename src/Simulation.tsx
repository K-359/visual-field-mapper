import { useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Eye, PointResult } from './types'
import { EYE_LABEL, pxPerDeg } from './types'
import {
  SIMULATION_LAYERS,
  acuityBlurDeg,
  createSimulationMasks,
} from './simulationModel'
import { CodeEditorScene, DocumentScene } from './SimulationScenes'

interface Props {
  results: PointResult[]
  /** 測定した眼。片眼の測定では生理的な盲点を体験から除く */
  eye: Eye
  /** 体験する画面の 1mm あたりのピクセル数 */
  pxPerMm: number
  /** pxPerMm がこの画面で合わせた値か。false なら大きさは目安 */
  isCalibrated: boolean
  onBack: () => void
}

type Scene = 'code' | 'document'

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
 * 再現する視力の選択肢。'none' は視力を再現しない（視野の結果だけを再現する）。
 * 既定は、体験に協力いただいた LHON の方の視力 0.03 にする
 */
const ACUITY_OPTIONS = ['none', '0.5', '0.2', '0.1', '0.05', '0.03', '0.02', '0.01']
const DEFAULT_ACUITY = '0.03'

export default function Simulation({
  results,
  eye,
  pxPerMm,
  isCalibrated,
  onBack,
}: Props) {
  const [scene, setScene] = useState<Scene>('code')
  const [distanceCm, setDistanceCm] = useState(DEFAULT_DISTANCE_CM)
  const [zoomPercent, setZoomPercent] = useState(DEFAULT_ZOOM_PERCENT)
  const [acuity, setAcuity] = useState(DEFAULT_ACUITY)
  const [intensityPercent, setIntensityPercent] = useState(100)
  const [enabled, setEnabled] = useState(true)
  const lensRef = useRef<HTMLDivElement>(null)

  const masks = useMemo(
    () => createSimulationMasks(results, eye, intensityPercent / 100),
    [results, eye, intensityPercent],
  )
  const ppd = pxPerDeg({ distanceCm, pxPerMm, eye })
  const lensSizePx = masks.radiusDeg * 2 * ppd
  const acuityBlurPx =
    enabled && acuity !== 'none' ? acuityBlurDeg(Number(acuity)) * ppd : 0

  // カーソルに合わせて動かすだけなので、再描画せずに位置だけ書き換える
  const moveLens = (event: PointerEvent<HTMLDivElement>) => {
    const lens = lensRef.current
    if (lens === null) return
    const stage = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - stage.left - lensSizePx / 2
    const y = event.clientY - stage.top - lensSizePx / 2
    lens.style.transform = `translate3d(${x}px, ${y}px, 0)`
    lens.style.visibility = 'visible'
  }

  const hideLens = () => {
    if (lensRef.current !== null) lensRef.current.style.visibility = 'hidden'
  }

  return (
    <div className="simulation">
      <div className="simulation-toolbar">
        <div className="simulation-title">
          <strong>見え方の体験</strong>（{EYE_LABEL[eye]}の測定結果）
        </div>
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
        <label>
          強さ
          {/* 桁数が変わってもスライダが横にずれないよう、数値の幅を固定する */}
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
        <button
          className={enabled ? 'primary' : undefined}
          aria-pressed={enabled}
          onClick={() => setEnabled((value) => !value)}
        >
          効果 {enabled ? 'ON' : 'OFF'}
        </button>
        <button onClick={onBack}>もどる</button>
        <p className="simulation-hint">
          選んだ距離から、カーソルの先を見続けたまま画面を読んでみてください。
          {!isCalibrated && '（画面の大きさが未調整のため、範囲の大きさは目安です）'}
        </p>
      </div>

      <div
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

        {enabled && masks.layerUrls.length > 0 && (
          <div
            ref={lensRef}
            className="simulation-lens"
            style={{ width: lensSizePx, height: lensSizePx }}
            aria-hidden="true"
          >
            {SIMULATION_LAYERS.map((layer, index) => {
              const filter =
                `blur(${(layer.blurDeg * ppd).toFixed(1)}px) ` +
                `saturate(${layer.saturate}) contrast(${layer.contrast})`
              const mask = `url(${masks.layerUrls[index]})`
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
      </div>
    </div>
  )
}
