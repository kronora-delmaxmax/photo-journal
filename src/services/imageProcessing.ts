// ═══════════════ AI SUBJECT SEGMENTATION ═══════════════
// Uses @imgly/background-removal (ONNX + WASM, runs in browser)
// Automatically detects subject (person/animal/object) and removes background

import { removeBackground, preload } from '@imgly/background-removal'

export interface ProcessedImage {
  cutoutUrl: string       // subject with transparent background
  originalUrl: string     // original image
}

// ── Config ──
const SEGMENT_CONFIG = {
  model: 'isnet_quint8' as const,
  output: {
    format: 'image/png' as const,
    quality: 1,
  },
}

// Preload the AI model (call this early, before first segmentation)
let preloadPromise: Promise<void> | null = null

export async function preloadModel(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = preload(SEGMENT_CONFIG).catch(err => {
      console.error('Model preload failed:', err)
      preloadPromise = null
    })
  }
  return preloadPromise
}

// ═══════════════ MAIN API ═══════════════
export async function generateCutout(dataUrl: string): Promise<ProcessedImage> {
  try {
    // Convert dataURL to Blob for the API
    const blob = await (await fetch(dataUrl)).blob()

    // Run AI segmentation
    const resultBlob = await removeBackground(blob, SEGMENT_CONFIG)

    // Convert result back to data URL
    const cutoutUrl = await blobToDataURL(resultBlob)

    return { cutoutUrl, originalUrl: dataUrl }
  } catch (err) {
    console.error('AI segmentation failed, using original:', err)
    // Fallback: return original image
    return { cutoutUrl: dataUrl, originalUrl: dataUrl }
  }
}

// Process multiple photos in parallel (with concurrency limit)
export async function generateCutoutsBatch(
  photos: { id: string; dataUrl: string }[],
  onProgress?: (done: number, total: number) => void
): Promise<Record<string, string>> {
  const results: Record<string, string> = {}
  const batchSize = 2 // Process 2 at a time to avoid memory pressure

  for (let i = 0; i < photos.length; i += batchSize) {
    const batch = photos.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (p) => {
        const result = await generateCutout(p.dataUrl)
        return { id: p.id, url: result.cutoutUrl }
      })
    )
    for (const r of batchResults) {
      results[r.id] = r.url
    }
    onProgress?.(Math.min(i + batchSize, photos.length), photos.length)
  }

  return results
}

// ── Utils ──
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ═══════════════ COLOR EXTRACTION (Canvas — used as fallback) ═══════════════
export function extractColorPaletteFromURL(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 150 / Math.max(img.width, img.height))
      canvas.width = Math.floor(img.width * scale)
      canvas.height = Math.floor(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data

      const colorMap = new Map<string, number>()
      for (let i = 0; i < pixels.length; i += 16) {
        const r = Math.round(pixels[i] / 32) * 32
        const g = Math.round(pixels[i + 1] / 32) * 32
        const b = Math.round(pixels[i + 2] / 32) * 32
        const key = `${r},${g},${b}`
        colorMap.set(key, (colorMap.get(key) || 0) + 1)
      }

      const sorted = [...colorMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)

      resolve(sorted.map(([key]) => {
        const [r, g, b] = key.split(',').map(Number)
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
      }))
    }
    img.src = dataUrl
  })
}

// ═══════════════ Paper texture rendering ═══════════════
export async function renderOnPaper(
  cutoutUrl: string,
  bgColor: string,
  texture: 'washi' | 'kraft' | 'plain' | 'grid' | 'cream'
): Promise<string> {
  const img = await loadImage(cutoutUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Texture
  if (texture === 'washi') {
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 30 + 2, 0.5)
    }
  } else if (texture === 'grid') {
    ctx.strokeStyle = 'rgba(0,0,0,0.03)'
    ctx.lineWidth = 0.5
    for (let x = 0; x < canvas.width; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke() }
    for (let y = 0; y < canvas.height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke() }
  }

  // Cutout on top
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// ═══════════════ STROKE / OUTLINE around cutout subject ═══════════════
// strokeLevel: 1=thin(~0.5%), 2=medium(~0.8%), 3=thick(~1.2%), 4=超粗(25px fixed)

export async function applyStroke(
  cutoutUrl: string,
  strokeColor: string = '#2c2420',
  strokeLevel: number = 2
): Promise<{ url: string; pixelWidth: number }> {
  const img = await loadImage(cutoutUrl)
  const smallerDim = Math.min(img.width, img.height)

  // Level 4 = fixed 25px, others = proportional
  let strokeWidth: number
  if (strokeLevel >= 4) {
    strokeWidth = 25
  } else {
    const ratios = [0, 0.005, 0.008, 0.012]
    strokeWidth = Math.max(2, Math.round(smallerDim * (ratios[strokeLevel] || 0.008)))
  }

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!

  // Draw original cutout
  ctx.drawImage(img, 0, 0)

  // Get alpha channel
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const alpha = new Uint8Array(canvas.width * canvas.height)
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = imageData.data[i * 4 + 3] // alpha channel
  }

  // Dilate alpha mask to find outer edge
  const dilated = new Uint8Array(alpha.length)
  const w = canvas.width, h = canvas.height
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0
      // Check neighborhood within strokeWidth
      for (let dy = -strokeWidth; dy <= strokeWidth; dy++) {
        for (let dx = -strokeWidth; dx <= strokeWidth; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const val = alpha[ny * w + nx]
            if (val > maxVal) maxVal = val
          }
        }
      }
      dilated[y * w + x] = maxVal
    }
  }

  // Parse stroke color
  const sc = hexToRgba(strokeColor)

  // Apply stroke: color pixels that are in dilated mask but NOT in original
  for (let i = 0; i < alpha.length; i++) {
    const origAlpha = alpha[i]
    const dilAlpha = dilated[i]

    if (dilAlpha > 0 && origAlpha < 128) {
      // This is the stroke area — between original and dilated
      const idx = i * 4
      imageData.data[idx] = sc.r       // R
      imageData.data[idx + 1] = sc.g   // G
      imageData.data[idx + 2] = sc.b   // B
      imageData.data[idx + 3] = Math.min(255, dilAlpha) // A (faded at edges)
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return { url: canvas.toDataURL('image/png'), pixelWidth: strokeWidth }
}

function hexToRgba(hex: string): { r: number; g: number; b: number } {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!m) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  }
}
