import { useState } from 'react'
import type { Eye } from './types'
import { EYE_LABEL } from './types'
import {
  MEASUREMENT_LOCATIONS,
  REPETITIONS_PER_LOCATION,
  TOTAL_TRIAL_COUNT,
} from './measurementPlan'
import type { Calibration } from './calibrationStore'
import { isCalibrationCurrent } from './calibrationStore'
import { formatSavedAt } from './historyStore'

interface Props {
  calibration: Calibration | null
  onStart: (eye: Eye) => void
  onDemo: (eye: Eye) => void
  onCalibrate: () => void
  onHistory: () => void
}

export default function Setup({
  calibration,
  onStart,
  onDemo,
  onCalibrate,
  onHistory,
}: Props) {
  const [eye, setEye] = useState<Eye>('right')
  const calibrated = calibration !== null && isCalibrationCurrent(calibration)

  return (
    <div className="setup">
      <h1>視野マッパー</h1>
      <p className="lead">
        画面から約20cmの距離で中央の赤い丸を見続けてください。
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

      <div className={`calibration-status${calibrated ? '' : ' needed'}`}>
        <p>
          {calibrated
            ? `画面の大きさ: 合わせ済み（${formatSavedAt(calibration.calibratedAt)}）`
            : calibration !== null
            ? '画面またはブラウザの表示倍率が変わったため、画面の大きさを合わせ直す必要があります。'
            : '画面の大きさがまだ合わせられていません。測定をはじめると、最初にカードで合わせます。'}
        </p>
        <button onClick={onCalibrate}>
          {calibrated ? '画面の大きさを合わせ直す' : '画面の大きさを合わせる'}
        </button>
      </div>

      <div className="button-row">
        <button className="primary" onClick={() => onStart(eye)}>
          測定をはじめる
        </button>
        <button onClick={() => onDemo(eye)}>結果のサンプル</button>
        <button onClick={onHistory}>測定履歴</button>
      </div>

      <p className="note">
        ※ 医療機器ではありません。結果は目安です。正確な評価は眼科で受けてください。
      </p>
    </div>
  )
}
