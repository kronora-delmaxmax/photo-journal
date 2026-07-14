<script setup lang="ts">
import { ref } from 'vue'
import type { JournalPhoto } from '@/stores/journal'

const props = defineProps<{
  photos: JournalPhoto[]
}>()

const emit = defineEmits<{
  selected: [photos: JournalPhoto[]]
  remove: [id: string]
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement>()

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  processFiles(Array.from(input.files))
  input.value = ''
}

function processFiles(files: File[]) {
  const imageFiles = files.filter(f => f.type.startsWith('image/'))
  const readers: Promise<JournalPhoto>[] = imageFiles.map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          resolve({
            id: URL.createObjectURL(file),
            dataUrl: reader.result as string,
            width: img.naturalWidth,
            height: img.naturalHeight,
            aspectRatio: img.naturalWidth / img.naturalHeight,
          })
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    })
  })

  Promise.all(readers).then(photos => {
    emit('selected', photos)
  })
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  if (e.dataTransfer?.files.length) {
    processFiles(Array.from(e.dataTransfer.files))
  }
}

function openFileDialog() {
  fileInput.value?.click()
}

function removePhoto(id: string) {
  emit('remove', id)
}

// Grid layout based on photo count
function gridClass(count: number): string {
  if (count <= 1) return 'grid-1'
  if (count === 2) return 'grid-2'
  if (count <= 4) return 'grid-4'
  return 'grid-many'
}
</script>

<template>
  <div class="uploader">
    <!-- Drop zone -->
    <div
      class="drop-zone"
      :class="{ 'is-dragging': isDragging, 'has-photos': photos.length > 0 }"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @click="openFileDialog"
    >
      <template v-if="photos.length === 0">
        <div class="dz-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="4" y="6" width="32" height="28" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="14" cy="16" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 30l8-10 6 8 4-5 6 7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </div>
        <p class="dz-title serif">选择照片</p>
        <p class="dz-hint">点击或拖拽上传</p>
      </template>

      <!-- Photo grid preview -->
      <div v-else class="photo-grid" :class="gridClass(photos.length)">
        <div
          v-for="photo in photos"
          :key="photo.id"
          class="photo-cell"
        >
          <img :src="photo.dataUrl" :alt="'Photo ' + photo.id" />
          <button class="photo-remove" @click.stop="removePhoto(photo.id)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="rgba(44,36,32,0.6)"/>
              <path d="M5 5l6 6M11 5l-6 6" stroke="white" stroke-width="1.5"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Add more button -->
      <button
        v-if="photos.length > 0"
        class="add-more-btn"
        @click.stop="openFileDialog"
      >
        + 添加照片
      </button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      class="file-input-hidden"
      @change="handleFileSelect"
    />
  </div>
</template>

<style scoped>
.uploader {
  width: 100%;
}

/* ── Drop Zone ── */
.drop-zone {
  width: 100%;
  min-height: 180px;
  border: 2px dashed var(--border-warm);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-xl);
  cursor: pointer;
  transition: all 0.3s var(--ease-out-expo);
  background: rgba(255,255,255,0.3);
}

.drop-zone.has-photos {
  border-style: solid;
  border-color: var(--border-hairline);
  padding: var(--space-md);
  gap: var(--space-md);
  background: transparent;
  cursor: default;
}

.drop-zone.is-dragging {
  border-color: var(--aka-vermilion);
  background: rgba(196,77,52,0.04);
}

.drop-zone:hover:not(.has-photos) {
  border-color: var(--border-accent);
  background: rgba(255,255,255,0.5);
}

.dz-icon {
  color: var(--text-muted);
  opacity: 0.6;
}

.dz-title {
  font-size: 16px;
  color: var(--text-main);
  letter-spacing: 0.1em;
}

.dz-hint {
  font-size: 11px;
  color: var(--text-light);
  letter-spacing: 0.05em;
}

/* ── Photo Grid ── */
.photo-grid {
  width: 100%;
  display: grid;
  gap: 6px;
}

.grid-1 {
  grid-template-columns: 1fr;
}

.grid-2 {
  grid-template-columns: 1fr 1fr;
}

.grid-4 {
  grid-template-columns: 1fr 1fr;
}

.grid-many {
  grid-template-columns: repeat(3, 1fr);
}

.photo-cell {
  position: relative;
  overflow: hidden;
  border-radius: 2px;
  aspect-ratio: 4/3;
  background: var(--bg-washi);
}

.photo-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}

.photo-cell:hover .photo-remove,
.photo-cell:active .photo-remove {
  opacity: 1;
}

/* ── Add More ── */
.add-more-btn {
  padding: 8px 20px;
  font-size: 12px;
  color: var(--text-muted);
  border: 1px solid var(--border-warm);
  border-radius: 2px;
  letter-spacing: 0.08em;
  transition: all 0.2s;
  font-family: var(--font-serif);
}

.add-more-btn:hover {
  border-color: var(--border-accent);
  color: var(--text-main);
}

/* ── Hidden input ── */
.file-input-hidden {
  display: none;
}
</style>
