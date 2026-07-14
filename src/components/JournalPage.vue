<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { JournalPhoto, PhotoAnalysis, ColorPalette } from '@/stores/journal'

const props = defineProps<{
  photos: JournalPhoto[]
  analysis: PhotoAnalysis | null
  palette: ColorPalette
  templateId: string
  paperBg: string
  cutouts: Record<string, string>
  strokeEnabled?: boolean
  strokeColor?: string
}>()

const dateStr = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', weekday:'short' })
})

// ── Photo drag/pan ──
const positions = reactive<Record<string, { x: number; y: number }>>({})
let dragging: { id: string; startX: number; startY: number; origX: number; origY: number; elW: number; elH: number } | null = null

function getPos(photoId: string) {
  if (!positions[photoId]) positions[photoId] = { x: 50, y: 50 }
  return positions[photoId]
}

function onDragStart(e: MouseEvent | TouchEvent, photoId: string) {
  e.preventDefault()
  const pos = getPos(photoId)
  const pt = 'touches' in e ? e.touches[0] : e
  const el = (e.currentTarget as HTMLElement)
  dragging = {
    id: photoId,
    startX: pt.clientX, startY: pt.clientY,
    origX: pos.x, origY: pos.y,
    elW: el.clientWidth, elH: el.clientHeight,
  }
}

function onDragMove(e: MouseEvent | TouchEvent) {
  if (!dragging) return
  const pt = 'touches' in e ? e.touches[0] : e
  const dx = pt.clientX - dragging.startX
  const dy = pt.clientY - dragging.startY
  const pos = getPos(dragging.id)
  // Convert pixel delta to % based on container size: 1:1 tracking
  const scaleX = dragging.elW > 0 ? (dx / dragging.elW) * 100 : 0
  const scaleY = dragging.elH > 0 ? (dy / dragging.elH) * 100 : 0
  pos.x = Math.max(0, Math.min(100, dragging.origX - scaleX))
  pos.y = Math.max(0, Math.min(100, dragging.origY - scaleY))
}

function onDragEnd() {
  dragging = null
}

// Map paper names to CSS background values
const paperColors: Record<string, string> = {
  washi: '#f5f0e6',
  kraft: '#c8b898',
  plain: '#ffffff',
  grid: '#fafaf8',
  cream: '#faf6f0',
}

const paperTextures: Record<string, string> = {
  washi: 'linear-gradient(90deg, rgba(0,0,0,0.01) 1px, transparent 1px)',
  kraft: 'none',
  plain: 'none',
  grid: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(0,0,0,0.03) 19px, rgba(0,0,0,0.03) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(0,0,0,0.03) 19px, rgba(0,0,0,0.03) 20px)',
  cream: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.3) 0%, transparent 70%)',
}

const bgColor = computed(() => paperColors[props.paperBg] || '#ffffff')
const bgTexture = computed(() => paperTextures[props.paperBg] || 'none')

const strokeCss = computed(() => {
  if (!props.strokeEnabled || !props.strokeColor) return {}
  return {
    outline: `3px solid ${props.strokeColor}`,
    outlineOffset: '-1px',
  }
})

function hasCutout(photoId: string): boolean {
  return !!props.cutouts[photoId]
}

function cutoutSrc(photo: JournalPhoto): string {
  return props.cutouts[photo.id] || photo.dataUrl
}

const randomRotate = (seed: number) => {
  const angles = [-2, -1, 0, 1, 2, -1.5, 1.5]
  return angles[seed % angles.length]
}
</script>

