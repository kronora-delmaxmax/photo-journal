import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface JournalPhoto {
  id: string
  dataUrl: string
  width: number
  height: number
  aspectRatio: number
}

export interface ColorPalette {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
}

export interface PhotoAnalysis {
  content: string        // what's in the photo
  mood: string           // emotion detected
  style: string          // suggested journal style
  caption: string        // AI-generated caption
  tags: string[]         // keywords
  dateContext: string    // inferred date/season
}

export interface JournalPage {
  photos: JournalPhoto[]
  analysis: PhotoAnalysis | null
  palette: ColorPalette
  templateId: string
  createdAt: Date
}

export const useJournalStore = defineStore('journal', () => {
  const photos = ref<JournalPhoto[]>([])
  const analysis = ref<PhotoAnalysis | null>(null)
  const palette = ref<ColorPalette>({
    primary: '#c44d34',
    secondary: '#4a7c8c',
    accent: '#c8a84e',
    background: '#faf8f5',
    text: '#2c2420',
  })
  const selectedTemplate = ref('classic-1')
  const isAnalyzing = ref(false)
  const history = ref<JournalPage[]>([])

  const photoCount = computed(() => photos.value.length)
  const hasPhotos = computed(() => photos.value.length > 0)

  function addPhotos(newPhotos: JournalPhoto[]) {
    photos.value.push(...newPhotos)
  }

  function removePhoto(id: string) {
    photos.value = photos.value.filter(p => p.id !== id)
    URL.revokeObjectURL(id)
  }

  function clearPhotos() {
    photos.value.forEach(p => URL.revokeObjectURL(p.id))
    photos.value = []
    analysis.value = null
  }

  function setAnalysis(a: PhotoAnalysis) {
    analysis.value = a
  }

  function setPalette(p: ColorPalette) {
    palette.value = p
  }

  function setTemplate(id: string) {
    selectedTemplate.value = id
  }

  function saveToHistory() {
    history.value.unshift({
      photos: [...photos.value],
      analysis: analysis.value ? { ...analysis.value } : null,
      palette: { ...palette.value },
      templateId: selectedTemplate.value,
      createdAt: new Date(),
    })
    // Keep last 20
    if (history.value.length > 20) {
      history.value = history.value.slice(0, 20)
    }
  }

  return {
    photos, analysis, palette, selectedTemplate,
    isAnalyzing, history,
    photoCount, hasPhotos,
    addPhotos, removePhoto, clearPhotos,
    setAnalysis, setPalette, setTemplate,
    saveToHistory,
  }
})
