// ═══════════════ WORKSPACE RENDERER — preview & export ═══════════════
// Draws journal page directly on a provided canvas context.
// Single rendering path: what you see IS what you get.

import type { JournalPhoto, PhotoAnalysis, ColorPalette } from '@/stores/journal'
import { PAPERS } from '@/config/workspace'

export interface PhotoBounds {
  id: string
  x: number; y: number; w: number; h: number
}

export interface WorkspaceOpts {
  photos: JournalPhoto[]
  cutouts: Record<string, string>
  analysis: PhotoAnalysis | null
  palette: ColorPalette
  templateId: string
  paperBg: string
  width: number
  height: number
  positions: Record<string, { x: number; y: number; scale: number }>
  date?: Date  // record date; falls back to today for new/preview pages
}

export async function renderWorkspace(
  ctx: CanvasRenderingContext2D,
  opts: WorkspaceOpts
): Promise<PhotoBounds[]> {
  const { width: W, height: H, photos: p, analysis: a, palette: pl, templateId: tpl, paperBg, cutouts, positions, date } = opts
  const recordDate = date || new Date()

  ctx.clearRect(0, 0, W, H)

  const paperColor = PAPERS[paperBg]?.color || '#ffffff'
  ctx.fillStyle = paperColor
  ctx.fillRect(0, 0, W, H)
  if (paperBg === 'grid') drawGrid(ctx, W, H)
  if (paperBg === 'washi') drawWashi(ctx, W, H)

  const pad = Math.round(W * 0.06)
  const gap = Math.round(W * 0.025)
  const serif = "'Noto Serif SC', 'STSong', serif"

  let bounds: PhotoBounds[] = []

  if (tpl === 'magazine') {
    bounds = await drawMagazine(ctx, p, a, pl, cutouts, positions, W, H, pad, gap, serif, recordDate)
  } else if (tpl === 'grid') {
    bounds = await drawGridTpl(ctx, p, a, pl, cutouts, positions, W, H, pad, gap, serif, recordDate)
  } else if (tpl === 'poetic') {
    bounds = await drawPoetic(ctx, p, a, pl, cutouts, positions, W, H, pad, serif, recordDate)
  } else if (tpl === 'collage') {
    bounds = await drawCollage(ctx, p, a, pl, cutouts, positions, W, H, pad, serif, recordDate)
  } else if (tpl === 'minimal') {
    bounds = await drawMinimal(ctx, p, a, pl, cutouts, positions, W, H, pad, gap, serif, recordDate)
  } else if (tpl === 'editorial') {
    bounds = await drawEditorial(ctx, p, a, pl, cutouts, positions, W, H, pad, gap, serif, recordDate)
  } else if (tpl === 'bleed') {
    bounds = await drawBleed(ctx, p, a, pl, cutouts, positions, W, H, pad, serif, recordDate)
  } else if (tpl === 'popeye') {
    bounds = await drawPopeye(ctx, p, a, pl, cutouts, positions, W, H, pad, gap, serif, recordDate)
  } else if (tpl === 'reverse') {
    bounds = await drawReverse(ctx, p, a, pl, cutouts, positions, W, H, pad, serif, recordDate)
  } else {
    bounds = await drawDiary(ctx, p, a, pl, cutouts, positions, W, H, pad, serif, recordDate)
  }

  return bounds
}

// ═══════════════ IMAGE CACHE (LRU, max 30) ═══════════════
const MAX_CACHE = 30
const imgCache = new Map<string, HTMLImageElement>()
const imgCacheOrder: string[] = []

function loadImg(src: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(src)
  if (cached) {
    // Move to end (most recently used)
    const idx = imgCacheOrder.indexOf(src)
    if (idx > -1) { imgCacheOrder.splice(idx, 1); imgCacheOrder.push(src) }
    return Promise.resolve(cached)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      imgCache.set(src, img)
      imgCacheOrder.push(src)
      // Evict oldest when over capacity
      while (imgCacheOrder.length > MAX_CACHE) {
        const old = imgCacheOrder.shift()!
        imgCache.delete(old)
      }
      resolve(img)
    }
    img.onerror = () => reject(new Error('img load failed'))
    img.src = src
  })
}

// ═══════════════ TEMPLATES ═══════════════

