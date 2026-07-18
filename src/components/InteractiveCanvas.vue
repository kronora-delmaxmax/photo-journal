<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { JournalPhoto, PhotoAnalysis, ColorPalette } from '@/stores/journal'
import { renderWorkspace } from '@/services/workspaceRenderer'
import type { PhotoBounds } from '@/services/workspaceRenderer'

const props = defineProps<{
  photos: JournalPhoto[]
  analysis: PhotoAnalysis | null
  palette: ColorPalette
  templateId: string
  paperBg: string
  cutouts: Record<string, string>
  photoPositions: Record<string, { x: number; y: number; scale: number }>
  workspaceWidth: number
  workspaceHeight: number
  strokeEnabled?: boolean
  strokeColor?: string
}>()

const emit = defineEmits<{
  updatePosition: [id: string, x: number, y: number, scale?: number]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const photoBounds = ref<PhotoBounds[]>([])

let dragging: {
  photoId: string; startX: number; startY: number
  origX: number; origY: number; origScale: number
  elW: number; elH: number
} | null = null
let pinching: { photoId: string; startDist: number; origScale: number } | null = null
let rafId = 0
let pendingRedraw = false

async function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (canvas.width !== props.workspaceWidth || canvas.height !== props.workspaceHeight) {
    canvas.width = props.workspaceWidth
    canvas.height = props.workspaceHeight
  }

  try {
    const bounds = await renderWorkspace(ctx, {
      photos: props.photos,
      cutouts: props.cutouts,
      analysis: props.analysis,
      palette: props.palette,
      templateId: props.templateId,
      paperBg: props.paperBg,
      width: props.workspaceWidth,
      height: props.workspaceHeight,
      positions: props.photoPositions,
    })
    photoBounds.value = bounds
  } catch (err) {
    console.error('Workspace render failed:', err)
  }
}

function scheduleRedraw() {
  if (!pendingRedraw) {
    pendingRedraw = true
    rafId = requestAnimationFrame(() => {
      pendingRedraw = false
      render()
    })
  }
}

function cssToCanvas(clientX: number, clientY: number): { x: number; y: number } | null {
  const canvas = canvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const cssX = clientX - rect.left
  const cssY = clientY - rect.top
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return { x: cssX * scaleX, y: cssY * scaleY }
}

function findPhotoAt(canvasX: number, canvasY: number): string | null {
  for (let i = photoBounds.value.length - 1; i >= 0; i--) {
    const b = photoBounds.value[i]
    const pad = 12
    if (canvasX >= b.x - pad && canvasX <= b.x + b.w + pad &&
        canvasY >= b.y - pad && canvasY <= b.y + b.h + pad) {
      return b.id
    }
  }
  return null
}

function getPos(photoId: string): { x: number; y: number; scale: number } {
  return props.photoPositions[photoId] || { x: 50, y: 50, scale: 1 }
}

function onPointerDown(e: MouseEvent | TouchEvent) {
  const touches = 'touches' in e ? e.touches : null

  if (touches && touches.length === 2) {
    const midX = (touches[0].clientX + touches[1].clientX) / 2
    const midY = (touches[0].clientY + touches[1].clientY) / 2
    const canvasPt = cssToCanvas(midX, midY)
    if (!canvasPt) return
    const photoId = findPhotoAt(canvasPt.x, canvasPt.y)
    if (!photoId) return
    e.preventDefault()
    const pos = getPos(photoId)
    pinching = {
      photoId,
      startDist: Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY),
      origScale: pos.scale,
    }
    dragging = null
    return
  }

  const pt = touches ? touches[0] : (e as MouseEvent)
  if (!pt) return
  const canvasPt = cssToCanvas(pt.clientX, pt.clientY)
  if (!canvasPt) return

  const photoId = findPhotoAt(canvasPt.x, canvasPt.y)
  if (!photoId) return

  e.preventDefault()
  const pos = getPos(photoId)
  const canvas = canvasRef.value!
  dragging = {
    photoId,
    startX: pt.clientX,
    startY: pt.clientY,
    origX: pos.x,
    origY: pos.y,
    origScale: pos.scale,
    elW: canvas.clientWidth,
    elH: canvas.clientHeight,
  }
}

