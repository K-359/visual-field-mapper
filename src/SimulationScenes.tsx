/**
 * 見え方の体験で表示する、普段使うアプリに似せた画面。
 * 見た目を似せただけで、実際のアプリの機能はない。
 */

const CODE_LINES = `import { readFile } from 'node:fs/promises'

// 1日の歩数を集計して、目標を達成した日を数える
interface DailySteps {
  date: string
  steps: number
}

const GOAL_STEPS = 8000

export async function loadSteps(path: string): Promise<DailySteps[]> {
  const text = await readFile(path, 'utf8')
  return text
    .trim()
    .split('\\n')
    .map((line) => {
      const [date, steps] = line.split(',')
      return { date, steps: Number(steps) }
    })
}

export function countGoalDays(days: DailySteps[]): number {
  let count = 0
  for (const day of days) {
    if (day.steps >= GOAL_STEPS) {
      count += 1
    }
  }
  return count
}

export function weeklyAverage(days: DailySteps[]): number {
  const lastWeek = days.slice(-7)
  if (lastWeek.length === 0) return 0
  const total = lastWeek.reduce((sum, day) => sum + day.steps, 0)
  return Math.round(total / lastWeek.length)
}

const days = await loadSteps('./steps.csv')
console.log(\`達成日数: \${countGoalDays(days)}日\`)
console.log(\`直近7日の平均: \${weeklyAverage(days)}歩\`)
`.split('\n')

const KEYWORDS = new Set([
  'import', 'from', 'export', 'async', 'await', 'function', 'return',
  'const', 'let', 'for', 'of', 'if', 'interface', 'new',
])
const TYPES = new Set(['string', 'number', 'Promise', 'DailySteps'])

/** 1行のコードを、色分けした断片に分ける（簡易的なもの） */
function highlight(line: string) {
  const tokenPattern =
    /(\/\/.*$)|('(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\b)|([A-Za-z_]\w*)/g
  const parts: { text: string; className?: string }[] = []
  let last = 0
  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index
    if (index > last) parts.push({ text: line.slice(last, index) })
    const [text, comment, string, number, word] = match
    let className: string | undefined
    if (comment) className = 'tok-comment'
    else if (string) className = 'tok-string'
    else if (number) className = 'tok-number'
    else if (word && KEYWORDS.has(word)) className = 'tok-keyword'
    else if (word && TYPES.has(word)) className = 'tok-type'
    else if (word && line[index + word.length] === '(') className = 'tok-function'
    else if (word && /^[A-Z_]+$/.test(word)) className = 'tok-constant'
    parts.push({ text, className })
    last = index + text.length
  }
  if (last < line.length) parts.push({ text: line.slice(last) })
  return parts
}

interface SceneProps {
  /** 本文（エディタや文書）の拡大率。1 で実際のアプリと同じ大きさ */
  contentZoom: number
}

/**
 * コードエディタ風の画面。見え方の体験に必要なのは拡大した本文なので、
 * エクスプローラーやタブなどは置かず、コードの部分だけのウィンドウにする
 */
export function CodeEditorScene({ contentZoom }: SceneProps) {
  return (
    <div className="scene-code">
      <div className="code-editor" style={{ zoom: contentZoom }}>
        {CODE_LINES.map((line, index) => (
          <div key={index} className="code-line">
            <span className="code-line-number">{index + 1}</span>
            <span className="code-text">
              {highlight(line).map((part, partIndex) => (
                <span key={partIndex} className={part.className}>
                  {part.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 文書ページの余白（拡大前の px）。拡大しても画面上ではこの大きさのままにする */
const DOC_PAGE_PADDING_PX = { x: 90, y: 72 }

/**
 * 文書作成ソフト風の画面。エディタ風の画面と同じく、リボンなどは置かず
 * 本文（文書ページ）の部分だけにする
 */
export function DocumentScene({ contentZoom }: SceneProps) {
  return (
    <div className="scene-document">
      <div className="doc-canvas">
        <div
          className="doc-page"
          // 拡大しても余白は広げず、文字が使える幅を確保する
          style={{
            zoom: contentZoom,
            padding: `${DOC_PAGE_PADDING_PX.y / contentZoom}px ${DOC_PAGE_PADDING_PX.x / contentZoom}px`,
          }}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
        >
          <p className="doc-date">2026年10月29日</p>
          <p>自治会員の皆さま</p>
          <p className="doc-from">みどり台自治会　環境美化担当</p>
          <h1>町内清掃活動のお知らせ</h1>
          <p>
            秋も深まり、落ち葉の季節となりました。皆さまにはいつも自治会活動に
            ご協力いただき、ありがとうございます。
          </p>
          <p>
            さて、毎年恒例の町内清掃活動を下記のとおり行います。道路わきの側溝や
            公園の落ち葉を中心に清掃しますので、お忙しいところ恐れ入りますが、
            ご参加くださいますようお願い申し上げます。
          </p>
          <p className="doc-center">記</p>
          <table>
            <tbody>
              <tr>
                <th>日時</th>
                <td>11月16日（日）午前9時〜11時（小雨決行）</td>
              </tr>
              <tr>
                <th>集合場所</th>
                <td>みどり台公園 東口の広場</td>
              </tr>
              <tr>
                <th>持ち物</th>
                <td>軍手、飲み物（ごみ袋とほうきは自治会で用意します）</td>
              </tr>
              <tr>
                <th>問い合わせ</th>
                <td>環境美化担当 山田（内線 2-14）</td>
              </tr>
            </tbody>
          </table>
          <ul>
            <li>汚れてもよい服装でお越しください。</li>
            <li>中止の場合は、当日午前7時に掲示板でお知らせします。</li>
            <li>終了後、公園で温かい飲み物をご用意しています。</li>
          </ul>
          <p className="doc-right">以上</p>
        </div>
      </div>
    </div>
  )
}