async function drawMagazine(
  ctx: CanvasRenderingContext2D, p: JournalPhoto[], a: PhotoAnalysis | null,
  pl: ColorPalette, cutouts: Record<string, string>,
  positions: Record<string, { x: number; y: number; scale: number }>,
  W: number, H: number, _pad: number, gap: number, serif: string, date: Date
): Promise<PhotoBounds[]> {
  const bounds: PhotoBounds[] = []
  if (!p[0]) return bounds

  const sans = "'Noto Sans SC', 'PingFang SC', sans-serif"
  const ml = Math.round(W * 0.075)
  const mr = Math.round(W * 0.055)
  const mt = Math.round(H * 0.05)
  const contentW = W - ml - mr

  // ── Hero photo: full content width, ~54%H ──
  const heroH = Math.round(H * 0.54)
  const heroW = contentW
  const heroX = ml

  const heroPos = positions[p[0].id] || { x: 50, y: 50, scale: 1 }
  const heroBounds = await drawCover(ctx, cutouts[p[0].id] || p[0].dataUrl, heroX, mt, heroW, heroH, heroPos.x, heroPos.y, heroPos.scale)
  bounds.push({ id: p[0].id, ...heroBounds })

  // ── Subtle bottom gradient on hero (fade to paper) ──
  const grad = ctx.createLinearGradient(0, mt + heroH * 0.75, 0, mt + heroH)
  grad.addColorStop(0, 'transparent'); grad.addColorStop(1, 'rgba(0,0,0,0.2)')
  ctx.fillStyle = grad; ctx.fillRect(heroX, mt + heroH * 0.75, heroW, heroH * 0.25)

  // ── Thumbnail strip: 1-3 small photos, right-aligned below hero ──
  const thumbY = mt + heroH + gap
  const smallCount = Math.min(p.length - 1, 3)
  let thumbBottom = thumbY
  if (smallCount > 0) {
    const tw = Math.round(contentW * 0.21)
    const th = Math.round(tw * 0.72)
    for (let i = 0; i < smallCount; i++) {
      const tx = W - mr - (smallCount - i) * (tw + gap)
      const pos = positions[p[i + 1].id] || { x: 50, y: 50, scale: 1 }
      const b = await drawCover(ctx, cutouts[p[i + 1].id] || p[i + 1].dataUrl, tx, thumbY, tw, th, pos.x, pos.y, pos.scale)
      bounds.push({ id: p[i + 1].id, ...b })
    }
    thumbBottom = thumbY + th
  }

  // ── Text zone: POPEYE hierarchy below thumbnails ──
  const textStartY = thumbBottom + Math.round(H * 0.035)
  const tx = ml
  const labelSize = Math.round(W * 0.02)
  const titleSize = Math.round(W * 0.045)
  const capSize = Math.round(W * 0.026)
  const labelLH = Math.round(labelSize * 1.4)
  const titleLH = Math.round(titleSize * 1.2)
  const capLH = Math.round(capSize * 1.5)
  const smGap = Math.round(H * 0.012)

  let cy = textStartY

  // ① Date
  ctx.fillStyle = '#9a8e82'
  ctx.font = `${labelSize}px ${sans}`
  ctx.textAlign = 'left'
  ctx.fillText(fmtDate(date), tx, cy + labelLH)
  cy += labelLH + smGap

  // ② Accent bar
  const barW = Math.round(W * 0.035)
  const barH = Math.max(3, Math.round(H * 0.0035))
  ctx.fillStyle = pl.primary
  ctx.fillRect(tx, cy, barW, barH)
  cy += barH + Math.round(H * 0.028)

  // ③ Mood
  if (a?.mood) {
    ctx.fillStyle = '#1a1512'
    ctx.font = `bold ${titleSize}px ${serif}`
    ctx.textAlign = 'left'
    ctx.fillText(a.mood, tx, cy + titleLH)
    cy += titleLH + Math.round(H * 0.016)
  }

  // ④ Style tag
  if (a?.style) {
    ctx.fillStyle = pl.secondary || '#4a7c8c'
    ctx.font = `${labelSize}px ${sans}`
    ctx.textAlign = 'left'
    ctx.fillText(`# ${a.style}`, tx, cy + labelLH)
    cy += labelLH + smGap
  }

  // ⑤ Caption
  if (a?.caption) {
    ctx.fillStyle = '#4a4038'
    ctx.font = `${capSize}px ${serif}`
    ctx.textAlign = 'left'
    const textMaxW = contentW
    const lines = nakiwakare(a.caption.split('\n')).slice(0, 3).flatMap(l => wrapLines(ctx, l, textMaxW))
    for (const line of lines) {
      ctx.fillText(line, tx, cy + capLH)
      cy += capLH
    }
  }

  return bounds
}

async function drawGridTpl(
  ctx: CanvasRenderingContext2D, p: JournalPhoto[], a: PhotoAnalysis | null,
  pl: ColorPalette, cutouts: Record<string, string>,
  positions: Record<string, { x: number; y: number; scale: number }>,
  W: number, H: number, pad: number, gap: number, serif: string, date: Date
): Promise<PhotoBounds[]> {
  const bounds: PhotoBounds[] = []
  ctx.fillStyle = '#8c8078'; ctx.font = `${Math.round(W*0.025)}px ${serif}`; ctx.textAlign = 'left'
  ctx.fillText(fmtDate(date), pad, Math.round(H*0.06))
  if (a?.style) {
    ctx.fillStyle = pl.primary; ctx.font = `bold ${Math.round(W*0.028)}px ${serif}`; ctx.textAlign = 'right'
    ctx.fillText(a.style, W - pad, Math.round(H*0.06))
  }
  // Accent bar
  const barW = Math.round(W * 0.03); const barH = Math.max(2, Math.round(H * 0.003))
  ctx.fillStyle = pl.primary; ctx.fillRect(pad, Math.round(H*0.072), barW, barH)
  const gridTop = Math.round(H * 0.09)
  const gs = Math.round((W - pad*2 - gap) / 2)
  const gh = Math.round(gs * 0.72)
  for (let i = 0; i < Math.min(p.length, 4); i++) {
    const gx = pad + (i%2)*(gs+gap)
    const gy = gridTop + Math.floor(i/2)*(gh+gap)
    const pos = positions[p[i].id] || { x: 50, y: 50, scale: 1 }
    const b = await drawCover(ctx, cutouts[p[i].id] || p[i].dataUrl, gx, gy, gs, gh, pos.x, pos.y, pos.scale)
    bounds.push({ id: p[i].id, ...b })
  }
  const ty = gridTop + 2*(gh+gap) + Math.round(H*0.03)
  if (a?.caption) {
    ctx.fillStyle = '#2c2420'; ctx.font = `${Math.round(W*0.03)}px ${serif}`; ctx.textAlign = 'left'
    const maxW = W - pad * 2
    const lines = nakiwakare(a.caption.split('\n')).flatMap(l => wrapLines(ctx, l, maxW))
    lines.forEach((l, i) => ctx.fillText(l, pad, ty + i*Math.round(H*0.035)))
  }
  return bounds
}

