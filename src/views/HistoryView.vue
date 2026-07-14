<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { useJournalStore } from '@/stores/journal'

const app = useAppStore()
const store = useJournalStore()
</script>

<template>
  <div class="history">
    <header class="history-header">
      <button class="back-btn" @click="app.navigate('home')">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12 4L6 10L12 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="header-title serif">历史手帖</div>
      <div class="header-spacer"></div>
    </header>

    <div class="history-content">
      <template v-if="store.history.length === 0">
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="6" width="32" height="36" rx="2" stroke="currentColor" stroke-width="1"/>
              <line x1="16" y1="16" x2="32" y2="16" stroke="currentColor" stroke-width="1" opacity="0.3"/>
              <line x1="16" y1="22" x2="28" y2="22" stroke="currentColor" stroke-width="1" opacity="0.3"/>
              <line x1="16" y1="28" x2="24" y2="28" stroke="currentColor" stroke-width="1" opacity="0.3"/>
            </svg>
          </div>
          <p class="empty-title serif">还没有手帖</p>
          <p class="empty-desc">选择照片，创建你的第一份手帖吧。</p>
          <button class="btn-start" @click="app.navigate('home')">
            开始 →
          </button>
        </div>
      </template>

      <div v-else class="history-grid">
        <div
          v-for="(page, index) in store.history"
          :key="index"
          class="history-card"
        >
          <div class="card-thumb">
            <img
              v-if="page.photos[0]"
              :src="page.photos[0].dataUrl"
              alt=""
            />
          </div>
          <div class="card-meta">
            <span class="card-date serif">
              {{ page.createdAt.toLocaleDateString('zh-CN', { month:'long', day:'numeric', weekday:'short' }) }}
            </span>
            <span class="card-mood" v-if="page.analysis">
              {{ page.analysis.mood }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  min-height: 100dvh;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-hairline);
  background: rgba(255,255,255,0.3);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
}

.back-btn {
  padding: 4px;
  color: var(--text-main);
}
.header-title {
  font-size: 15px;
  color: var(--text-main);
  letter-spacing: 0.1em;
}
.header-spacer { width: 28px; }

.history-content {
  padding: var(--space-lg);
}

/* ── Empty State ── */
.empty-state {
  text-align: center;
  padding: var(--space-3xl) 0;
}

.empty-icon {
  color: var(--text-light);
  opacity: 0.4;
  margin-bottom: var(--space-lg);
}

.empty-title {
  font-size: 18px;
  color: var(--text-main);
  letter-spacing: 0.08em;
  margin-bottom: var(--space-sm);
}

.empty-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: var(--space-xl);
}

.btn-start {
  padding: 10px 24px;
  border: 1px solid var(--text-main);
  color: var(--text-main);
  font-family: var(--font-serif);
  font-size: 13px;
  letter-spacing: 0.08em;
  border-radius: 2px;
  transition: all 0.2s;
}

.btn-start:hover {
  background: var(--text-main);
  color: var(--bg-cream);
}

/* ── History Grid ── */
.history-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.history-card {
  cursor: pointer;
  transition: transform 0.2s var(--ease-out-expo);
}

.history-card:hover {
  transform: translateY(-2px);
}

.card-thumb {
  aspect-ratio: 3/4;
  background: var(--bg-washi);
  border-radius: 2px;
  overflow: hidden;
  box-shadow: var(--shadow-paper);
}

.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 2px 0;
}

.card-date {
  font-size: 11px;
  color: var(--text-muted);
}

.card-mood {
  font-size: 10px;
  color: var(--text-light);
  padding: 1px 6px;
  border: 1px solid var(--border-hairline);
  border-radius: 10px;
}
</style>
