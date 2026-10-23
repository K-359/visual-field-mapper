import { useEffect, useState } from 'react'
import {
  CARD_CORNER_RADIUS_MM,
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
} from './calibrationStore'

interface Props {
  /** 調整を始めるときの 1mm あたりのピクセル数 */
  initialPxPerMm: number
  /** 決定後に測定へ進むか（ボタンの文言に使う） */
  continueToTest: boolean
  onSave: (pxPerMm: number) => void
  onCancel: () => void
}

const MIN_CARD_WIDTH_PX = 150
const MAX_CARD_WIDTH_PX = 1200
const SMALL_STEP_PX = 1
const LARGE_STEP_PX = 10

const clampWidth = (widthPx: number) =>
  Math.min(MAX_CARD_WIDTH_PX, Math.max(MIN_CARD_WIDTH_PX, widthPx))

export default function Calibration({
  initialPxPerMm,
  continueToTest,
  onSave,
  onCancel,
}: Props) {
  const [cardWidthPx, setCardWidthPx] = useState(() =>
    clampWidth(Math.round(initialPxPerMm * CARD_WIDTH_MM)),
  )
  const pxPerMm = cardWidthPx / CARD_WIDTH_MM
  const resize = (deltaPx: number) =>
    setCardWidthPx((width) => clampWidth(width + deltaPx))

  // ← → キーでも調整できるようにする（Shift で大きく動かす）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const step = e.shiftKey ? LARGE_STEP_PX : SMALL_STEP_PX
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setCardWidthPx((width) => clampWidth(width + step))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCardWidthPx((width) => clampWidth(width - step))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const screenWidthCm = window.screen.width / pxPerMm / 10
  const screenHeightCm = window.screen.height / pxPerMm / 10

  return (
    <div className="calibration">
      <h1>画面の大きさを合わせる</h1>
      <p className="lead">
        クレジットカード・キャッシュカード・マイナンバーカードなど、
        一般的な大きさのカードを1枚用意してください。
        カードを画面に当て、左上の角を青い四角の左上の角に合わせてから、
        四角の右端がカードの右端とぴったり重なるように大きさを調整します。
      </p>

      <div className="calibration-card-area">
        <div
          className="calibration-card"
          style={{
            width: cardWidthPx,
            height: (cardWidthPx * CARD_HEIGHT_MM) / CARD_WIDTH_MM,
            borderRadius: CARD_CORNER_RADIUS_MM * pxPerMm,
          }}
          role="img"
          aria-label="カードと同じ大きさに合わせる青い四角"
        />
      </div>

      <div className="calibration-controls">
        <button type="button" onClick={() => resize(-LARGE_STEP_PX)}>
          ◀◀ 小さく
        </button>
        <button type="button" onClick={() => resize(-SMALL_STEP_PX)}>
          ◀ 少し小さく
        </button>
        <button type="button" onClick={() => resize(SMALL_STEP_PX)}>
          少し大きく ▶
        </button>
        <button type="button" onClick={() => resize(LARGE_STEP_PX)}>
          大きく ▶▶
        </button>
      </div>

      <label className="calibration-slider">
        <span>大きさ</span>
        <input
          type="range"
          min={MIN_CARD_WIDTH_PX}
          max={MAX_CARD_WIDTH_PX}
          step={1}
          value={cardWidthPx}
          onChange={(event) => setCardWidthPx(Number(event.target.value))}
        />
      </label>

      <p className="calibration-hint">
        キーボードの ← → でも調整できます（Shift を押しながらだと大きく動きます）。
        この大きさだと、画面は横 約{screenWidthCm.toFixed(1)}cm × 縦 約
        {screenHeightCm.toFixed(1)}cm になります。
      </p>

      <p className="warn">
        ブラウザの表示倍率（ズーム）は変えずにこのまま測定してください。
        表示倍率や画面を変えたときは、もう一度合わせ直してもらいます。
      </p>

      <div className="button-row">
        <button className="primary" onClick={() => onSave(pxPerMm)}>
          {continueToTest ? 'この大きさで決定して測定へ' : 'この大きさで決定'}
        </button>
        <button onClick={onCancel}>キャンセル</button>
      </div>
    </div>
  )
}