async function drawPoetic(
  ctx: CanvasRenderingContext2D, p: JournalPhoto[], a: PhotoAnalysis | null,
  pl: ColorPalette, cutouts: Record<string, string>,
  positions: Record<string, { x: number; y: number; scale: number }>,
  W: number, H: number, pad: number, serif: string, date: Date
): Promise<PhotoBounds[]> {
  const bounds: PhotoBounds[] = []
  if (!p[0]) return bounds
  const photoH = Math.round(H * 0.52)
  const pos = positions[p[0].id] || { x: 50, y: 50, scale: 1 }
  const b = await drawCover(ctx, cutouts[p[0].id] || p[0].dataUrl, 0, 0, W, photoH, pos.x, pos.y, pos.scale)
  bounds.push({ id: p[0].id, ...b })
  const ty = photoH + Math.round(H*0.04)
  ctx.fillStyle = '#8c8078'; ctx.font = `${Math.round(W*0.024)}px ${serif}`; ctx.textAlign = 'left'
  ctx.fillText(fmtDate(date), pad, ty)
  ctx.fillStyle = pl.primary; ctx.fillRect(pad, ty + Math.round(H*0.015), Math.round(W*0.03), Math.round(H*0.002))
  if (a?.caption) {
    ctx.fillStyle = '#2c2420'; ctx.font = `${Math.round(W*0.04)}px ${serif}`
    const maxW = W - pad * 2
    const lines = nakiwakare(a.caption.split('\n')).flatMap(l => wrapLines(ctx, l, maxW))
    lines.forEach((l, i) => ctx.fillText(l, pad, ty + Math.round(H*0.05) + i*Math.round(H*0.045)))
  }
  if (p.length > 1) {
    const th = Math.round(H * 0.05)
    const tw = Math.round(W * 0.15)
    for (let i = 0; i < Math.min(p.length-1, 2); i++) {
      const tx = W - pad - (i+1)*(tw + Math.round(W*0.02))
      const tpos = positions[p[i+1].id] || { x: 50, y: 50, scale: 1 }
      const tb = await drawCover(ctx, cutouts[p[i+1].id] || p[i+1].dataUrl, tx, H - pad - th, tw, th, tpos.x, tpos.y, tpos.scale)
      bounds.push({ id: p[i+1].id, ...tb })
    }
  }
  return bounds
}

async function drawCollage(
  ctx: CanvasRenderingContext2D, p: JournalPhoto[], a: PhotoAnalysis | null,
  pl: ColorPalette, cutouts: Record<string, string>,
  positions: Record<string, { x: number; y: number; scale: number }>,
  W: number, H: number, pad: number, serif: string, date: Date
): Promise<PhotoBounds[]> {
  const bounds: PhotoBounds[] = []
  const cw = Math.round(W - pad * 2)
  const ch = Math.round(H * 0.70)
  const oy = Math.round(H * 0.06)
  const items = [
    { left: 0.00, top: 0.00, w: 0.55, ratio: 4/3 },
    { left: 0.48, top: 0.05, w: 0.48, ratio: 1 },
    { left: 0.05, top: 0.38, w: 0.42, ratio: 5/4 },
    { left: 0.42, top: 0.45, w: 0.50, ratio: 2/3 },
    { left: 0.15, top: 0.60, w: 0.45, ratio: 9/16 },
  ]
  const baseRotations = [-2, 1.5, -1, 2.5, 0]
  const rotations = p.length === 1 ? baseRotations.map(() => 0) : baseRotations
  for (let i = 0; i < Math.min(p.length, 5); i++) {
    const it = items[i]
    const pw = Math.round(cw * it.w)
    const ph = Math.round(pw * it.ratio)
    const px = pad + Math.round(cw * it.left)
    const py = oy + Math.round(ch * it.top)
    ctx.save()
    ctx.translate(px + pw / 2, py + ph / 2)
    ctx.rotate(rotations[i] * Math.PI / 180)
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = Math.round(W * 0.02); ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3
    const pos = positions[p[i].id] || { x: 50, y: 50, scale: 1 }
    await drawCover(ctx, cutouts[p[i].id] || p[i].dataUrl, -pw / 2, -ph / 2, pw, ph, pos.x, pos.y, pos.scale)
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(200,180,150,0.45)'
    ctx.fillRect(-Math.round(pw * 0.3), -Math.round(ph / 2) - Math.round(ph * 0.01), Math.round(pw * 0.4), Math.round(Math.max(10, ph * 0.03)))
    ctx.restore()
    bounds.push({ id: p[i].id, x: px, y: py, w: pw, h: ph })
  }
  let maxBottom = oy
  for (let i = 0; i < Math.min(p.length, 5); i++) {
    const it = items[i]
    const pw = Math.round(cw * it.w)
    const ph = Math.round(pw * it.ratio)
    const bottom = oy + Math.round(ch * it.top) + ph
    if (bottom > maxBottom) maxBottom = bottom
  }
  const ty = maxBottom + Math.round(H * 0.04)
  const sans = "'Noto Sans SC', 'PingFang SC', sans-serif"
  // Date + accent bar (top of text zone)
  ctx.fillStyle = '#9a8e82'; ctx.font = `${Math.round(W*0.02)}px ${sans}`; ctx.textAlign = 'left'
  ctx.fillText(fmtDate(date), pad, ty)
  const barW = Math.round(W * 0.03); const barH = Math.max(2, Math.round(H * 0.003))
  ctx.fillStyle = pl.primary; ctx.fillRect(pad, ty + Math.round(H*0.018), barW, barH)
  // Caption
  const capY = ty + barH + Math.round(H * 0.03)
  if (a?.caption) {
    ctx.fillStyle = '#2c2420'; ctx.font = `${Math.round(W * 0.035)}px ${serif}`; ctx.textAlign = 'center'
    const maxW = W - pad * 2
    const lines = nakiwakare(a.caption.split('\n')).flatMap(l => wrapLines(ctx, l, maxW))
    lines.forEach((l, i) => ctx.fillText(l, W / 2, capY + i * Math.round(H * 0.04)))
  }
  return bounds
}