<template>
  <div class="journal-page" :class="{ 'has-stroke': strokeEnabled }"
    @mousemove="onDragMove" @touchmove.prevent="onDragMove"
    @mouseup="onDragEnd" @touchend="onDragEnd" @mouseleave="onDragEnd"
    :style="{
    '--jp-primary': palette.primary,
    '--jp-secondary': palette.secondary,
    '--jp-accent': palette.accent,
    '--jp-bg': bgColor,
    '--jp-texture': bgTexture,
    '--stroke-color': strokeColor || '#2c2420',
  }">

    <!-- ═══ TEMPLATE: Magazine Cover ═══ -->
    <div v-if="templateId === 'magazine'" class="tpl-magazine">
      <!-- Hero photo -->
      <div class="mag-hero" v-if="photos[0]">
        <img :src="cutoutSrc(photos[0])" alt="" draggable="false"
            :style="{ objectFit: 'cover', objectPosition: `${getPos(photos[0].id).x}% ${getPos(photos[0].id).y}%` }"
            :class="{ 'img-cutout': hasCutout(photos[0].id) }"
            @mousedown.prevent="onDragStart($event, photos[0].id)"
            @touchstart.prevent="onDragStart($event, photos[0].id)" />
        <div class="mag-hero-overlay">
          <div class="mag-date">{{ dateStr }}</div>
          <h2 class="mag-title serif" v-if="analysis">{{ analysis.mood }}</h2>
        </div>
      </div>
      <!-- Secondary photos -->
      <div class="mag-secondary" v-if="photos.length > 1">
        <div class="mag-sec-item" v-for="(photo, i) in photos.slice(1, 4)" :key="photo.id">
          <img :src="cutoutSrc(photo)" alt="" draggable="false"
            :style="{ objectFit: 'cover', objectPosition: `${getPos(photo.id).x}% ${getPos(photo.id).y}%` }"
            :class="{ 'img-cutout': hasCutout(photo.id) }"
            @mousedown.prevent="onDragStart($event, photo.id)"
            @touchstart.prevent="onDragStart($event, photo.id)" />
        </div>
      </div>
      <!-- Caption -->
      <div class="mag-caption serif" v-if="analysis?.caption">
        <div class="caption-line"></div>
        <p>{{ analysis.caption }}</p>
      </div>
    </div>

    <!-- ═══ TEMPLATE: Clean Grid ═══ -->
    <div v-else-if="templateId === 'grid'" class="tpl-grid">
      <div class="grid-header">
        <span class="grid-date serif">{{ dateStr }}</span>
        <span class="grid-tag" v-if="analysis">{{ analysis.style }}</span>
      </div>
      <div class="grid-photos" :class="'grid-count-' + Math.min(photos.length, 4)">
        <div class="grid-photo" v-for="photo in photos.slice(0, 4)" :key="photo.id">
          <img :src="cutoutSrc(photo)" alt="" draggable="false"
            :style="{ objectFit: 'cover', objectPosition: `${getPos(photo.id).x}% ${getPos(photo.id).y}%` }"
            :class="{ 'img-cutout': hasCutout(photo.id) }"
            @mousedown.prevent="onDragStart($event, photo.id)"
            @touchstart.prevent="onDragStart($event, photo.id)" />
        </div>
      </div>
      <div class="grid-text" v-if="analysis">
        <p class="grid-mood serif">{{ analysis.mood }}</p>
        <p class="grid-caption" v-if="analysis.caption">{{ analysis.caption }}</p>
        <div class="grid-tags" v-if="analysis.tags">
          <span class="tag-chip" v-for="tag in analysis.tags.slice(0, 3)" :key="tag">{{ tag }}</span>
        </div>
      </div>
    </div>

    <!-- ═══ TEMPLATE: Poetic ═══ -->
    <div v-else-if="templateId === 'poetic'" class="tpl-poetic">
      <div class="poem-photo" v-if="photos[0]">
        <img :src="cutoutSrc(photos[0])" alt="" draggable="false"
            :style="{ objectFit: 'cover', objectPosition: `${getPos(photos[0].id).x}% ${getPos(photos[0].id).y}%` }"
            :class="{ 'img-cutout': hasCutout(photos[0].id) }"
            @mousedown.prevent="onDragStart($event, photos[0].id)"
            @touchstart.prevent="onDragStart($event, photos[0].id)" />
      </div>
      <div class="poem-text" v-if="analysis">
        <div class="poem-date serif">{{ dateStr }}</div>
        <div class="poem-divider"></div>
        <p class="poem-caption serif">{{ analysis.caption }}</p>
        <p class="poem-meta">{{ analysis.content }}</p>
      </div>
      <div class="poem-thumbs" v-if="photos.length > 1">
        <div class="poem-thumb" v-for="photo in photos.slice(1, 3)" :key="photo.id">
          <img :src="cutoutSrc(photo)" alt="" draggable="false"
            :style="{ objectFit: 'cover', objectPosition: `${getPos(photo.id).x}% ${getPos(photo.id).y}%` }"
            :class="{ 'img-cutout': hasCutout(photo.id) }"
            @mousedown.prevent="onDragStart($event, photo.id)"
            @touchstart.prevent="onDragStart($event, photo.id)" />
        </div>
      </div>
    </div>

    <!-- ═══ TEMPLATE: Collage ═══ -->
    <div v-else-if="templateId === 'collage'" class="tpl-collage">
      <div class="collage-canvas">
        <div
          class="collage-item"
          v-for="(photo, i) in photos.slice(0, 5)"
          :key="photo.id"
          :style="{
            transform: `rotate(${randomRotate(i)}deg)`,
            zIndex: photos.length - i,
          }"
        >
          <img :src="cutoutSrc(photo)" alt="" draggable="false"
            :style="{ objectFit: 'cover', objectPosition: `${getPos(photo.id).x}% ${getPos(photo.id).y}%` }"
            :class="{ 'img-cutout': hasCutout(photo.id) }"
            @mousedown.prevent="onDragStart($event, photo.id)"
            @touchstart.prevent="onDragStart($event, photo.id)" />
          <!-- Tape mark -->
          <div class="tape" :style="{ background: i % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(200,180,150,0.5)' }"></div>
        </div>
      </div>
      <div class="collage-text" v-if="analysis">
        <p class="collage-caption serif">{{ analysis.caption }}</p>
        <p class="collage-date">{{ dateStr }}</p>
      </div>
    </div>

    <!-- ═══ TEMPLATE: Diary ═══ -->
    <div v-else class="tpl-diary">
      <div class="diary-header">
        <div class="diary-date serif">{{ dateStr }}</div>
        <div class="diary-weather">{{ analysis?.mood || '记录' }}</div>
      </div>
      <div class="diary-photos">
        <div
          class="diary-polaroid"
          v-for="(photo, i) in photos.slice(0, 3)"
          :key="photo.id"
          :style="{ transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)` }"
        >
          <div class="polaroid-img">
            <img :src="cutoutSrc(photo)" alt="" draggable="false"
            :style="{ objectFit: 'cover', objectPosition: `${getPos(photo.id).x}% ${getPos(photo.id).y}%` }"
            :class="{ 'img-cutout': hasCutout(photo.id) }"
            @mousedown.prevent="onDragStart($event, photo.id)"
            @touchstart.prevent="onDragStart($event, photo.id)" />
          </div>
          <div class="polaroid-caption serif" v-if="i === 0 && analysis">
            {{ analysis.caption?.split('\n')[0] || '' }}
          </div>
        </div>
      </div>
      <div class="diary-text" v-if="analysis">
        <p class="diary-content">{{ analysis.content }}</p>
        <div class="diary-tags">
          <span class="tag-dot" v-for="tag in analysis.tags?.slice(0, 4)" :key="tag">#{{ tag }}</span>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.journal-page {
  width: 100%;
  background-color: var(--jp-bg, white);
  background-image: var(--jp-texture, none);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  position: relative;
  /* Paper edge effect */
  border: 1px solid rgba(0,0,0,0.04);
}

