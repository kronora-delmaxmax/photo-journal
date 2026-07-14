<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import HomeView from '@/views/HomeView.vue'
import EditorView from '@/views/EditorView.vue'
import HistoryView from '@/views/HistoryView.vue'

const app = useAppStore()
</script>

<template>
  <div class="app-shell">
    <HomeView v-if="app.page === 'home'" />
    <EditorView v-else-if="app.page === 'editor'" />
    <HistoryView v-else-if="app.page === 'history'" />
  </div>
</template>

<style>
/* ═══════════════ DESIGN TOKENS ═══════════════ */
:root {
  --bg-cream: #faf8f5;
  --bg-paper: #f3efe6;
  --bg-washi: #ede6d8;
  --text-main: #2c2420;
  --text-body: #4a4038;
  --text-muted: #8c8078;
  --text-light: #b0a498;
  --aka-vermilion: #c44d34;
  --ai-indigo: #4a7c8c;
  --kin-gold: #c8a84e;
  --midori-sage: #6b8e6b;
  --sumi-ink: #3a3028;
  --sakura-pink: #d4a0a0;
  --border-hairline: #e0d8cc;
  --border-warm: #d4c8b8;
  --border-accent: #c8b898;
  --font-serif: 'Noto Serif SC', 'STSong', serif;
  --font-sans: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --shadow-paper: 0 1px 3px rgba(44,36,32,0.06);
  --shadow-card: 0 2px 8px rgba(44,36,32,0.08);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

html { font-size: 16px; -webkit-font-smoothing: antialiased; }

body {
  font-family: var(--font-sans);
  background: var(--bg-cream);
  color: var(--text-body);
  line-height: 1.8;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
  -webkit-text-size-adjust: 100%;
}

img{max-width:100%;display:block;height:auto}
button{font-family:inherit;cursor:pointer;border:none;background:none}
a{color:inherit;text-decoration:none}

.app-shell {
  width: 100%;
  max-width: 100vw;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
  background:
    radial-gradient(ellipse at 20% 50%, var(--bg-paper) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, var(--bg-washi) 0%, transparent 40%),
    var(--bg-cream);
}

@media (max-width: 480px) {
  :root {
    --space-3xl: 40px;
    --space-2xl: 32px;
  }
}

.serif { font-family: var(--font-serif); }
.sans { font-family: var(--font-sans); }
</style>