async function drawDiary(
  ctx: CanvasRenderingContext2D, p: JournalPhoto[], a: PhotoAnalysis | null,
  pl: ColorPalette, cutouts: Record<string, string>,
  positions: Record<string, { x: number; y: number; scale: number }>,
  W: number, H: number, pad: number, serif: string, date: Date
): Promise<PhotoBounds[]> {
  const bounds: PhotoBounds[] = []
  ctx.fillStyle = '#2c2420'; ctx.font = `bold ${Math.round(W*0.04)}px ${serif}`; ctx.textAlign = 'left'
  ctx.fillText(fmtDate(date), pad, Math.round(H*0.07))
  ctx.fillStyle = pl.primary; ctx.font = `${Math.round(W*0.026)}px ${serif}`; ctx.textAlign = 'right'
  ctx.fillText(a?.mood || '记录', W - pad, Math.round(H*0.07))
  ctx.strokeStyle = '#e0d8cc'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pad, Math.round(H*0.09)); ctx.lineTo(W-pad, Math.round(H*0.09)); ctx.stroke()
  // Accent bar below header
  const barW = Math.round(W * 0.03); const barH = Math.max(2, Math.round(H * 0.003))
  ctx.fillStyle = pl.primary; ctx.fillRect(pad, Math.round(H*0.095), barW, barH)
  const polaroidW = Math.round(W * 0.28)
  const polaroidH = Math.round(polaroidW * 1.2)
  const py = Math.round(H * 0.12)
  for (let i = 0; i < Math.min(p.length, 3); i++) {
    const px = pad + i*(polaroidW + Math.round(W*0.04)) + (i%2===0?0:Math.round(polaroidW*0.3))
    const r = i%2===0?-2:2
    ctx.save()
    ctx.translate(px + polaroidW/2, py + polaroidH/2)
    ctx.rotate(r * Math.PI/180)
    const fw = Math.round(polaroidW * 0.08)
    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = Math.round(W*0.015); ctx.shadowOffsetY = 2
    ctx.fillRect(-polaroidW/2, -polaroidH/2, polaroidW, polaroidH)
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0
    const pos = positions[p[i].id] || { x: 50, y: 50, scale: 1 }
    await drawCover(ctx, cutouts[p[i].id] || p[i].dataUrl, -polaroidW/2+fw, -polaroidH/2+fw, polaroidW-fw*2, polaroidW-fw*2, pos.x, pos.y, pos.scale)
    ctx.restore()
    bounds.push({ id: p[i].id, x: px, y: py, w: polaroidW, h: polaroidH })
  }
  const ty = py + polaroidH + Math.round(H*0.05)
  if (a?.content) {
    ctx.fillStyle = '#4a4038'; ctx.font = `${Math.round(W*0.026)}px serif`; ctx.textAlign = 'left'
    const text = a.content.slice(0, 80)
    let ly = ty
    for (const line of wrapLines(ctx, text, W - pad*2)) {
      ctx.fillText(line, pad, ly)
      ly += Math.round(H*0.035)
    }
  }
  return bounds
}

// ═══════════════ POPEYE-INSPIRED TEMPLATES ═══════════════
// Key principles: asymmetric margins, generous bottom breathing room,
// accent color bar, text hierarchy: date → bar → mood → caption.

async function drawMinimal(
  ctx: CanvasRenderingContext2D, p: JournalPhoto[], a: PhotoAnalysis | null,
  pl: ColorPalette, cutouts: Record<string, string>,
  positions: Record<string, { x: number; y: number; scale: number }>,
  W: number, H: number, _pad: number, _gap: number, serif: string, date: Date
): Promise<PhotoBounds[]> {
  const bounds: PhotoBounds[] = []
  if (!p[0]) return bounds

  const sans = "'Noto Sans SC', 'PingFang SC', sans-serif"
  // Asymmetric POPEYE margins: wider bottom, slightly wider left
  const ml = Math.round(W * 0.08)
  const mr = Math.round(W * 0.06)
  const mt = Math.round(H * 0.06)
  const mb = Math.round(H * 0.16)  // generous bottom — the POPEYE signature

  // Photo: centered in the available space, not too large
  const photoW = Math.round((W - ml - mr) * 0.82)
  const ar = p[0].aspectRatio
  let ph = Math.round(photoW / ar)
  const maxPhotoH = Math.round((H - mt - mb) * 0.62)
  if (ph > maxPhotoH) { ph = maxPhotoH }
  const pw = Math.round(ph * ar)
  const px = ml + Math.round((W - ml - mr - pw) / 2)
  const py = mt + Math.round((H - mt - mb - ph) * 0.38)

  const pos0 = positions[p[0].id] || { x: 50, y: 50, scale: 1 }
  const b = await drawCover(ctx, cutouts[p[0].id] || p[0].dataUrl, px, py, pw, ph, pos0.x, pos0.y, pos0.scale)
  bounds.push({ id: p[0].id, ...b })

  // ── Text zone: sequential from photo bottom ──
  const textStartY = py + ph + Math.round(H * 0.04)
  const tx = ml
  const labelSize = Math.round(W * 0.02)
  const titleSize = Math.round(W * 0.05)
  const capSize = Math.round(W * 0.026)
  const labelLH = Math.round(labelSize * 1.4)
  const titleLH = Math.round(titleSize * 1.2)
  const capLH = Math.round(capSize * 1.5)
  const smGap = Math.round(H * 0.012)

  let cy = textStartY

  // ① Date — tiny, subtle
  ctx.fillStyle = '#9a8e82'
  ctx.font = `${labelSize}px ${sans}`
  ctx.textAlign = 'left'
  ctx.fillText(fmtDate(date), tx, cy + labelLH)
  cy += labelLH + smGap

  // ② Accent bar — thin color line, POPEYE hallmark
  const barW = Math.round(W * 0.035)
  const barH = Math.max(3, Math.round(H * 0.0035))
  ctx.fillStyle = pl.primary
  ctx.fillRect(tx, cy, barW, barH)
  cy += barH + Math.round(H * 0.028)

  // ③ Mood — large bold serif, the emotional anchor
  if (a?.mood) {
    ctx.fillStyle = '#1a1512'
    ctx.font = `bold ${titleSize}px ${serif}`
    ctx.textAlign = 'left'
    ctx.fillText(a.mood, tx, cy + titleLH)
    cy += titleLH + Math.round(H * 0.016)
  }

  // ④ Style tag — small, colored
  if (a?.style) {
    ctx.fillStyle = pl.secondary || '#4a7c8c'
    ctx.font = `${labelSize}px ${sans}`
    ctx.textAlign = 'left'
    ctx.fillText(`# ${a.style}`, tx, cy + labelLH)
    cy += labelLH + smGap
  }

  // ⑤ Caption — 1-2 lines, serif, warm dark gray
  if (a?.caption) {
    ctx.fillStyle = '#4a4038'
    ctx.font = `${capSize}px ${serif}`
    ctx.textAlign = 'left'
    const textMaxW = W - ml - mr
    const lines = nakiwakare(a.caption.split('\n')).slice(0, 2).flatMap(l => wrapLines(ctx, l, textMaxW))
    for (const line of lines) {
      ctx.fillText(line, tx, cy + capLH)
      cy += capLH
    }
  }

  return bounds
}