/* Cutout photo effect — floating, slight shadow */
.img-cutout {
  filter: drop-shadow(2px 3px 6px rgba(0,0,0,0.12));
}

/* Paper tape decoration */
.paper-tape {
  position: absolute;
  width: 48px;
  height: 14px;
  background: rgba(255,255,255,0.6);
  transform: rotate(-3deg);
  z-index: 5;
}

/* All stroke is now Canvas contour — applied via img-cutout + stroked cutout images */

/* ═══════════════ MAGAZINE COVER ═══════════════ */
.tpl-magazine {
  display: flex;
  flex-direction: column;
}

.mag-hero {
  position: relative;
  aspect-ratio: 4/3;
  overflow: hidden;
}

.mag-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mag-hero-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px 20px;
  background: linear-gradient(transparent, rgba(0,0,0,0.5));
  color: white;
}

.mag-date {
  font-size: 10px;
  letter-spacing: 0.1em;
  opacity: 0.8;
  margin-bottom: 4px;
}

.mag-title {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.3;
}

.mag-secondary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}

.mag-sec-item {
  aspect-ratio: 1;
  overflow: hidden;
}

.mag-sec-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mag-caption {
  padding: 20px;
  text-align: center;
}

.caption-line {
  width: 24px;
  height: 2px;
  background: var(--jp-primary);
  margin: 0 auto 12px;
}

.mag-caption p {
  font-size: 15px;
  color: var(--text-main);
  line-height: 2;
  letter-spacing: 0.05em;
  white-space: pre-line;
}

