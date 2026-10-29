import { useRef, useState } from "react";
import BlurredText from "./BlurredText";
import { DEFAULT_PROFILE, type BlurProfile } from "./blurProfile";
import { useFocusPoint, type FocusMode } from "./focusPoint";
import { SAMPLE_PARAGRAPHS, SAMPLE_TITLE } from "./sampleText";
import {
  fitWidthFor,
  useImageSource,
  useViewportWidth,
} from "./useImageSource";

type ContentMode = "text" | "image";

interface Props {
  onBack: () => void;
}

/** 等倍のときの文字サイズ。拡大率はこれに掛ける */
const BASE_FONT_PX = 20;

const MODE_LABEL: Record<FocusMode, string> = {
  mouse: "マウス追従",
  fixed: "画面中央に固定",
};

export default function Simulator({ onBack }: Props) {
  const [mode, setMode] = useState<FocusMode>("mouse");
  const [profile, setProfile] = useState<BlurProfile>(DEFAULT_PROFILE);
  const [zoom, setZoom] = useState(1);
  const [disabled, setDisabled] = useState(false);
  const [hideUi, setHideUi] = useState(false);
  const [contentMode, setContentMode] = useState<ContentMode>("text");
  const focus = useFocusPoint(mode);
  const fileInput = useRef<HTMLInputElement>(null);
  // 貼り付け・ドロップは画像モードのときだけ拾う。テキストを読んでいる最中に
  // 別の用事でコピーした画像を貼り付けてしまうのを避ける
  const {
    image,
    error: imageError,
    accept,
    clear,
  } = useImageSource(contentMode === "image");
  const viewportWidth = useViewportWidth();

  const set =
    (key: keyof BlurProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setProfile((p) => ({ ...p, [key]: Number(e.target.value) }));

  // 拡大は内容にだけかける。ぼかし層は BlurredText 側で position: fixed の
  // 兄弟要素として置いてあるので影響を受けない。暗点は網膜側にあり画面上の
  // 視角で固定される、という関係をそのまま写している。
  //
  // 拡大の実現方法は「font-size を倍率で動かし、段組の幅を em で固定する」。
  // 幅が em なら文字と一緒に伸びるので、1行の字数＝折り返し位置が拡大しても
  // 変わらない。CSS zoom を使うとレイアウトが再計算されて折り返しが変わり、
  // transform: scale() は合成レイヤのラスタライズ次第で文字がぼやける。
  //
  // 画像も同じ関係にする。等倍で画面に収まる幅を出発点に、拡大率を掛けるだけ。
  const content =
    contentMode === "image" ? (
      image ? (
        <div
          className="sim-image"
          style={{
            width: `${fitWidthFor(image.naturalWidth, viewportWidth) * zoom}px`,
          }}
        >
          <img src={image.url} alt={image.name} />
        </div>
      ) : (
        <div className="sim-dropzone">
          <p>画像を貼り付け（⌘V / Ctrl+V）するか、ここにドロップしてください</p>
          <button onClick={() => fileInput.current?.click()}>
            ファイルを選ぶ
          </button>
          {imageError && <p className="sim-error">{imageError}</p>}
          <p className="sim-hint">
            画像はこの端末の中だけで処理され、どこにも送信されません。
          </p>
        </div>
      )
    ) : (
      <article
        className="sim-text"
        style={{ fontSize: `${BASE_FONT_PX * zoom}px` }}
      >
        <h2>{SAMPLE_TITLE}</h2>
        {SAMPLE_PARAGRAPHS.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
    );

  return (
    <div className="simulator">
      <BlurredText
        focus={focus}
        profile={profile}
        disabled={disabled}
        stepCount={9}
      >
        {content}
      </BlurredText>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          accept(e.target.files?.[0]);
          // 同じファイルを選び直しても change が飛ぶようにする
          e.target.value = "";
        }}
      />

      {hideUi ? (
        <button className="sim-show-ui" onClick={() => setHideUi(false)}>
          設定を表示
        </button>
      ) : (
        <div className="sim-panel">
          <div className="sim-row">
            <strong>見え方シミュレータ</strong>
            <button onClick={onBack}>戻る</button>
          </div>

          <p className="note">
            中心視野が欠けた状態で文章や画像を見る体験です。見たい場所に視点を
            合わせるほど見えなくなります。画像モードでは貼り付け・ドロップが使えます。
            <br />※
            実際の見え方の再現ではありません。当事者は時間をかけて中心を外して
            見る方法を身につけるので、その適応後の状態とは別物です。
          </p>

          <div className="sim-row">
            <label>
              表示するもの
              <select
                value={contentMode}
                onChange={(e) => setContentMode(e.target.value as ContentMode)}
              >
                <option value="text">サンプル文章</option>
                <option value="image">画像</option>
              </select>
            </label>
            {contentMode === "image" && (
              <span className="sim-row-actions">
                <button onClick={() => fileInput.current?.click()}>
                  {image ? "差し替え" : "画像を選ぶ"}
                </button>
                {image && <button onClick={clear}>消す</button>}
              </span>
            )}
          </div>

          <div className="sim-row">
            <label>
              中心の位置
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as FocusMode)}
              >
                {(["mouse", "fixed"] as FocusMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={disabled}
                onChange={(e) => setDisabled(e.target.checked)}
              />
              ぼかしを止める（比較）
            </label>
          </div>

          <label className="sim-slider">
            ぼかしの強さ <span>{profile.centerSigmaPx}px</span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={profile.centerSigmaPx}
              onChange={set("centerSigmaPx")}
            />
          </label>
          <label className="sim-slider">
            ぼける範囲の広さ <span>{profile.falloffPx}px</span>
            <input
              type="range"
              min={50}
              max={1800}
              step={10}
              value={profile.falloffPx}
              onChange={set("falloffPx")}
            />
          </label>
          <label className="sim-slider">
            減り方 <span>{profile.curve.toFixed(1)}</span>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.1}
              value={profile.curve}
              onChange={set("curve")}
            />
            <small>
              小さいほど強いぼけが広く残り、大きいほど中心付近だけ強く外へ薄く尾を引く
            </small>
          </label>
          <label className="sim-slider">
            中心の一定領域 <span>{profile.plateauPx}px</span>
            <input
              type="range"
              min={0}
              max={400}
              step={5}
              value={profile.plateauPx}
              onChange={set("plateauPx")}
            />
            <small>
              0 なら中心から連続的に薄れる。大きくすると中心に均一な暗点ができる
            </small>
          </label>
          <label className="sim-slider">
            画面の拡大率 <span>{zoom.toFixed(1)}×</span>
            <input
              type="range"
              min={1}
              max={6}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <small>
              拡大しても見えない範囲は変わらない（暗点は網膜側にあるため画面上の
              大きさで決まる）。拡大鏡を使うのと同じ関係で、1文字に対する欠損の
              割合だけが小さくなる。折り返し位置は拡大しても変わらない
            </small>
          </label>

          <button onClick={() => setHideUi(true)}>設定を隠して集中する</button>
        </div>
      )}
    </div>
  );
}
