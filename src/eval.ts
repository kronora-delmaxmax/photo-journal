// ═══════════════ EVAL HARNESS — render templates with mock data ═══════════════
// Usage: /eval.html?tpl=magazine          → renders canvas for screenshot
//        /eval.html?tpl=magazine&mode=json → dumps photo bounds as JSON in DOM
// Deterministic: no randomness, so renders are reproducible.

import { renderWorkspace } from '@/services/workspaceRenderer'
import { TEMPLATES, getWorkspaceSize } from '@/config/workspace'
import type { JournalPhoto, PhotoAnalysis, ColorPalette } from '@/stores/journal'

function makePhoto(id: string, w: number, h: number, hueA: string, hueB: string): JournalPhoto {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, hueA); g.addColorStop(1, hueB)
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  // deterministic "subject" shapes so the photo isn't flat
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath(); ctx.arc(w * 0.62, h * 0.4, Math.min(w, h) * 0.22, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(40,40,50,0.45)'
  ctx.fillRect(w * 0.12, h * 0.62, w * 0.4, h * 0.25)
  return { id, dataUrl: c.toDataURL('image/png'), width: w, height: h, aspectRatio: w / h }
}

const PHOTOS: JournalPhoto[] = [
  makePhoto('p1', 900, 600, '#7a94a8', '#c4a882'),  // landscape 1.5
  makePhoto('p2', 600, 800, '#a88a7a', '#8aa89a'),  // portrait 0.75
  makePhoto('p3', 700, 700, '#94a87a', '#a87a94'),  // square 1
  makePhoto('p4', 800, 600, '#8a7aa8', '#a8a07a'),  // landscape 1.33
  makePhoto('p5', 600, 900, '#7aa8a0', '#a8887a'),  // portrait 0.67
]

const ANALYSIS: PhotoAnalysis = {
  content: '下午四点的海边，光线开始变软。沙滩上几乎没有人。我们坐了很久，看浪一遍遍把脚印抹平。',
  mood: '海边的下午',
  style: '胶片散步',
  caption: '风把云吹散了。剩下的都是慢慢的时间。',
  tags: ['海', '散步'],
  dateContext: '夏',
}

const PALETTE: ColorPalette = {
  primary: '#c44d34',
  secondary: '#4a7c8c',
  accent: '#c8a84e',
  background: '#faf8f5',
  text: '#2c2420',
}

async function main() {
  const params = new URLSearchParams(location.search)
  const tplId = params.get('tpl') || 'magazine'
  const mode = params.get('mode') || 'shot'
  const tpl = TEMPLATES.find(t => t.id === tplId)
  if (!tpl) { document.body.textContent = 'unknown tpl: ' + tplId; return }

  const { width, height } = getWorkspaceSize('xiaohongshu')
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  canvas.style.cssText = `display:block;width:${width}px;height:${height}px`
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const photos = PHOTOS.slice(0, tpl.maxPhotos)
  const bounds = await renderWorkspace(ctx, {
    photos, cutouts: {}, analysis: ANALYSIS, palette: PALETTE,
    templateId: tplId, paperBg: 'cream', width, height, positions: {},
  })

  if (mode === 'json') {
    const pre = document.createElement('pre')
    pre.id = 'bounds'
    pre.textContent = JSON.stringify({ tpl: tplId, W: width, H: height, bounds })
    document.body.replaceChildren(pre)
  }
  document.title = 'EVAL_DONE'
}

main()
