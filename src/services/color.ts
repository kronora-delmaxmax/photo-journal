import type { ColorPalette } from '@/stores/journal'

// Simple client-side dominant color extraction using canvas
// Falls back to curated Japanese-inspired palettes if Canvas fails

interface RGB {
  r: number; g: number; b: number
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

function hexToRgb(hex: string): RGB {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!m) return { r: 0, g: 0, b: 0 }
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

// Extract dominant colors from an image
async function extractDominantColors(dataUrl: string, count: number = 5): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Scale down for performance
      const scale = Math.min(1, 100 / Math.max(img.width, img.height))
      canvas.width = Math.floor(img.width * scale)
      canvas.height = Math.floor(img.height * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve([])
        return
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data

      // Simple color quantization: bucket by hue ranges
      const buckets: { hue: number; colors: RGB[]; count: number }[] = []
      const step = Math.max(1, Math.floor(pixels.length / 4 / 500)) // sample ~500 pixels

      for (let i = 0; i < pixels.length; i += step * 4) {
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]

        // Skip very dark/bright pixels
        const brightness = (r + g + b) / 3
        if (brightness < 30 || brightness > 240) continue

        // Calculate hue (0-360)
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const delta = max - min
        let hue = 0
        if (delta !== 0) {
          if (max === r) hue = ((g - b) / delta) % 6
          else if (max === g) hue = (b - r) / delta + 2
          else hue = (r - g) / delta + 4
          hue = Math.round(hue * 60)
          if (hue < 0) hue += 360
        }

        // Bucket into 12 hue ranges
        const bucketIdx = Math.floor(hue / 30)
        if (!buckets[bucketIdx]) {
          buckets[bucketIdx] = { hue: bucketIdx * 30, colors: [], count: 0 }
        }
        buckets[bucketIdx].colors.push({ r, g, b })
        buckets[bucketIdx].count++
      }

      // Sort buckets by count, take top ones
      const sorted = buckets.filter(Boolean).sort((a, b) => b.count - a.count)
      const topBuckets = sorted.slice(0, count)

      const colors = topBuckets.map(bucket => {
        // Average the colors in this bucket
        const avg = bucket.colors.reduce(
          (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
          { r: 0, g: 0, b: 0 }
        )
        const n = bucket.colors.length
        return rgbToHex(
          Math.round(avg.r / n),
          Math.round(avg.g / n),
          Math.round(avg.b / n)
        )
      })

      resolve(colors)
    }

    img.onerror = () => resolve([])
    img.src = dataUrl
  })
}

// Japanese-inspired curated palettes (fallback)
const CURATED_PALETTES: ColorPalette[] = [
  {
    primary: '#c44d34',
    secondary: '#4a7c8c',
    accent: '#c8a84e',
    background: '#faf8f5',
    text: '#2c2420',
  },
  {
    primary: '#8b5e83',
    secondary: '#5c8a6c',
    accent: '#d4a04a',
    background: '#f7f3ef',
    text: '#2a2220',
  },
  {
    primary: '#3a6b8c',
    secondary: '#c4785a',
    accent: '#8a9b5a',
    background: '#f5f2ed',
    text: '#262420',
  },
  {
    primary: '#b86854',
    secondary: '#5a7a6a',
    accent: '#bfa04a',
    background: '#faf6f2',
    text: '#2c2420',
  },
]

/** Deterministic hash from string → 0..1 */
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return (h >>> 0) / 4294967295
}

function pickCurated(key: string): ColorPalette {
  const idx = Math.floor(hashStr(key) * CURATED_PALETTES.length)
  return desaturatePalette(CURATED_PALETTES[idx])
}

function mapToPalette(extractedColors: string[], photoKey: string): ColorPalette {
  if (extractedColors.length < 3) {
    return pickCurated(photoKey)
  }

  return desaturatePalette({
    primary: extractedColors[0] || '#c44d34',
    secondary: extractedColors[1] || '#4a7c8c',
    accent: extractedColors[2] || '#c8a84e',
    background: '#faf8f5',
    text: '#2c2420',
  })
}

/** 低饱和: desaturate by 15% for Japanese magazine aesthetic */
function desaturatePalette(p: ColorPalette): ColorPalette {
  const amount = 0.15
  return {
    primary: desaturateHex(p.primary, amount),
    secondary: desaturateHex(p.secondary, amount),
    accent: desaturateHex(p.accent, amount),
    background: p.background,
    text: p.text,
  }
}

function desaturateHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex)
  const gray = 0.299 * r + 0.587 * g + 0.114 * b
  return rgbToHex(
    Math.round(r + (gray - r) * amount),
    Math.round(g + (gray - g) * amount),
    Math.round(b + (gray - b) * amount)
  )
}

export async function extractColors(dataUrl: string): Promise<ColorPalette> {
  try {
    const colors = await extractDominantColors(dataUrl)
    return mapToPalette(colors, dataUrl)
  } catch {
    return pickCurated(dataUrl)
  }
}
