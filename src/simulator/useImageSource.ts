import { useCallback, useEffect, useRef, useState } from 'react'

export interface LoadedImage {
  url: string
  name: string
  naturalWidth: number
  naturalHeight: number
}

/**
 * 等倍で表示する幅。画面に収まるところから始めて、拡大率を掛けて使う。
 *
 * 読み込み時に1回計算して持つのではなく、描画のたびに現在のビューポートから
 * 求める。固定にするとウィンドウをリサイズしたときに追従しないうえ、
 * 読み込み時点でビューポート幅が確定していないと変な値のまま固まる。
 */
export function fitWidthFor(naturalWidth: number, viewportWidth: number): number {
  return Math.min(naturalWidth, Math.max(320, viewportWidth - 64))
}

/** ビューポート幅。リサイズに追従する */
export function useViewportWidth(): number {
  const [w, setW] = useState(() => window.innerWidth)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

/** 貼り付け / ドロップ / ファイル選択で画像を1枚受け取る。 */
export function useImageSource(enabled: boolean) {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 差し替え・アンマウント時に前の object URL を解放する。解放しないと
  // ページを開いている間ずっと画像データがメモリに残る
  const urlRef = useRef<string | null>(null)

  const accept = useCallback((file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルではありません')
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = url
      setError(null)
      setImage({
        url,
        name: file.name || '貼り付けた画像',
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setError('画像を読み込めませんでした')
    }
    img.src = url
  }, [])

  const clear = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setImage(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          accept(item.getAsFile())
          return
        }
      }
    }
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      accept(e.dataTransfer.files[0])
    }
    // これを止めないとブラウザが画像を開いてしまい、アプリから離脱する
    const onDragOver = (e: DragEvent) => e.preventDefault()

    window.addEventListener('paste', onPaste)
    window.addEventListener('drop', onDrop)
    window.addEventListener('dragover', onDragOver)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragover', onDragOver)
    }
  }, [enabled, accept])

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  return { image, error, accept, clear }
}