async function drawEditorial(
  ctx: CanvasRenderingContext2D, p: JournalPhoto[], a: PhotoAnalysis | null,
  pl: ColorPalette, cutouts: Record<string, string>,
  positions: Record<string, { x: number; y: number; scale: number }>,
  W: number, H: number, _pad: number, gap: number, serif: string, date: Date
): Promise<PhotoBounds[]> {
  const bounds: PhotoBounds[] = []
  if (!p[0]) return bounds

  const sans = "'Noto Sans SC', 'PingFang SC', sans-serif"
  const ml = Math.round(W * 0.07)
  const mr = Math.round(W * 0.05)
  const mt = Math.round(H * 0.05)
  const mb = Math.round(H * 0.15)  // large bottom margin for text
  const contentW = W - ml - mr
  const contentH = H - mt - mb

  // ── Hero photo: full content width, ~58% of content height ──
  const heroH = Math.round(contentH * 0.58)
  const heroW = contentW
  const heroX = ml
  const heroY = mt

  const pos0 = positions[p[0].id] || { x: 50, y: 50, scale: 1 }
  const b0 = await drawCover(ctx, cutouts[p[0].id] || p[0].dataUrl, heroX, heroY, heroW, heroH, pos0.x, pos0.y, pos0.scale)
  bounds.push({ id: p[0].id, ...b0 })

  // ── Accent thumbnails: 1-2 small photos, bottom-right ──
  let thumbBottom = heroY + heroH
  const thumbCount = Math.min(p.length - 1, 2)
  if (thumbCount > 0) {
    const tw = Math.round(contentW * 0.22)
    const th = Math.round(tw * 0.75)
    const ty = heroY + heroH + gap
    for (let i = 0; i < thumbCount; i++) {
      const tx = W - mr - (thumbCount - i) * (tw + gap)
      const pos = positions[p[i + 1].id] || { x: 50, y: 50, scale: 1 }
      const tb = await drawCover(ctx, cutouts[p[i + 1].id] || p[i + 1].dataUrl, tx, ty, tw, th, pos.x, pos.y, pos.scale)
      bounds.push({ id: p[i + 1].id, ...tb })
    }
    thumbBottom = ty + Math.round(contentW * 0.22 * 0.75)
  }

  // ── Text zone: sequential below photos ──
  const textStartY = thumbBottom + Math.round(H * 0.035)
  const tx = ml
  const labelSize = Math.round(W * 0.02)
  const titleSize = Math.round(W * 0.048)
  const capSize = Math.round(W * 0.026)
  const labelLH = Math.round(labelSize * 1.4)
  const titleLH = Math.round(titleSize * 1.2)
  const capLH = Math.round(capSize * 1.5)
  const smGap = Math.round(H * 0.012)

  let cy = textStartY

  // ① Date
  ctx.fillStyle = '#9a8e82'
  ctx.font = `${labelSize}px ${sans}`
  ctx.textAlign = 'left'
  ctx.fillText(fmtDate(date), tx, cy + labelLH)
  cy += labelLH + smGap

  // ② Accent bar
  const barW = Math.round(W * 0.035)
  const barH = Math.max(3, Math.round(H * 0.0035))
  ctx.fillStyle = pl.primary
  ctx.fillRect(tx, cy, barW, barH)
  cy += barH + Math.round(H * 0.028)

  // ③ Mood headline
  if (a?.mood) {
    ctx.fillStyle = '#1a1512'
    ctx.font = `bold ${titleSize}px ${serif}`
    ctx.textAlign = 'left'
    ctx.fillText(a.mood, tx, cy + titleLH)
    cy += titleLH + Math.round(H * 0.016)
  }

  // ④ Style tag
  if (a?.style) {
    ctx.fillStyle = pl.secondary || '#4a7c8c'
    ctx.font = `${labelSize}px ${sans}`
    ctx.textAlign = 'left'
    ctx.fillText(`# ${a.style}`, tx, cy + labelLH)
    cy += labelLH + smGap
  }

  // ⑤ Caption — up to 3 lines (editorial has more room)
  if (a?.caption) {
    ctx.fillStyle = '#4a4038'
    ctx.font = `${capSize}px ${serif}`
    ctx.textAlign = 'left'
    const textMaxW = W - ml - mr
    const lines = nakiwakare(a.caption.split('\n')).slice(0, 3).flatMap(l => wrapLines(ctx, l, textMaxW))
    for (const line of lines) {
      ctx.fillText(line, tx, cy + capLH)
      cy += capLH
    }
  }

  return bounds
}

