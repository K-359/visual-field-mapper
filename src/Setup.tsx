import { useState } from 'react'
import type { Eye, Settings } from './types'
import { EYE_LABEL } from './types'
import {
  MEASUREMENT_LOCATIONS,
  REPETITIONS_PER_LOCATION,
  TOTAL_TRIAL_COUNT,
} from './measurementPlan'

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
        画面から約20cmの距離で中央の赤い十字を見続けてください。
        決められた{MEASUREMENT_LOCATIONS.length}箇所で大きくなる円に気付いたら
        Enter を押します（各{REPETITIONS_PER_LOCATION}回、全{TOTAL_TRIAL_COUNT}回）。
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