/* ═══════════════ CLEAN GRID ═══════════════ */
.tpl-grid {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.grid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.grid-date {
  font-size: 13px;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.grid-tag {
  font-size: 10px;
  color: white;
  background: var(--jp-primary);
  padding: 2px 10px;
  border-radius: 2px;
  letter-spacing: 0.05em;
}

.grid-photos {
  display: grid;
  gap: 4px;
}

.grid-count-1 { grid-template-columns: 1fr; }
.grid-count-2 { grid-template-columns: 1fr 1fr; }
.grid-count-3,
.grid-count-4 { grid-template-columns: 1fr 1fr; }

.grid-photo {
  overflow: hidden;
  aspect-ratio: 4/3;
}

.grid-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.grid-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grid-mood {
  font-size: 18px;
  color: var(--text-main);
  letter-spacing: 0.08em;
  font-weight: 600;
}

.grid-caption {
  font-size: 14px;
  color: var(--text-body);
  line-height: 1.8;
  letter-spacing: 0.03em;
  white-space: pre-line;
}

.grid-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-chip {
  font-size: 10px;
  color: var(--jp-secondary);
  padding: 2px 8px;
  border: 1px solid var(--jp-secondary);
  border-radius: 10px;
}

/* ═══════════════ POETIC ═══════════════ */
.tpl-poetic {
  display: flex;
  flex-direction: column;
}

.poem-photo {
  aspect-ratio: 3/2;
  overflow: hidden;
}

.poem-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poem-text {
  padding: 24px 20px;
}

.poem-date {
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0.1em;
  margin-bottom: 12px;
}

.poem-divider {
  width: 16px;
  height: 1px;
  background: var(--jp-accent);
  margin-bottom: 16px;
}

.poem-caption {
  font-size: 20px;
  color: var(--text-main);
  line-height: 2;
  letter-spacing: 0.06em;
  white-space: pre-line;
  margin-bottom: 16px;
}

.poem-meta {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.8;
}

.poem-thumbs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
}

.poem-thumb {
  aspect-ratio: 1;
  overflow: hidden;
}

.poem-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ═══════════════ COLLAGE ═══════════════ */
.tpl-collage {
  padding: 16px;
}

.collage-canvas {
  position: relative;
  aspect-ratio: 1;
  margin-bottom: 20px;
}

.collage-item {
  position: absolute;
  width: 55%;
  aspect-ratio: 3/4;
  box-shadow: 2px 3px 8px rgba(0,0,0,0.15);
  overflow: hidden;
}

.collage-item:nth-child(1) { top: 0; left: 0; width: 58%; }
.collage-item:nth-child(2) { top: 8%; right: 0; width: 48%; }
.collage-item:nth-child(3) { top: 48%; left: 8%; width: 44%; }
.collage-item:nth-child(4) { top: 52%; right: 4%; width: 42%; }
.collage-item:nth-child(5) { top: 72%; left: 30%; width: 40%; }

.collage-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tape {
  position: absolute;
  top: -4px;
  left: 20%;
  width: 40%;
  height: 14px;
  transform: rotate(-3deg);
}

.collage-text {
  text-align: center;
  padding: 8px;
}

.collage-caption {
  font-size: 16px;
  color: var(--text-main);
  line-height: 1.8;
  letter-spacing: 0.05em;
  white-space: pre-line;
}

.collage-date {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
}

/* ═══════════════ DIARY ═══════════════ */
.tpl-diary {
  padding: 20px;
}

.diary-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-hairline);
  margin-bottom: 20px;
}

.diary-date {
  font-size: 16px;
  color: var(--text-main);
  font-weight: 600;
  letter-spacing: 0.05em;
}

.diary-weather {
  font-size: 12px;
  color: var(--jp-primary);
}

.diary-photos {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.diary-polaroid {
  background: white;
  padding: 8px 8px 28px;
  box-shadow: 1px 2px 6px rgba(0,0,0,0.1);
  width: 140px;
}

.polaroid-img {
  aspect-ratio: 1;
  overflow: hidden;
}

.polaroid-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.polaroid-caption {
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-muted);
  text-align: center;
}

.diary-content {
  font-size: 13px;
  color: var(--text-body);
  line-height: 2;
  letter-spacing: 0.03em;
}

.diary-tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.tag-dot {
  font-size: 10px;
  color: var(--jp-secondary);
  letter-spacing: 0.05em;
}
</style>
