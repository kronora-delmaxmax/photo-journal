<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useJournalStore } from '@/stores/journal'
import { extractColors } from '@/services/color'
import { analyzePhotos } from '@/services/ai'
import { generateCutout, preloadModel, applyStroke, compositeStrokeOnOriginal } from '@/services/imageProcessing'
import InteractiveCanvas from '@/components/InteractiveCanvas.vue'
import { EXPORT_PRESETS, TEMPLATES, PAPERS } from '@/config/workspace'

const app = useAppStore()
const store = useJournalStore()
const isProcessing = ref(false)
const progressMsg = ref('')
const cutouts = reactive<Record<string, string>>({})
const strokedCutouts = reactive<Record<string, string>>({})
const strokedOriginals = reactive<Record<string, string>>({})
const selectedPaper = ref('washi')
const strokeEnabled = ref(false)
const strokeColor = ref('#2c2420')
const strokeLevel = ref(2)
const strokePx = ref(0)
const isExporting = ref(false)
const workspaceCanvasRef = ref<InstanceType<typeof InteractiveCanvas> | null>(null)
const exportFormat = ref<'xiaohongshu'|'instagram'|'story'>(store.exportFormat as any || 'xiaohongshu')

const isCutoutTemplate = computed(() =>
  store.selectedTemplate === 'magazine' || store.selectedTemplate === 'poetic'
)
const displayCutouts = computed(() => {
  if (isCutoutTemplate.value) {
    if (strokeEnabled.value) return { ...cutouts, ...strokedCutouts }
    return cutouts
  }
  if (strokeEnabled.value) return strokedOriginals
  return {}
})

const workspaceSize = computed(() => {
  const preset = EXPORT_PRESETS[exportFormat.value]
  if (!preset) return { width: 1080, height: 1440 }
  return { width: preset.width, height: preset.height }
})

onMounted(() => {
  if (!store.hasPhotos) app.navigate('home')
})

async function startAnalysis() {
  if (store.photos.length === 0) return
  isProcessing.value = true
  try {
    progressMsg.value = '正在加载 AI 模型...'
    await preloadModel()
    for (let i = 0; i < store.photos.length; i++) {
      progressMsg.value = `正在识别主体并裁切 (${i + 1}/${store.photos.length})...`
      const result = await generateCutout(store.photos[i].dataUrl)
      cutouts[store.photos[i].id] = result.cutoutUrl
    }
    progressMsg.value = '正在提取色彩...'
    const palette = await extractColors(store.photos[0].dataUrl)
    store.setPalette(palette)
    progressMsg.value = '正在识别照片内容...'
    const analysis = await analyzePhotos(store.photos)
    store.setAnalysis(analysis)
    progressMsg.value = ''
    isProcessing.value = false
  } catch (err) {
    console.error('Analysis failed:', err)
    progressMsg.value = ''
    isProcessing.value = false
  }
}

async function toggleStroke() {
  strokeEnabled.value = !strokeEnabled.value
  if (strokeEnabled.value) {
    for (const [id, url] of Object.entries(cutouts)) {
      const r1 = await applyStroke(url, strokeColor.value, strokeLevel.value)
      strokedCutouts[id] = r1.url
      strokePx.value = r1.pixelWidth
      const photo = store.photos.find(p => p.id === id)
      if (photo) {
        const r2 = await compositeStrokeOnOriginal(photo.dataUrl, url, strokeColor.value, strokeLevel.value)
        strokedOriginals[id] = r2.url
      }
    }
  }
}

function clearStrokeCache() {
  Object.keys(strokedCutouts).forEach(k => delete strokedCutouts[k])
  Object.keys(strokedOriginals).forEach(k => delete strokedOriginals[k])
}

async function copyCaption() {
  if (store.analysis?.caption) {
    await navigator.clipboard.writeText(store.analysis.caption)
    alert('配文已复制')
  }
}