async function drawBleed(
  ctx: CanvasRenderingContext2D, p: JournalPhoto[], a: PhotoAnalysis | null,
  _pl: ColorPalette, cutouts: Record<string, string>,
  positions: Record<string, { x: number; y: number; scale: number }>,
  W: number, H: number, _pad: number, serif: string, date: Date
): Promise<PhotoBounds[]> {
  const bounds: PhotoBounds[] = []
  if (!p[0]) return bounds

  const sans = "'Noto Sans SC', 'PingFang SC', sans-serif"

  // ── Full-bleed photo: edge to edge, zero margins ──
  const pos0 = positions[p[0].id] || { x: 50, y: 50, scale: 1 }
  const b = await drawCover(ctx, cutouts[p[0].id] || p[0].dataUrl, 0, 0, W, H, pos0.x, pos0.y, pos0.scale)
  bounds.push({ id: p[0].id, ...b })

  // ── Gradient overlay: dark at bottom 35%, transparent above ──
  const gradStart = H * 0.55
  const grad = ctx.createLinearGradient(0, gradStart, 0, H)
  grad.addColorStop(0, 'transparent')
  grad.addColorStop(0.4, 'rgba(0,0,0,0.25)')
  grad.addColorStop(1, 'rgba(0,0,0,0.65)')
  ctx.fillStyle = grad
  ctx.fillRect(0, gradStart, W, H - gradStart)

  // ── Text overlay: white on dark gradient, bottom-left ──
  const tx = Math.round(W * 0.07)
  const labelSize = Math.round(W * 0.02)
  const titleSize = Math.round(W * 0.055)
  const capSize = Math.round(W * 0.026)
  const labelLH = Math.round(labelSize * 1.4)
  const titleLH = Math.round(titleSize * 1.15)
  const capLH = Math.round(capSize * 1.5)
  const smGap = Math.round(H * 0.01)

  // Start from bottom, working up
  let cy = H - Math.round(H * 0.07)

  // Caption — smallest, at the very bottom
  if (a?.caption) {
    const textW = W - tx * 2
    const lines = nakiwakare(a.caption.split('\n')).slice(0, 2).flatMap(l => wrapLines(ctx, l, textW))
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = `${capSize}px ${serif}`
    ctx.textAlign = 'left'
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], tx, cy)
      cy -= capLH
    }
    cy -= smGap
  }

  // Mood — large bold white
  if (a?.mood) {
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${titleSize}px ${serif}`
    ctx.textAlign = 'left'
    ctx.fillText(a.mood, tx, cy)
    cy -= titleLH + smGap
  }

  // Style tag
  if (a?.style) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = `${labelSize}px ${sans}`
    ctx.textAlign = 'left'
    ctx.fillText(`# ${a.style}`, tx, cy)
    cy -= labelLH + smGap
  }

  // Date — very top of text stack
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = `${labelSize}px ${sans}`
  ctx.textAlign = 'left'
  ctx.fillText(fmtDate(date), tx, cy)

  return bounds
}

// ═══════════════ REVERSE — text on top, photo on bottom ═══════════════
// POPEYE occasionally inverts the layout (2/36 pages): text zone above, photo below.
// Same asymmetric margins and breathing room, just flipped vertically.

async function drawReverse(
  ctx: CanvasRenderingContext2D, p: JournalPhoto[], a: PhotoAnalysis | null,
  pl: ColorPalette, cutouts: Record<string, string>,
  positions: Record<string, { x: number; y: number; scale: number }>,
  W: number, H: number, _pad: number, serif: string, date: Date
): Promise<PhotoBounds[]> {
  const bounds: PhotoBounds[] = []
  if (!p[0]) return bounds

  const sans = "'Noto Sans SC', 'PingFang SC', sans-serif"

  const ml = Math.round(W * 0.085)
  const mr = Math.round(W * 0.055)
  const mt = Math.round(H * 0.06)
  const mb = Math.round(H * 0.16)
  const contentW = W - ml - mr

  const labelSize = Math.round(W * 0.019)
  const titleSize = Math.round(W * 0.052)
  const capSize = Math.round(W * 0.024)
  const labelLH = Math.round(labelSize * 1.5)
  const titleLH = Math.round(titleSize * 1.15)
  const capLH = Math.round(capSize * 1.6)
  const smGap = Math.round(H * 0.01)
  const mdGap = Math.round(H * 0.028)
  const barW = Math.round(W * 0.04)
  const barH = Math.max(3, Math.round(H * 0.004))

  const tx = ml

  // ── Text zone: top portion ──
  const textMaxW = Math.round(contentW * 0.72)
  ctx.font = `bold ${titleSize}px ${serif}`
  const moodLines = a?.mood ? wrapLines(ctx, a.mood, textMaxW) : []
  ctx.font = `${capSize}px ${serif}`
  const capLines = a?.caption
    ? nakiwakare(a.caption.split('\n')).slice(0, 2).flatMap(l => wrapLines(ctx, l, textMaxW))
    : []

  const textBlockH =
    labelLH + Math.round(H * 0.006) +
    barH + mdGap +
    (moodLines.length ? moodLines.length * titleLH + Math.round(H * 0.012) : 0) +
    (a?.style ? labelLH + smGap : 0) +
    capLines.length * capLH

  let cy = mt

  // ① Date
  ctx.fillStyle = '#a0988c'
  ctx.font = `${labelSize}px ${sans}`
  ctx.textAlign = 'left'
  ctx.fillText(fmtDate(date), tx, cy + labelLH)
  cy += labelLH + Math.round(H * 0.006)

  // ② Accent bar
  ctx.fillStyle = pl.primary
  ctx.fillRect(tx, cy, barW, barH)
  cy += barH + mdGap

  // ③ Mood
  if (moodLines.length) {
    ctx.fillStyle = '#141210'
    ctx.font = `bold ${titleSize}px ${serif}`
    ctx.textAlign = 'left'
    for (const line of moodLines) {
      ctx.fillText(line, tx, cy + titleLH)
      cy += titleLH
    }
    cy += Math.round(H * 0.012)
  }

  // ④ Style tag
  if (a?.style) {
    ctx.fillStyle = pl.secondary || '#5a7a6a'
    ctx.font = `${Math.round(W * 0.022)}px ${sans}`
    ctx.textAlign = 'left'
    ctx.fillText(`# ${a.style}`, tx, cy + labelLH)
    cy += labelLH + smGap
  }

  // ⑤ Caption
  if (capLines.length) {
    ctx.fillStyle = '#5a5048'
    ctx.font = `${capSize}px ${serif}`
    ctx.textAlign = 'left'
    for (const line of capLines) {
      ctx.fillText(line, tx, cy + capLH)
      cy += capLH
    }
  }

  // ── Photo zone: below text, fills remaining height to mb ──
  const photoTop = mt + textBlockH + Math.round(H * 0.055)
  const photoZoneH = H - photoTop - mb
  const ar = p[0].aspectRatio

  let pw: number, ph: number
  if (ar > 1.15) {
    pw = Math.round(contentW * 0.92)
    ph = Math.round(pw / ar)
    if (ph > photoZoneH * 0.75) { ph = Math.round(photoZoneH * 0.75); pw = Math.round(ph * ar) }
  } else if (ar < 0.85) {
    ph = Math.round(photoZoneH * 0.78)
    pw = Math.round(ph * ar)
  } else {
    pw = Math.round(contentW * 0.75)
    ph = Math.round(pw / ar)
  }

  const px = ml + Math.round((contentW - pw) / 2)
  const py = photoTop + Math.round((photoZoneH - ph) * 0.25)

  const pos0 = positions[p[0].id] || { x: 50, y: 50, scale: 1 }
  const b = await drawCover(ctx, cutouts[p[0].id] || p[0].dataUrl, px, py, pw, ph, pos0.x, pos0.y, pos0.scale)
  bounds.push({ id: p[0].id, ...b })

  return bounds
}

