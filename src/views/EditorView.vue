<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useJournalStore } from '@/stores/journal'
import { extractColors } from '@/services/color'
import { analyzePhotos } from '@/services/ai'
import { generateCutout, preloadModel, applyStroke } from '@/services/imageProcessing'
import JournalPage from '@/components/JournalPage.vue'

const router = useRouter()
const store = useJournalStore()
const isProcessing = ref(false)
const progressMsg = ref('')
const cutouts = reactive<Record<string, string>>({})
const strokedCutouts = reactive<Record<string, string>>({})
const selectedPaper = ref('washi')
const strokeEnabled = ref(false)
const strokeColor = ref('#2c2420')
const strokeLevel = ref(2)  // 1=thin, 2=medium, 3=thick
const strokePx = ref(0)

// Display cutouts: with or without stroke
const displayCutouts = computed(() => strokeEnabled.value ? { ...cutouts, ...strokedCutouts } : cutouts)

// Redirect if no photos
if (!store.hasPhotos) {
  router.replace('/')
}

async function startAnalysis() {
  if (store.photos.length === 0) return
  isProcessing.value = true

  try {
    // Step 0: Preload AI model (download ~10MB ONNX model, first time only)
    progressMsg.value = '正在加载 AI 模型...'
    await preloadModel()

    // Step 1: AI subject segmentation & cutout for each photo
    for (let i = 0; i < Math.min(store.photos.length, 3); i++) {
      progressMsg.value = `正在识别主体并裁切 (${i + 1}/${Math.min(store.photos.length, 3)})...`
      const result = await generateCutout(store.photos[i].dataUrl)
      cutouts[store.photos[i].id] = result.cutoutUrl
    }

    // Step 2: Extract colors
    progressMsg.value = '正在提取色彩...'
    const palette = await extractColors(store.photos[0].dataUrl)
    store.setPalette(palette)

    // Step 3: AI analysis
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

const templates = [
  { id: 'magazine', label: '杂志封面' },
  { id: 'grid', label: '干净网格' },
  { id: 'poetic', label: '诗意留白' },
  { id: 'collage', label: '拼贴手帐' },
  { id: 'diary', label: '拍立得日记' },
]

const papers = [
  { id: 'washi', label: '和纸', color: '#f5f0e6' },
  { id: 'cream', label: '奶油', color: '#faf6f0' },
  { id: 'plain', label: '纯白', color: '#ffffff' },
  { id: 'grid', label: '网格', color: '#fafaf8' },
  { id: 'kraft', label: '牛皮纸', color: '#c8b898' },
]

async function toggleStroke() {
  strokeEnabled.value = !strokeEnabled.value
  if (strokeEnabled.value) {
    // Generate stroked versions
    for (const [id, url] of Object.entries(cutouts)) {
      if (!strokedCutouts[id]) {
        const result = await applyStroke(url, strokeColor.value, strokeLevel.value)
        strokedCutouts[id] = result.url
        strokePx.value = result.pixelWidth
      }
    }
  }
}

function saveJournal() {
  store.saveToHistory()
  setMsg('已保存到历史')
}

function goBack() {
  store.clearPhotos()
  router.push('/')
}
</script>

<template>
  <div class="editor">
    <!-- Header -->
    <header class="editor-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12 4L6 10L12 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="header-title serif">编辑手帖</div>
      <div class="header-spacer"></div>
    </header>

    <!-- Photo Preview Strip -->
    <div class="photo-strip">
      <div
        v-for="photo in store.photos"
        :key="photo.id"
        class="strip-thumb"
      >
        <img :src="photo.dataUrl" alt="" />
      </div>
    </div>

    <!-- Analysis Action -->
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
          <button class="btn-analyze" @click="startAnalysis">
            开始分析
          </button>
        </div>
      </template>

      <template v-else-if="isProcessing">
        <div class="processing">
          <div class="processing-spinner"></div>
          <p class="processing-msg serif">{{ progressMsg || '处理中...' }}</p>
        </div>
      </template>

      <template v-else>
        <!-- Analysis Result -->
        <div class="analysis-result">
          <!-- Color chips -->
          <div class="color-row">
            <div
              class="color-chip"
              v-for="(color, key) in store.palette"
              :key="key"
              :style="{ background: color }"
              :title="key"
            ></div>
          </div>

          <!-- Content -->
          <div class="result-block editable-block" v-if="store.analysis">
            <div class="result-label">内容</div>
            <textarea
              v-model="store.analysis.content"
              class="edit-textarea"
              rows="2"
            ></textarea>
          </div>

          <div class="result-block caption-block editable-block" v-if="store.analysis">
            <div class="result-label">配文</div>
            <textarea
              v-model="store.analysis.caption"
              class="edit-textarea serif caption-area"
              rows="3"
            ></textarea>
          </div>
        </div>
      </template>
    </section>

    <!-- Journal Preview -->
    <div class="preview-section" v-if="store.analysis">
      <!-- Template Picker -->
      <div class="template-tabs">
        <button
          v-for="tpl in templates"
          :key="tpl.id"
          class="tpl-tab"
          :class="{ active: store.selectedTemplate === tpl.id }"
          @click="store.setTemplate(tpl.id)"
        >
          {{ tpl.label }}
        </button>
      </div>

      <!-- Paper Background Picker -->
      <div class="paper-picker">
        <span class="paper-label">纸张</span>
        <div class="paper-chips">
          <button
            v-for="p in papers"
            :key="p.id"
            class="paper-chip"
            :class="{ active: selectedPaper === p.id }"
            :style="{ background: p.color }"
            @click="selectedPaper = p.id"
            :title="p.label"
          ></button>
        </div>
      </div>

      <!-- Stroke Controls -->
      <div class="stroke-controls">
        <button
          class="stroke-toggle"
          :class="{ active: strokeEnabled }"
          @click="toggleStroke"
        >
          描边
        </button>
        <template v-if="strokeEnabled">
          <input
            type="color"
            v-model="strokeColor"
            class="stroke-color"
            @change="Object.keys(strokedCutouts).forEach(k => delete strokedCutouts[k]); strokeEnabled = false; toggleStroke()"
          />
          <select v-model.number="strokeLevel" class="stroke-width" @change="Object.keys(strokedCutouts).forEach(k => delete strokedCutouts[k]); strokeEnabled = false; toggleStroke()">
            <option :value="1">细</option>
            <option :value="2">中</option>
            <option :value="3">粗</option>
            <option :value="4">超粗</option>
          </select>
          <span class="stroke-info" v-if="strokePx">{{ strokePx }}px</span>
        </template>
      </div>

      <!-- Journal Page -->
      <div class="preview-container">
        <JournalPage
          :photos="store.photos"
          :analysis="store.analysis"
          :palette="store.palette"
          :template-id="store.selectedTemplate"
          :paper-bg="selectedPaper"
          :cutouts="displayCutouts"
        />
      </div>

      <!-- Export button -->
      <div class="preview-actions">
        <button class="btn-export" @click="saveJournal">
          保存手帖
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

/* ── Header ── */
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-hairline);
  background: rgba(255,255,255,0.3);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.back-btn {
  padding: 4px;
  color: var(--text-main);
  border-radius: 4px;
  transition: background 0.2s;
}
.back-btn:hover { background: rgba(0,0,0,0.04); }

.header-title {
  font-size: 15px;
  color: var(--text-main);
  letter-spacing: 0.1em;
}

.header-spacer { width: 28px; }

/* ── Photo Strip ── */
.photo-strip {
  display: flex;
  gap: 4px;
  padding: var(--space-sm) var(--space-lg);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.photo-strip::-webkit-scrollbar { display: none; }

.strip-thumb {
  width: 56px;
  height: 56px;
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}

.strip-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── Main ── */
.editor-main {
  flex: 1;
  padding: var(--space-lg);
}

/* ── Analysis Prompt ── */
.analysis-prompt {
  text-align: center;
  padding: var(--space-2xl) 0;
}

.ap-icon {
  color: var(--text-muted);
  margin-bottom: var(--space-md);
  opacity: 0.5;
}

.ap-title {
  font-size: 18px;
  color: var(--text-main);
  letter-spacing: 0.08em;
  margin-bottom: var(--space-sm);
}

.ap-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.8;
  margin-bottom: var(--space-xl);
}

.btn-analyze {
  padding: 12px 32px;
  background: var(--text-main);
  color: var(--bg-cream);
  font-family: var(--font-serif);
  font-size: 14px;
  letter-spacing: 0.1em;
  border-radius: 2px;
  transition: all 0.3s var(--ease-out-expo);
}

.btn-analyze:hover {
  background: var(--sumi-ink);
  box-shadow: var(--shadow-float);
}

/* ── Processing ── */
.processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-3xl) 0;
}