function onPointerMove(e: MouseEvent | TouchEvent) {
  const touches = 'touches' in e ? e.touches : null

  if (pinching && touches && touches.length === 2) {
    const dist = Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY)
    const ratio = dist / pinching.startDist
    const newScale = Math.max(0.5, Math.min(3, pinching.origScale * ratio))
    emit('updatePosition', pinching.photoId, getPos(pinching.photoId).x, getPos(pinching.photoId).y, newScale)
    scheduleRedraw()
    return
  }

  if (!dragging) return
  const pt = touches ? touches[0] : (e as MouseEvent)
  if (!pt) return

  const dx = pt.clientX - dragging.startX
  const dy = pt.clientY - dragging.startY

  const pctX = dragging.elW > 0 ? (dx / dragging.elW) * 100 : 0
  const pctY = dragging.elH > 0 ? (dy / dragging.elH) * 100 : 0

  const newX = Math.max(0, Math.min(100, dragging.origX - pctX))
  const newY = Math.max(0, Math.min(100, dragging.origY - pctY))

  emit('updatePosition', dragging.photoId, newX, newY, dragging.origScale)
  scheduleRedraw()
}

function onPointerUp(e: MouseEvent | TouchEvent) {
  const touches = 'touches' in e ? e.touches : null

  if (pinching && touches && touches.length === 1) {
    const pos = getPos(pinching.photoId)
    const canvas = canvasRef.value!
    dragging = {
      photoId: pinching.photoId,
      startX: touches[0].clientX,
      startY: touches[0].clientY,
      origX: pos.x,
      origY: pos.y,
      origScale: pos.scale,
      elW: canvas.clientWidth,
      elH: canvas.clientHeight,
    }
    pinching = null
    return
  }

  if (dragging) { render() }
  dragging = null
  pinching = null
}

function onWheel(e: WheelEvent) {
  const canvasPt = cssToCanvas(e.clientX, e.clientY)
  if (!canvasPt) return
  const photoId = findPhotoAt(canvasPt.x, canvasPt.y)
  if (!photoId) return

  e.preventDefault()
  const pos = getPos(photoId)

  let newScale: number
  if (e.ctrlKey) {
    newScale = Math.max(0.5, Math.min(3, pos.scale * (1 - e.deltaY * 0.005)))
  } else {
    const step = e.deltaY > 0 ? -0.08 : 0.08
    newScale = Math.max(0.5, Math.min(3, pos.scale + step))
  }

  emit('updatePosition', photoId, pos.x, pos.y, newScale)
  scheduleRedraw()
}

let gestureScale = 1
function onGestureStart(e: Event) { e.preventDefault(); gestureScale = 1 }
function onGestureChange(e: any) {
  e.preventDefault()
  if (!e.scale) return
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const midX = rect.left + rect.width / 2
  const midY = rect.top + rect.height / 2
  const canvasPt = cssToCanvas(midX, midY)
  if (!canvasPt) return
  const photoId = findPhotoAt(canvasPt.x, canvasPt.y)
  if (!photoId) return

  const pos = getPos(photoId)
  const newScale = Math.max(0.5, Math.min(3, pos.scale * e.scale / gestureScale))
  gestureScale = e.scale
  emit('updatePosition', photoId, pos.x, pos.y, newScale)
  scheduleRedraw()
}
function onGestureEnd(e: Event) { e.preventDefault(); gestureScale = 1 }

let watchTimer: ReturnType<typeof setTimeout> | null = null

function debouncedRender() {
  if (watchTimer) clearTimeout(watchTimer)
  watchTimer = setTimeout(() => render(), 80)
}

watch(() => props.analysis, () => { if (props.analysis) debouncedRender() }, { deep: true })
watch(() => props.cutouts, () => { if (props.analysis) debouncedRender() }, { deep: true })
watch(() => [props.templateId, props.paperBg, props.workspaceWidth, props.workspaceHeight, props.strokeEnabled],
  () => { if (props.analysis) debouncedRender() }
)
watch(() => props.photoPositions, () => { if (props.analysis && !dragging) debouncedRender() }, { deep: true })

onMounted(async () => {
  await nextTick()
  if (props.analysis) render()
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (watchTimer) clearTimeout(watchTimer)
})

defineExpose({
  canvas: canvasRef,
  getCanvas: () => canvasRef.value,
  getDataURL: () => canvasRef.value?.toDataURL('image/png'),
})
</script>

<template>
  <canvas
    ref="canvasRef"
    :width="workspaceWidth"
    :height="workspaceHeight"
    class="workspace-canvas"
    @mousedown="onPointerDown"
    @mousemove="onPointerMove"
    @mouseup="onPointerUp"
    @mouseleave="onPointerUp"
    @wheel.prevent="onWheel"
    @gesturestart.prevent="onGestureStart"
    @gesturechange.prevent="onGestureChange"
    @gestureend.prevent="onGestureEnd"
    @touchstart.prevent="onPointerDown"
    @touchmove.prevent="onPointerMove"
    @touchend.prevent="onPointerUp"
  />
</template>

<style scoped>
.workspace-canvas {
  width: 100%;
  height: auto;
  display: block;
  box-shadow: var(--shadow-card);
  touch-action: none;
  border: 1px solid rgba(0,0,0,0.04);
}
</style>
