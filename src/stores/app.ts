import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Page = 'home' | 'editor' | 'history'

export const useAppStore = defineStore('app', () => {
  const page = ref<Page>('home')

  function navigate(to: Page) {
    page.value = to
    window.scrollTo(0, 0)
  }

  return { page, navigate }
})
