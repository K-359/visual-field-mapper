import { useState } from 'react'
import type { Eye, Settings } from './types'
import { EYE_LABEL } from './types'

const DISTANCE_CM = 20 // 目から画面までの距離は 20cm 固定
const PX_PER_MM = 96 / 25.4 // 一般的なディスプレイ (96dpi) を想定

interface Props {
  onStart: (settings: Settings) => void
  onDemo: (settings: Settings) => void
  onHistory: () => void
}

export default function Setup({ onStart, onDemo, onHistory }: Props) {
  const [eye, setEye] = useState<Eye>('right')

  const settings: Settings = {
    distanceCm: DISTANCE_CM,
    pxPerMm: PX_PER_MM,
    eye,
  }

  return (
    <div className="setup">
      <h1>視野マッパー</h1>
      <p className="lead">
        画面から約20cmの距離で測定してください。
      </p>

      <div className="eye-select">
        {(['right', 'left', 'both'] as Eye[]).map((e) => (
          <label key={e}>
            <input
              type="radio"
              name="eye"
              checked={eye === e}
              onChange={() => setEye(e)}
            />
            {EYE_LABEL[e]}
          </label>
        ))}
      </div>

      <div className="button-row">
        <button className="primary" onClick={() => onStart(settings)}>
          測定をはじめる
        </button>
        <button onClick={() => onDemo(settings)}>結果のサンプル</button>
        <button onClick={onHistory}>測定履歴</button>
      </div>

      <p className="note">
        ※ 医療機器ではありません。結果は目安です。正確な評価は眼科で受けてください。
      </p>
    </div>
  )
}
