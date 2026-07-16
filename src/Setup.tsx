import { useState } from 'react'
import type { Eye, Settings } from './types'
import { EYE_LABEL } from './types'

const CARD_WIDTH_MM = 85.6 // クレジットカード・交通系ICカードの横幅
const CARD_PX_STORAGE_KEY = 'visual-field-mapper.card-width-px'
const DEFAULT_CARD_PX = 320

function loadCardPx(): number {
  try {
    const saved = Number(window.localStorage.getItem(CARD_PX_STORAGE_KEY))
    return saved >= 200 && saved <= 600 ? saved : DEFAULT_CARD_PX
  } catch {
    return DEFAULT_CARD_PX
  }
}

function saveCardPx(value: number) {
  try {
    window.localStorage.setItem(CARD_PX_STORAGE_KEY, String(value))
  } catch {
    // ストレージを利用できない環境では、現在の画面内だけで値を保持する
  }
}

interface Props {
  onStart: (settings: Settings) => void
  onDemo: (settings: Settings) => void
}

export default function Setup({ onStart, onDemo }: Props) {
  const [cardPx, setCardPx] = useState(loadCardPx)
  const [distanceCm, setDistanceCm] = useState(40)
  const [eye, setEye] = useState<Eye>('right')

  const pxPerMm = cardPx / CARD_WIDTH_MM

  return (
    <div className="setup">
      <h1>視野マッパー</h1>
      <p className="lead">
        中心からどのあたりで見えやすくなるかを簡易的に測定・可視化するツールです。
      </p>
      <p className="warn">
        ⚠️ これは医療機器ではありません。結果はあくまで目安であり、診断には使えません。
        受診の際は必ず眼科での視野検査を受けてください。
      </p>

      <section>
        <h2>1. 画面の大きさ合わせ（初回のみ）</h2>
        <p>
          クレジットカードや交通系ICカードを画面に当て、下の枠がカードの横幅と
          同じになるようにスライダーで調整してください。調整値はこのブラウザに
          自動保存されるため、次回からは同じ画面・ブラウザ倍率なら調整不要です。
          ディスプレイやブラウザ倍率を変えた場合だけ調整し直してください。
        </p>
        <div
          className="card-gauge"
          style={{ width: cardPx, height: cardPx / 1.586 }}
        >
          カードの横幅に合わせる
        </div>
        <input
          type="range"
          min={200}
          max={600}
          value={cardPx}
          onChange={(e) => {
            const value = Number(e.target.value)
            setCardPx(value)
            saveCardPx(value)
          }}
        />
      </section>

      <section>
        <h2>2. 画面からの距離</h2>
        <p>
          目から画面までの距離をおおよそで入力してください（腕をのばした距離が約60cm、
          ノートPCなら約40cmが目安です）。測定中はこの距離を保ってください。
        </p>
        <label>
          距離:{' '}
          <input
            type="number"
            min={20}
            max={100}
            value={distanceCm}
            onChange={(e) => setDistanceCm(Number(e.target.value))}
          />{' '}
          cm
        </label>
      </section>

      <section>
        <h2>3. 測定する眼</h2>
        <p>片眼ずつ測るのがおすすめです。測らない方の眼は手で軽くおおってください。</p>
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
      </section>

      <section>
        <h2>測定のしかた</h2>
        <ol>
          <li>
            白い画面の中央に大きな赤い十字が表示されます。中心が見えづらくても、
            そのあたりを見続けてください。
          </li>
          <li>
            中央のまわりに16個の赤い円が表示されます。視線は中央に向けたまま、
            <strong>
              矢印キーで操作中の円を動かし、円がくっきり見えた位置でEnterを押して
            </strong>
            ください。↑・→で外側、↓・←で内側へ動きます。
          </li>
          <li>
            それぞれの移動対象は、線幅6の円です。円の形がくっきり見える位置を
            探してください。
          </li>
          <li>
            Enterを押すと次の円へ進みます。16個目を確定すると結果を表示します。
          </li>
        </ol>
      </section>

      <div className="button-row">
        <button
          className="primary"
          onClick={() => onStart({ distanceCm, pxPerMm, eye })}
        >
          測定をはじめる
        </button>
        <button onClick={() => onDemo({ distanceCm, pxPerMm, eye })}>
          結果画面のサンプルを見る
        </button>
      </div>
    </div>
  )
}