.processing-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border-warm);
  border-top-color: var(--text-main);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.processing-msg {
  font-size: 14px;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}

/* ── Analysis Result ── */
.analysis-result {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.color-row {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.color-chip {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: var(--shadow-paper);
}

.result-block {
  padding: var(--space-md);
  background: rgba(255,255,255,0.5);
  border-radius: 2px;
  border-left: 2px solid var(--border-accent);
}

.result-label {
  font-size: 10px;
  color: var(--text-light);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.result-text {
  font-size: 13px;
  color: var(--text-body);
  line-height: 1.7;
}

.caption-block {
  border-left-color: var(--aka-vermilion);
  background: rgba(196,77,52,0.04);
}

.caption-text {
  font-size: 15px;
  color: var(--text-main);
  line-height: 2;
  letter-spacing: 0.05em;
}

/* ── Editable textareas ── */
.editable-block {
  position: relative;
}

.edit-textarea {
  width: 100%;
  border: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--text-body);
  line-height: 1.8;
  resize: vertical;
  outline: none;
  padding: 2px 0;
}

.edit-textarea:focus {
  background: rgba(255,255,255,0.5);
  padding: 6px;
  border-radius: 2px;
}

.caption-area {
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--text-main);
  line-height: 2;
  letter-spacing: 0.05em;
}

/* ── Preview Section ── */
.preview-section {
  padding: var(--space-sm) var(--space-lg) var(--space-xl);
}

.template-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: var(--space-sm) 0;
  -webkit-overflow-scrolling: touch;
}