// ═══════════════ POPEYE SIGNATURE — the synthesis of everything learned ═══════════════
// Pure 一文一图. Asymmetric margins. Massive bottom breathing room.
// Photo and text are equal partners, not master and servant.

async function drawPopeye(
  ctx: CanvasRenderingContext2D, p: JournalPhoto[], a: PhotoAnalysis | null,
  pl: ColorPalette, cutouts: Record<string, string>,
  positions: Record<string, { x: number; y: number; scale: number }>,
  W: number, H: number, _pad: number, _gap: number, serif: string, date: Date
): Promise<PhotoBounds[]> {
  const bounds: PhotoBounds[] = []
  if (!p[0]) return bounds

  const sans = "'Noto Sans SC', 'PingFang SC', sans-serif"

  // ── Asymmetric POPEYE margins ──
  const ml = Math.round(W * 0.085)   // left: 8.5%
  const mr = Math.round(W * 0.055)   // right: 5.5% — asymmetry is the point
  const mt = Math.round(H * 0.06)    // top: 6%
  const mb = Math.round(H * 0.18)    // bottom: 18% — the breathing room IS the design

  const contentW = W - ml - mr
  const photoZoneH = H - mt - mb

  // ── Photo: aspect-ratio aware sizing ──
  const ar = p[0].aspectRatio
  let pw: number, ph: number
  if (ar > 1.15) {
    // Landscape: full content width, shorter height
    pw = Math.round(contentW * 0.92)
    ph = Math.round(pw / ar)
    if (ph > photoZoneH * 0.6) { ph = Math.round(photoZoneH * 0.6); pw = Math.round(ph * ar) }
  } else if (ar < 0.85) {
    // Portrait: taller, slightly narrower
    ph = Math.round(photoZoneH * 0.65)
    pw = Math.round(ph * ar)
  } else {
    // Square-ish: balanced
    pw = Math.round(contentW * 0.7)
    ph = Math.round(pw / ar)
  }

  // Asymmetric placement: photo slightly to the left
  const px = ml + Math.round(contentW * 0.04)  // bias left
  const py = mt + Math.round((photoZoneH - ph) * 0.3) // upper portion

  const pos0 = positions[p[0].id] || { x: 50, y: 50, scale: 1 }
  const b = await drawCover(ctx, cutouts[p[0].id] || p[0].dataUrl, px, py, pw, ph, pos0.x, pos0.y, pos0.scale)
  bounds.push({ id: p[0].id, ...b })

  // ── Text zone: anchored from the BOTTOM so the breathing room survives ──
  const photoBottom = py + ph

  const tx = ml
  // Text block only uses 68% of content width — the right 32% is pure breathing
  const textMaxW = Math.round(contentW * 0.68)

  const labelSize = Math.round(W * 0.019)
  const titleSize = Math.round(W * 0.052)
  const capSize = Math.round(W * 0.024)
  const labelLH = Math.round(labelSize * 1.5)
  const titleLH = Math.round(titleSize * 1.15)
  const capLH = Math.round(capSize * 1.6)
  const smGap = Math.round(H * 0.01)
  const mdGap = Math.round(H * 0.028)
  const barW = Math.round(W * 0.04)
  const barH = Math.max(3, Math.round(H * 0.004))

  // Pre-measure wrapped lines so the block height is known BEFORE drawing
  ctx.font = `bold ${titleSize}px ${serif}`
  const moodLines = a?.mood ? wrapLines(ctx, a.mood, textMaxW) : []
  ctx.font = `${capSize}px ${serif}`
  let capLines = a?.caption
    ? nakiwakare(a.caption.split('\n')).slice(0, 2).flatMap(l => wrapLines(ctx, l, textMaxW))
    : []

  const blockHeight = () =>
    labelLH + Math.round(H * 0.006) +                                              // ① date
    barH + mdGap +                                                                 // ② accent bar
    (moodLines.length ? moodLines.length * titleLH + Math.round(H * 0.012) : 0) +  // ③ mood
    (a?.style ? labelLH + smGap : 0) +                                             // ④ style tag
    capLines.length * capLH                                                        // ⑤ caption

  const edge = Math.round(H * 0.06)    // hard bottom edge margin — never crossed
  // POPEYE 2026 structure: text hugs the photo, the big emptiness lives BELOW it
  let textStartY = photoBottom + Math.round(H * 0.06)
  // Overflow guard: sacrifice caption lines before crossing the bottom edge
  while (textStartY + blockHeight() > H - edge && capLines.length > 0) {
    capLines = capLines.slice(0, -1)
  }

  let cy = textStartY

  // ① Date — barely there, warm gray
  ctx.fillStyle = '#a0988c'
  ctx.font = `${labelSize}px ${sans}`
  ctx.textAlign = 'left'
  ctx.fillText(fmtDate(date), tx, cy + labelLH)
  cy += labelLH + Math.round(H * 0.006)

  // ② Accent bar — the POPEYE signature: thin, precise, meaningful
  ctx.fillStyle = pl.primary
  ctx.fillRect(tx, cy, barW, barH)
  cy += barH + mdGap

  // ③ Mood — the emotional anchor, never shrunk
  if (moodLines.length) {
    ctx.fillStyle = '#141210'
    ctx.font = `bold ${titleSize}px ${serif}`
    ctx.textAlign = 'left'
    for (const line of moodLines) {
      ctx.fillText(line, tx, cy + titleLH)
      cy += titleLH
    }
    cy += Math.round(H * 0.012)
  }

  // ④ Style tag — if no mood, becomes the star
  if (a?.style) {
    ctx.fillStyle = pl.secondary || '#5a7a6a'
    ctx.font = `${Math.round(W * 0.022)}px ${sans}`
    ctx.textAlign = 'left'
    ctx.fillText(`# ${a.style}`, tx, cy + labelLH)
    cy += labelLH + smGap
  }

  // ⑤ Caption — restrained, trimmed to whatever fits above the bottom margin
  if (capLines.length) {
    ctx.fillStyle = '#5a5048'
    ctx.font = `${capSize}px ${serif}`
    ctx.textAlign = 'left'
    for (const line of capLines) {
      ctx.fillText(line, tx, cy + capLH)
      cy += capLH
    }
  }

  return bounds
}

