import { useState } from 'react'
import type { Eye, Settings } from './types'
import { EYE_LABEL } from './types'

const CARD_WIDTH_MM = 85.6 // クレジットカード・交通系ICカードの横幅

interface Props {
  onStart: (settings: Settings) => void
  onDemo: (settings: Settings) => void
}

export default function Setup({ onStart, onDemo }: Props) {
  const [cardPx, setCardPx] = useState(320)
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
        <h2>1. 画面の大きさ合わせ</h2>
        <p>
          クレジットカードや交通系ICカードを画面に当て、下の枠がカードの横幅と
          同じになるようにスライダーで調整してください。
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
          onChange={(e) => setCardPx(Number(e.target.value))}
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
            白い画面の中央に小さな赤い十字が表示されます。中心が見えづらくても、
            そのあたりを見続けてください。
          </li>
          <li>
            中央のまわり16方向に赤い点が最初から表示されています。そのうち
            1つずつが順番に、外側に向かってゆっくり動いていきます。視線は
            中央に向けたまま、
            <strong>
              動いている点がはっきり見えた瞬間にスペースキーを押すか、
              画面をタップ
            </strong>
            してください。点はその場所にとどまります。
          </li>
          <li>
            「なんとなくある」ではなく「はっきり見えた」タイミングで応答する
            のがポイントです。これを16方向について行います（2〜3分程度）。
            端まで動いても見えなければ、何もしなくてOKです。
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