async function exportImage() {
  const canvas = workspaceCanvasRef.value?.getCanvas()
  if (!canvas) return
  isExporting.value = true
  try {
    const preset = EXPORT_PRESETS[exportFormat.value]
    const link = document.createElement('a')
    link.download = `手帖_${preset.label}_${new Date().toISOString().slice(0,10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    store.saveToHistory()
  } catch (err) {
    console.error('Export failed:', err)
  } finally {
    isExporting.value = false
  }
}

function goBack() {
  store.clearPhotos()
  app.navigate('home')
}
</script>

<template>
  <div class="editor">
    <header class="editor-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12 4L6 10L12 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="header-title serif">编辑手帖</div>
      <div class="header-spacer"></div>
    </header>

    <div class="photo-strip">
      <div v-for="photo in store.photos" :key="photo.id" class="strip-thumb">
        <img :src="photo.dataUrl" alt="" />
      </div>
    </div>

    <section class="editor-main">
      <template v-if="!store.analysis && !isProcessing">
        <div class="analysis-prompt">
          <div class="ap-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1"/>
              <circle cx="18" cy="20" r="3" fill="currentColor" opacity="0.3"/>
              <circle cx="30" cy="20" r="3" fill="currentColor" opacity="0.3"/>
              <path d="M16 30c2-3 5-5 8-5s6 2 8 5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="ap-title serif">AI 正在分析你的照片</p>
          <p class="ap-desc">识别照片内容、情绪氛围、推荐风格，<br/>自动生成手帐排版和配文。</p>
          <button class="btn-analyze" @click="startAnalysis">开始分析</button>
        </div>
      </template>

      <template v-else-if="isProcessing">
        <div class="processing">
          <div class="processing-spinner"></div>
          <p class="processing-msg serif">{{ progressMsg || '处理中...' }}</p>
        </div>
      </template>

      <template v-else>
        <div class="analysis-result">
          <div class="color-row">
            <div class="color-chip" v-for="(color, key) in store.palette" :key="key"
              :style="{ background: color }" :title="key"></div>
          </div>
          <div class="result-block editable-block" v-if="store.analysis">
            <div class="result-label">内容</div>
            <textarea v-model="store.analysis.content" class="edit-textarea" rows="2"></textarea>
          </div>
          <div class="result-block caption-block" v-if="store.analysis?.caption">
            <div class="result-label">AI 配文 · 点击复制</div>
            <p class="caption-text serif" @click="copyCaption">{{ store.analysis.caption }}</p>
          </div>
        </div>
      </template>
    </section>

    <div class="preview-section" v-if="store.analysis">
      <div class="format-tabs">
        <button v-for="(p, key) in EXPORT_PRESETS" :key="key"
          class="format-tab" :class="{ active: exportFormat === key }"
          @click="exportFormat = key as any">
          {{ p.label }} <span class="format-dim">{{ p.desc }}</span>
        </button>
      </div>

      <div class="template-tabs">
        <button v-for="tpl in TEMPLATES" :key="tpl.id"
          class="tpl-tab"
          :class="{ active: store.selectedTemplate === tpl.id, overflow: store.photoCount > tpl.maxPhotos }"
          @click="store.setTemplate(tpl.id)"
          :title="store.photoCount > tpl.maxPhotos ? `当前${store.photoCount}张，该模板最多显示${tpl.maxPhotos}张` : `最多${tpl.maxPhotos}张`">
          {{ tpl.label }}
          <span class="tpl-count">{{ tpl.maxPhotos }}</span>
          <span v-if="store.photoCount > tpl.maxPhotos" class="tpl-warn">!</span>
        </button>
      </div>

      <div class="paper-picker">
        <span class="paper-label">纸张</span>
        <div class="paper-chips">
          <button v-for="(p, key) in PAPERS" :key="key"
            class="paper-chip" :class="{ active: selectedPaper === key }"
            :style="{ background: p.color }" @click="selectedPaper = key" :title="p.label"></button>
        </div>
      </div>

      <div class="stroke-controls">
        <button class="stroke-toggle" :class="{ active: strokeEnabled }" @click="toggleStroke">描边</button>
        <template v-if="strokeEnabled">
          <input type="color" v-model="strokeColor" class="stroke-color"
            @change="clearStrokeCache(); strokeEnabled = false; toggleStroke()" />
          <select v-model.number="strokeLevel" class="stroke-width"
            @change="clearStrokeCache(); strokeEnabled = false; toggleStroke()">
            <option :value="1">细</option>
            <option :value="2">中</option>
            <option :value="3">粗</option>
            <option :value="4">超粗</option>
          </select>
          <span class="stroke-info" v-if="strokePx">{{ strokePx }}px</span>
        </template>
      </div>

      <div class="preview-container">
        <InteractiveCanvas
          ref="workspaceCanvasRef"
          :photos="store.photos"
          :analysis="store.analysis"
          :palette="store.palette"
          :template-id="store.selectedTemplate"
          :paper-bg="selectedPaper"
          :cutouts="displayCutouts"
          :photo-positions="store.photoPositions"
          :workspace-width="workspaceSize.width"
          :workspace-height="workspaceSize.height"
          :stroke-enabled="strokeEnabled"
          :stroke-color="strokeColor"
          @update-position="(id, x, y, scale) => store.setPhotoPosition(id, x, y, scale)"
        />
      </div>

      <div class="export-section">
        <button class="btn-export" @click="exportImage" :disabled="isExporting">
          {{ isExporting ? '导出中...' : '导出并下载' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor { width: 100%; max-width: 480px; margin: 0 auto; min-height: 100vh; min-height: 100dvh; overflow-x: hidden; display: flex; flex-direction: column; }
.editor-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-md) var(--space-lg); border-bottom: 1px solid var(--border-hairline); background: rgba(255,255,255,0.3); backdrop-filter: blur(8px); position: sticky; top: 0; z-index: 10; }
.back-btn { padding: 4px; color: var(--text-main); border-radius: 4px; transition: background 0.2s; background: none; border: none; cursor: pointer; }
.header-title { font-size: 15px; color: var(--text-main); letter-spacing: 0.1em; }
.header-spacer { width: 28px; }
.photo-strip { display: flex; gap: 4px; padding: var(--space-sm) var(--space-lg); overflow-x: auto; -webkit-overflow-scrolling: touch; }
.photo-strip::-webkit-scrollbar { display: none; }
.strip-thumb { width: 56px; height: 56px; border-radius: 2px; overflow: hidden; flex-shrink: 0; }
.strip-thumb img { width: 100%; height: 100%; object-fit: cover; }
.editor-main { flex: 1; padding: var(--space-lg); }
.analysis-prompt { text-align: center; padding: var(--space-2xl) 0; }
.ap-icon { color: var(--text-muted); margin-bottom: var(--space-md); opacity: 0.5; }
.ap-title { font-size: 18px; color: var(--text-main); letter-spacing: 0.08em; margin-bottom: var(--space-sm); }
.ap-desc { font-size: 12px; color: var(--text-muted); line-height: 1.8; margin-bottom: var(--space-xl); }
.btn-analyze { padding: 12px 32px; background: var(--text-main); color: var(--bg-cream); font-family: var(--font-serif); font-size: 14px; letter-spacing: 0.1em; border-radius: 2px; border: none; cursor: pointer; transition: all 0.3s; }
.processing { display: flex; flex-direction: column; align-items: center; gap: var(--space-lg); padding: var(--space-3xl) 0; }
.processing-spinner { width: 32px; height: 32px; border: 2px solid var(--border-warm); border-top-color: var(--text-main); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.processing-msg { font-size: 14px; color: var(--text-muted); letter-spacing: 0.08em; }
.analysis-result { display: flex; flex-direction: column; gap: var(--space-md); }
.color-row { display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm); }
.color-chip { width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: var(--shadow-paper); }
.result-block { padding: var(--space-md); background: rgba(255,255,255,0.5); border-radius: 2px; border-left: 2px solid var(--border-accent); }
.result-label { font-size: 10px; color: var(--text-light); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
.caption-block { border-left-color: var(--aka-vermilion); background: rgba(196,77,52,0.04); }
.caption-text { font-size: 15px; color: var(--text-main); line-height: 2; letter-spacing: 0.05em; white-space: pre-line; cursor: pointer; user-select: text; }
.edit-textarea { width: 100%; border: none; background: transparent; font-family: var(--font-sans); font-size: 13px; color: var(--text-body); line-height: 1.8; resize: vertical; outline: none; padding: 2px 0; }
.preview-section { padding: var(--space-sm) var(--space-lg) var(--space-xl); }
.format-tabs { display: flex; gap: 4px; overflow-x: auto; padding: var(--space-sm) 0 2px; -webkit-overflow-scrolling: touch; }
.format-tabs::-webkit-scrollbar { display: none; }
.format-tab { flex-shrink: 0; padding: 6px 12px; font-size: 11px; color: var(--text-muted); border: 2px solid var(--border-hairline); border-radius: 4px; letter-spacing: 0.05em; font-family: var(--font-serif); transition: all 0.2s; white-space: nowrap; background: transparent; cursor: pointer; }
.format-tab.active { border-color: var(--text-main); background: var(--text-main); color: var(--bg-cream); }
.format-dim { font-size: 9px; opacity: 0.7; margin-left: 2px; }
.template-tabs { display: flex; flex-wrap: wrap; gap: 3px; padding: var(--space-sm) 0; }
.template-tabs::-webkit-scrollbar { display: none; }
.tpl-tab { padding: 4px 7px; font-size: 9px; color: var(--text-muted); border: 1px solid var(--border-hairline); border-radius: 2px; letter-spacing: 0.03em; font-family: var(--font-serif); transition: all 0.2s; white-space: nowrap; background: transparent; cursor: pointer; }
.tpl-tab.active { background: var(--text-main); color: var(--bg-cream); border-color: var(--text-main); }
.tpl-count { display: inline-block; margin-left: 1px; font-size: 8px; opacity: 0.5; min-width: 10px; text-align: center; }
.tpl-tab.overflow { border-color: var(--aka-vermilion); }
.tpl-tab.overflow .tpl-warn { display: inline-block; margin-left: 1px; font-size: 8px; color: var(--aka-vermilion); font-weight: 700; }
.paper-picker { display: flex; align-items: center; gap: var(--space-sm); padding: 4px 0; }
.paper-label { font-size: 10px; color: var(--text-light); letter-spacing: 0.05em; flex-shrink: 0; }
.paper-chips { display: flex; gap: 6px; }
.paper-chip { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.paper-chip.active { border-color: var(--text-main); transform: scale(1.15); }
.stroke-controls { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.stroke-toggle { padding: 5px 14px; font-size: 11px; color: var(--text-muted); border: 1px solid var(--border-hairline); border-radius: 2px; font-family: var(--font-serif); letter-spacing: 0.05em; transition: all 0.2s; background: transparent; cursor: pointer; }
.stroke-toggle.active { background: var(--text-main); color: var(--bg-cream); border-color: var(--text-main); }
.stroke-info { font-size: 10px; color: var(--text-light); letter-spacing: 0.05em; }
.stroke-color { width: 28px; height: 28px; border: 2px solid var(--border-warm); border-radius: 50%; cursor: pointer; padding: 0; }
.stroke-color::-webkit-color-swatch-wrapper { padding: 0; }
.stroke-color::-webkit-color-swatch { border: none; border-radius: 50%; }
.stroke-width { padding: 4px 6px; font-size: 11px; border: 1px solid var(--border-hairline); border-radius: 2px; background: transparent; color: var(--text-muted); font-family: var(--font-serif); cursor: pointer; }
.preview-container { margin: var(--space-md) 0; }
.export-section { padding: var(--space-md) 0 var(--space-xl); }
.btn-export { padding: 10px 28px; background: var(--text-main); color: var(--bg-cream); font-family: var(--font-serif); font-size: 13px; letter-spacing: 0.08em; border-radius: 2px; border: none; cursor: pointer; transition: all 0.2s; }
.btn-export:disabled { opacity: 0.5; pointer-events: none; }
</style>
