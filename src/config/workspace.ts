// ═══════════════ WORKSPACE CONFIG — single source of truth ═══════════════
// All dimensions, presets, templates, and paper definitions live here.
// No other file hardcodes these values.

export interface ExportPreset {
  id: 'xiaohongshu' | 'instagram' | 'story'
  label: string
  desc: string
  width: number
  height: number
  ratio: number
}

export const EXPORT_PRESETS: Record<string, ExportPreset> = {
  xiaohongshu: { id: 'xiaohongshu', label: '小红书', desc: '1080×1440', width: 1080, height: 1440, ratio: 3/4 },
  instagram:   { id: 'instagram',   label: 'Instagram', desc: '1080×1080', width: 1080, height: 1080, ratio: 1 },
  story:       { id: 'story',       label: '故事/竖版', desc: '1080×1920', width: 1080, height: 1920, ratio: 9/16 },
}

export const TEMPLATES = [
  { id: 'magazine', label: '杂志封面', maxPhotos: 4 },
  { id: 'grid', label: '干净网格', maxPhotos: 4 },
  { id: 'poetic', label: '诗意留白', maxPhotos: 3 },
  { id: 'collage', label: '拼贴手帐', maxPhotos: 5 },
  { id: 'diary', label: '拍立得日记', maxPhotos: 3 },
  { id: 'minimal', label: '极简', maxPhotos: 1 },
  { id: 'editorial', label: '杂志报道', maxPhotos: 3 },
  { id: 'bleed', label: '满版', maxPhotos: 1 },
  { id: 'popeye', label: 'POPEYE', maxPhotos: 1 },
] as const

export const PAPERS: Record<string, { label: string; color: string }> = {
  washi: { label: '和纸', color: '#f5f0e6' },
  cream: { label: '奶油', color: '#faf6f0' },
  plain: { label: '纯白', color: '#ffffff' },
  grid:  { label: '网格', color: '#fafaf8' },
  kraft: { label: '牛皮纸', color: '#c8b898' },
}

/** Compute workspace dimensions for a given format */
export function getWorkspaceSize(formatId: string): { width: number; height: number } {
  const preset = EXPORT_PRESETS[formatId]
  if (!preset) return { width: 1080, height: 1440 } // fallback
  return { width: preset.width, height: preset.height }
}
