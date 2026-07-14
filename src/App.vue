<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <RouterView v-slot="{ Component, route }">
      <Transition :name="route.meta.transition || 'fade'" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </div>
</template>

<style>
/* ═══════════════ DESIGN TOKENS — Japanese Magazine Aesthetic ═══════════════ */
:root {
  /* ── Base ── */
  --bg-cream: #faf8f5;
  --bg-paper: #f3efe6;
  --bg-washi: #ede6d8;
  --bg-ink: #fefcf9;

  /* ── Text ── */
  --text-main: #2c2420;
  --text-body: #4a4038;
  --text-muted: #8c8078;
  --text-light: #b0a498;

  /* ── Accents (Japanese traditional) ── */
  --aka-vermilion: #c44d34;   /* 朱色 */
  --ai-indigo: #4a7c8c;       /* 藍色 */
  --kin-gold: #c8a84e;        /* 金色 */
  --midori-sage: #6b8e6b;     /* 緑 */
  --sumi-ink: #3a3028;        /* 墨色 */
  --sakura-pink: #d4a0a0;     /* 桜色 */
  --matcha: #8ba888;          /* 抹茶 */

  /* ── Borders & Dividers ── */
  --border-hairline: #e0d8cc;
  --border-warm: #d4c8b8;
  --border-accent: #c8b898;

  /* ── Typography ── */
  --font-serif: 'Noto Serif SC', 'STSong', 'Songti SC', serif;
  --font-sans: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;

  /* ── Spacing ── */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  /* ── Shadows ── */
  --shadow-paper: 0 1px 3px rgba(44,36,32,0.06), 0 0 0 1px rgba(44,36,32,0.03);
  --shadow-card: 0 2px 8px rgba(44,36,32,0.08);
  --shadow-float: 0 8px 24px rgba(44,36,32,0.10);

  /* ── Transitions ── */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}

/* ═══════════════ RESET ═══════════════ */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  font-family: var(--font-sans);
  background: var(--bg-cream);
  color: var(--text-body);
  line-height: 1.8;
  overflow-x: hidden;
  min-height: 100vh;
  min-height: 100dvh;
}

img{max-width:100%;display:block}
button{font-family:inherit;cursor:pointer;border:none;background:none}
a{color:inherit;text-decoration:none}

/* ═══════════════ APP SHELL ═══════════════ */
.app-shell {
  min-height: 100vh;
  min-height: 100dvh;
  background:
    /* Subtle paper grain via noise */
    radial-gradient(ellipse at 20% 50%, var(--bg-paper) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, var(--bg-washi) 0%, transparent 40%),
    var(--bg-cream);
}

/* ═══════════════ TRANSITIONS ═══════════════ */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s var(--ease-out-expo);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.5s var(--ease-out-expo);
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(24px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* ═══════════════ UTILITY CLASSES ═══════════════ */
.serif { font-family: var(--font-serif); }
.sans { font-family: var(--font-sans); }
.text-main { color: var(--text-main); }
.text-muted { color: var(--text-muted); }
.text-light { color: var(--text-light); }

/* Hairline divider */
.hr {
  width: 100%;
  height: 1px;
  background: var(--border-hairline);
  margin: var(--space-lg) 0;
}
.hr-accent {
  width: 40px;
  height: 2px;
  background: var(--border-accent);
  margin: var(--space-md) 0;
}
</style>