.template-tabs::-webkit-scrollbar { display: none; }

.tpl-tab {
  flex-shrink: 0;
  padding: 6px 14px;
  font-size: 11px;
  color: var(--text-muted);
  border: 1px solid var(--border-hairline);
  border-radius: 2px;
  letter-spacing: 0.05em;
  font-family: var(--font-serif);
  transition: all 0.2s;
  white-space: nowrap;
}

.tpl-tab.active {
  background: var(--text-main);
  color: var(--bg-cream);
  border-color: var(--text-main);
}

.tpl-tab:active { background: var(--text-main); color: var(--bg-cream); }

/* ── Paper Picker ── */
.paper-picker {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 4px 0;
}

.paper-label {
  font-size: 10px;
  color: var(--text-light);
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.paper-chips {
  display: flex;
  gap: 6px;
}

.paper-chip {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

.paper-chip.active {
  border-color: var(--text-main);
  transform: scale(1.15);
}

.paper-chip:hover {
  transform: scale(1.1);
}

/* ── Stroke Controls ── */
.stroke-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.stroke-toggle {
  padding: 5px 14px;
  font-size: 11px;
  color: var(--text-muted);
  border: 1px solid var(--border-hairline);
  border-radius: 2px;
  font-family: var(--font-serif);
  letter-spacing: 0.05em;
  transition: all 0.2s;
  background: transparent;
  cursor: pointer;
}

.stroke-toggle.active {
  background: var(--text-main);
  color: var(--bg-cream);
  border-color: var(--text-main);
}

.stroke-info {
  font-size: 10px;
  color: var(--text-light);
  letter-spacing: 0.05em;
}

.stroke-color {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border-warm);
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
}

.stroke-color::-webkit-color-swatch-wrapper { padding: 0; }
.stroke-color::-webkit-color-swatch { border: none; border-radius: 50%; }

.stroke-width {
  padding: 4px 6px;
  font-size: 11px;
  border: 1px solid var(--border-hairline);
  border-radius: 2px;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-serif);
  cursor: pointer;
}

.preview-container {
  margin: var(--space-md) 0;
}

.preview-actions {
  text-align: center;
  padding: var(--space-md) 0;
}

.btn-export {
  padding: 10px 28px;
  background: var(--text-main);
  color: var(--bg-cream);
  font-family: var(--font-serif);
  font-size: 13px;
  letter-spacing: 0.08em;
  border-radius: 2px;
  transition: all 0.2s;
}

.btn-export:hover {
  background: var(--sumi-ink);
  box-shadow: var(--shadow-float);
}

.canvas-container { display: none; }
</style>
