/** クレジットカード等の国際規格 ID-1 サイズ（mm）。キャッシュカード・マイナンバーカードも同じ */
export const CARD_WIDTH_MM = 85.6
export const CARD_HEIGHT_MM = 53.98
/** ID-1 カードの角の丸み（mm） */
export const CARD_CORNER_RADIUS_MM = 3.18

/** 校正前の初期値。一般的なディスプレイ (96dpi) を想定 */
export const DEFAULT_PX_PER_MM = 96 / 25.4

/** カードで合わせた画面の大きさ */
export interface Calibration {
  /** 画面上の 1mm あたりの CSS ピクセル数 */
  pxPerMm: number
  /** 校正したときの表示倍率。ブラウザのズームや画面の切り替えで変わる */
  devicePixelRatio: number
  /** 校正したときの画面の大きさ（CSS ピクセル） */
  screenWidth: number
  screenHeight: number
  /** 校正した日時 (ISO 8601) */
  calibratedAt: string
}

const STORAGE_KEY = 'visual-field-mapper-calibration'

function isCalibration(value: unknown): value is Calibration {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Record<string, unknown>
  return (
    typeof c.pxPerMm === 'number' &&
    c.pxPerMm > 0 &&
    typeof c.devicePixelRatio === 'number' &&
    typeof c.screenWidth === 'number' &&
    typeof c.screenHeight === 'number' &&
    typeof c.calibratedAt === 'string'
  )
}

/** 保存済みの校正値を読み込む。壊れたデータは黙って捨てる */
export function loadCalibration(): Calibration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isCalibration(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** 今の画面・表示倍率での校正値として保存する */
export function saveCalibration(pxPerMm: number): Calibration {
  const calibration: Calibration = {
    pxPerMm,
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    calibratedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration))
  } catch {
    // プライベートブラウズや容量不足で保存できない場合も、この回の測定には使う
  }
  return calibration
}

/**
 * 校正値が今の画面でもそのまま使えるか。ブラウザのズームを変えたり、
 * 別の画面へ移ったりすると 1mm あたりのピクセル数が変わるため、合わせ直しが必要
 */
export function isCalibrationCurrent(calibration: Calibration): boolean {
  return (
    Math.abs(calibration.devicePixelRatio - window.devicePixelRatio) < 0.01 &&
    calibration.screenWidth === window.screen.width &&
    calibration.screenHeight === window.screen.height
  )
}