/** Wrap a single line of text to fit maxWidth, with 行頭禁則:
 *  an overflowing 。！？ hangs on the current line instead of starting the next */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  const enders = /[。！？.!?]/
  let current = ''
  for (const ch of text) {
    const test = current + ch
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      if (enders.test(ch)) {
        // ぶら下がり: punctuation may slightly overflow, never lead a line
        lines.push(test)
        current = ''
      } else {
        lines.push(current)
        current = ch
      }
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

// ═══════════════ HELPERS ═══════════════

async function drawCover(
  ctx: CanvasRenderingContext2D, src: string,
  x: number, y: number, w: number, h: number,
  offsetX: number = 50, offsetY: number = 50, scale: number = 1
): Promise<{ x: number; y: number; w: number; h: number }> {
  const img = await loadImg(src)
  const iw = img.width; const ih = img.height
  const ir = iw / ih; const br = w / h
  const s = Math.max(0.5, Math.min(3, scale ?? 1))

  let baseSw: number, baseSh: number
  if (ir > br) { baseSw = ih * br; baseSh = ih }
  else { baseSw = iw; baseSh = iw / br }

  let cropW = baseSw / s
  let cropH = baseSh / s

  // Clamp to image bounds while PRESERVING source crop aspect ratio.
  // Independent clamping would distort the image when drawn to destination.
  if (cropW > iw) { cropW = iw; cropH = cropW * (baseSh / baseSw) }
  if (cropH > ih) { cropH = ih; cropW = cropH * (baseSw / baseSh) }

  const sx = ((iw - cropW) * offsetX) / 100
  const sy = ((ih - cropH) * offsetY) / 100

  // Destination: s >= 1 = zoom in (fill the slot, tighter crop)
  //               s < 1  = zoom out (image shrinks in slot, shows more context)
  let dw: number, dh: number, dx: number, dy: number
  if (s >= 1) {
    dw = w; dh = h; dx = x; dy = y
  } else {
    const ratioW = cropW / baseSw
    const ratioH = cropH / baseSh
    const ratio = Math.min(ratioW, ratioH)
    dw = Math.round(w * ratio)
    dh = Math.round(h * ratio)
    dx = x + Math.round((w - dw) / 2)
    dy = y + Math.round((h - dh) / 2)
  }

  ctx.drawImage(img, sx, sy, cropW, cropH, dx, dy, dw, dh)
  return { x: dx, y: dy, w: dw, h: dh }
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', weekday:'short' })
}

/** 行頭禁則: a line must not START with sentence-ending punctuation —
 *  pull leading 。！？ back up to the previous line's end (ぶら下がり) */
function nakiwakare(lines: string[]): string[] {
  const leaders = /^[。！？.!?]+/
  const result = [...lines]
  for (let i = 1; i < result.length; i++) {
    const m = result[i].match(leaders)
    if (m) {
      result[i - 1] += m[0]
      result[i] = result[i].slice(m[0].length)
      if (result[i].length === 0) { result.splice(i, 1); i-- }
    }
  }
  return result
}

function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.strokeStyle = 'rgba(0,0,0,0.03)'; ctx.lineWidth = 1
  const gs = Math.round(W/40)
  for (let x=0;x<W;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  for (let y=0;y<H;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
}

// ── Seeded PRNG (mulberry32) ──
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function drawWashi(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // Deterministic seed from canvas size — preview === export, pixel-identical
  const rng = mulberry32(W * 7919 + H * 6271)
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.1})`
    ctx.fillRect(rng() * W, rng() * H, rng() * 40 + 2, 0.5)
  }
}
