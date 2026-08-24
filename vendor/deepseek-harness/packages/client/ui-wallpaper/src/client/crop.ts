/**
 * Client-side crop helper: load an image, pan/zoom inside a viewport, and
 * export the visible region as a PNG blob.
 */

/** Mutable crop viewport state. */
export interface CropState {
  /** Natural image width. */
  naturalWidth: number
  /** Natural image height. */
  naturalHeight: number
  /** Zoom scale relative to cover-fit. */
  scale: number
  /** Pan offset in CSS pixels inside the viewport. */
  offsetX: number
  /** Pan offset in CSS pixels inside the viewport. */
  offsetY: number
}

/**
 * Compute the base cover scale that fills a viewport.
 * @param naturalWidth - image width.
 * @param naturalHeight - image height.
 * @param viewWidth - viewport width.
 * @param viewHeight - viewport height.
 * @returns cover scale.
 */
export function coverScale(
  naturalWidth: number,
  naturalHeight: number,
  viewWidth: number,
  viewHeight: number,
): number {
  return Math.max(viewWidth / naturalWidth, viewHeight / naturalHeight)
}

/**
 * Keep zoom and pan inside the crop viewport so exported images never gain
 * transparent strips at an edge.
 * @param state - proposed crop state.
 * @param viewWidth - crop viewport width.
 * @param viewHeight - crop viewport height.
 * @returns a bounded state.
 */
export function clampCropState(
  state: CropState,
  viewWidth: number,
  viewHeight: number,
): CropState {
  const scale = Math.min(4, Math.max(1, state.scale))
  const base = coverScale(state.naturalWidth, state.naturalHeight, viewWidth, viewHeight)
  const maxX = Math.max(0, (state.naturalWidth * base * scale - viewWidth) / 2)
  const maxY = Math.max(0, (state.naturalHeight * base * scale - viewHeight) / 2)
  return {
    ...state,
    scale,
    offsetX: maxX === 0 ? 0 : Math.min(maxX, Math.max(-maxX, state.offsetX)),
    offsetY: maxY === 0 ? 0 : Math.min(maxY, Math.max(-maxY, state.offsetY)),
  }
}

/**
 * Export the visible crop viewport as a PNG blob.
 * @param image - decoded HTMLImageElement.
 * @param state - current pan/zoom state.
 * @param viewWidth - viewport width in CSS px.
 * @param viewHeight - viewport height in CSS px.
 * @returns PNG blob of the cropped region.
 */
export async function exportCroppedBlob(
  image: HTMLImageElement,
  state: CropState,
  viewWidth: number,
  viewHeight: number,
): Promise<Blob> {
  const bounded = clampCropState(state, viewWidth, viewHeight)
  const base = coverScale(bounded.naturalWidth, bounded.naturalHeight, viewWidth, viewHeight)
  const scale = base * bounded.scale
  const drawnWidth = bounded.naturalWidth * scale
  const drawnHeight = bounded.naturalHeight * scale
  const left = (viewWidth - drawnWidth) / 2 + bounded.offsetX
  const top = (viewHeight - drawnHeight) / 2 + bounded.offsetY

  const sourceX = Math.max(0, (-left) / scale)
  const sourceY = Math.max(0, (-top) / scale)
  const sourceW = Math.min(bounded.naturalWidth - sourceX, viewWidth / scale)
  const sourceH = Math.min(bounded.naturalHeight - sourceY, viewHeight / scale)

  const canvas = document.createElement('canvas')
  const outputScale = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.max(1, Math.round(viewWidth * outputScale))
  canvas.height = Math.max(1, Math.round(viewHeight * outputScale))
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('canvas unavailable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    sourceX, sourceY, sourceW, sourceH,
    0, 0, canvas.width, canvas.height,
  )
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => { if (blob) resolve(blob); else reject(new Error('crop encode failed')) },
      'image/png',
    )
  })
}

/**
 * Load a File into an HTMLImageElement.
 * @param file - user-selected image file.
 * @returns the decoded image and an object URL the caller must revoke.
 */
export function loadImageFile(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => { resolve({ image, objectUrl }) }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('image decode failed'))
    }
    image.src = objectUrl
  })
}
