<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useJournalStore } from '@/stores/journal'
import PhotoUploader from '@/components/PhotoUploader.vue'
import type { JournalPhoto } from '@/stores/journal'

const router = useRouter()
const store = useJournalStore()

function onPhotosSelected(newPhotos: JournalPhoto[]) {
  store.addPhotos(newPhotos)
}

function goToEditor() {
  if (store.hasPhotos) {
    router.push('/editor')
  }
}

function startFromScratch() {
  store.clearPhotos()
  document.getElementById('fileInput')?.click()
}
</script>

<template>
  <div class="home">
    <!-- Hero -->
    <header class="hero">
      <div class="hero-tag serif">— 拍照 · 生成 · 手帐 —</div>
      <h1 class="hero-title serif">手 帖</h1>
      <p class="hero-sub">
        选几张照片，<br />
        AI 帮你生成独一无二的手帐页面。
      </p>
      <div class="hr-accent"></div>
    </header>

    <!-- Upload area -->
    <section class="upload-section">
      <PhotoUploader
        :photos="store.photos"
        @selected="onPhotosSelected"
        @remove="store.removePhoto"
      />
    </section>

    <!-- CTA -->
    <div class="cta-area" v-if="store.hasPhotos">
      <p class="photo-count serif">
        <span class="count-num">{{ store.photoCount }}</span> 张照片
      </p>
      <button class="btn-primary" @click="goToEditor">
        生成手帐
        <span class="btn-arrow">→</span>
      </button>
    </div>

    <!-- Empty state hint -->
    <div class="hint-area" v-else>
      <div class="hint-grid">
        <div class="hint-item" v-for="(hint, i) in hints" :key="i">
          <span class="hint-num serif">{{ String(i + 1).padStart(2, '0') }}</span>
          <p class="hint-text">{{ hint }}</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="home-footer">
      <router-link to="/history" class="footer-link">
        历史手帖 →
      </router-link>
    </footer>
  </div>
</template>

<script lang="ts">
const hints = [
  '选择照片',
  'AI 识别内容与情绪',
  '自动排版布局',
  '自由调整细节',
]
</script>

<style scoped>
.home {
  max-width: 480px;
  margin: 0 auto;
  padding: var(--space-3xl) var(--space-lg) var(--space-xl);
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

/* ── Hero ── */
.hero {
  text-align: center;
  margin-bottom: var(--space-2xl);
}

.hero-tag {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.15em;
  margin-bottom: var(--space-xs);
}

.hero-title {
  font-size: 48px;
  font-weight: 600;
  color: var(--text-main);
  letter-spacing: 0.2em;
  line-height: 1.2;
  margin-bottom: var(--space-md);
  /* Subtle text shadow for depth */
  text-shadow: 0 1px 0 rgba(255,255,255,0.8), 0 2px 4px rgba(44,36,32,0.06);
}

.hero-sub {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 2;
  letter-spacing: 0.05em;
}

.hr-accent {
  width: 32px;
  height: 2px;
  background: var(--border-accent);
  margin: var(--space-xl) auto 0;
}

/* ── Upload ── */
.upload-section {
  margin-bottom: var(--space-lg);
}

/* ── CTA ── */
.cta-area {
  text-align: center;
  padding: var(--space-lg) 0;
}

.photo-count {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: var(--space-md);
  letter-spacing: 0.08em;
}

.count-num {
  font-size: 24px;
  color: var(--text-main);
  font-weight: 600;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 14px 36px;
  background: var(--text-main);
  color: var(--bg-cream);
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.1em;
  border-radius: 2px;
  transition: all 0.3s var(--ease-out-expo);
}

.btn-primary:hover {
  background: var(--sumi-ink);
  transform: translateY(-1px);
  box-shadow: var(--shadow-float);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-arrow {
  transition: transform 0.3s var(--ease-out-expo);
}

.btn-primary:hover .btn-arrow {
  transform: translateX(3px);
}

/* ── Hints ── */
.hint-area {
  flex: 1;
  display: flex;
  align-items: center;
  padding: var(--space-xl) 0;
}

.hint-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg) var(--space-xl);
  width: 100%;
}

.hint-item {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.hint-num {
  font-size: 13px;
  color: var(--text-light);
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.hint-text {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}

/* ── Footer ── */
.home-footer {
  text-align: center;
  padding-top: var(--space-xl);
  border-top: 1px solid var(--border-hairline);
  margin-top: auto;
}

.footer-link {
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  transition: color 0.2s;
  font-family: var(--font-serif);
}

.footer-link:hover {
  color: var(--text-main);
}
</style>
