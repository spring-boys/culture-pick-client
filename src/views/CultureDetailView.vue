<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCultureDetail } from '@/services/culture'
import { addBookmark, removeBookmark } from '@/services/bookmark'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const culture = ref(null)
const loading = ref(true)
const bookmarked = ref(false)
const bookmarkCount = ref(0)

async function fetchDetail() {
  try {
    const { data } = await getCultureDetail(route.params.id)
    culture.value = data
    bookmarked.value = data.bookmarked
    bookmarkCount.value = data.bookmarkCount
  } catch {
    router.replace('/')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (authStore.checked) {
    fetchDetail()
  } else {
    const stop = watch(() => authStore.checked, (val) => {
      if (val) {
        stop()
        fetchDetail()
      }
    })
  }
})

async function toggleBookmark() {
  if (!authStore.isLoggedIn) return

  const wasBookmarked = bookmarked.value
  bookmarked.value = !wasBookmarked
  bookmarkCount.value += wasBookmarked ? -1 : 1

  try {
    if (wasBookmarked) await removeBookmark(culture.value.id)
    else await addBookmark(culture.value.id)
  } catch {
    bookmarked.value = wasBookmarked
    bookmarkCount.value += wasBookmarked ? 1 : -1
  }
}

function formatDate(date) {
  if (!date) return '-'
  return String(date).replace(/-/g, '.')
}
</script>

<template>
  <main class="page-shell">
    <div v-if="loading" class="loading-state">불러오는 중...</div>

    <template v-else-if="culture">
      <button type="button" class="back-link" @click="router.back()">← 뒤로 가기</button>

      <section class="detail-card">
        <div class="thumbnail-area">
          <img
            class="detail-thumbnail"
            :src="culture.thumbnail || ''"
            :alt="`${culture.title} 썸네일`"
          />
        </div>

        <div class="detail-info">
          <div class="badge-row">
            <span v-if="culture.category" class="badge">{{ culture.category }}</span>
            <span v-if="culture.area || culture.sigungu" class="badge">
              {{ [culture.area, culture.sigungu].filter(Boolean).join(' ') }}
            </span>
          </div>

          <div class="title-row">
            <h1>{{ culture.title }}</h1>
            <div class="bookmark-area">
              <button
                type="button"
                class="bookmark-button"
                :class="{ active: bookmarked }"
                :disabled="!authStore.isLoggedIn"
                @click="toggleBookmark"
              >{{ bookmarked ? '★' : '☆' }}</button>
              <span class="bookmark-count">{{ bookmarkCount }}</span>
            </div>
          </div>

          <table class="info-table">
            <tbody>
              <tr>
                <th>기간</th>
                <td>{{ formatDate(culture.startDate) }} ~ {{ formatDate(culture.endDate) }}</td>
              </tr>
              <tr>
                <th>장소</th>
                <td>{{ culture.place || '-' }}</td>
              </tr>
              <tr v-if="culture.placeAddr">
                <th>주소</th>
                <td>{{ culture.placeAddr }}</td>
              </tr>
              <tr>
                <th>지역</th>
                <td>{{ [culture.area, culture.sigungu].filter(Boolean).join(' ') || '-' }}</td>
              </tr>
              <tr v-if="culture.price">
                <th>요금</th>
                <td>{{ culture.price }}</td>
              </tr>
              <tr v-if="culture.phone">
                <th>연락처</th>
                <td>{{ culture.phone }}</td>
              </tr>
              <tr v-if="culture.url">
                <th>공식 링크</th>
                <td><a class="external-link" :href="culture.url" target="_blank" rel="noopener noreferrer">바로가기</a></td>
              </tr>
            </tbody>
          </table>

          <div class="button-row">
            <button type="button" class="chat-button" disabled>채팅방 바로가기</button>
          </div>
        </div>
      </section>

      <section class="review-section">
        <div class="section-head">
          <h2>사용자 리뷰</h2>
          <button type="button" class="review-write-button" disabled>리뷰 작성하기</button>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page-shell {
  padding: 24px 32px 56px;
  min-width: 1100px;
}

.loading-state {
  padding: 80px 0;
  text-align: center;
  color: var(--color-muted);
  font-size: 15px;
}

.back-link {
  display: inline-block;
  margin-bottom: 18px;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-muted);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
}

.back-link:hover {
  color: var(--color-primary);
}

/* Detail card */
.detail-card {
  display: grid;
  grid-template-columns: 290px 1fr;
  gap: 26px;
  padding: 24px;
  border: 1px solid var(--color-line);
  border-radius: 18px;
  background: var(--color-card);
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.03);
}

.thumbnail-area {
  width: 100%;
}

.detail-thumbnail {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 16px;
  background: #e9e9e9;
}

.detail-info {
  min-width: 0;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 6px 12px;
  border: 1px solid var(--color-primary-border);
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
}

.title-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: start;
  margin-bottom: 4px;
}

.title-row h1 {
  font-size: 28px;
  line-height: 1.25;
  letter-spacing: -1px;
}

.bookmark-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 6px;
}

.bookmark-button {
  border: 0;
  background: transparent;
  font-size: 26px;
  color: #ccc;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  transition: color 0.15s, transform 0.1s;
}

.bookmark-button:hover:not(:disabled) {
  color: #f6bd16;
  transform: scale(1.15);
}

.bookmark-button.active {
  color: #f6bd16;
}

.bookmark-button:disabled {
  cursor: default;
}

.bookmark-count {
  font-size: 13px;
  color: var(--color-muted);
}

.info-table {
  width: 100%;
  margin-top: 20px;
  border-collapse: collapse;
  font-size: 15px;
}

.info-table th,
.info-table td {
  padding: 13px 8px;
  border-bottom: 1px solid var(--color-line);
  text-align: left;
}

.info-table th {
  width: 110px;
  color: var(--color-muted);
  font-weight: 600;
  white-space: nowrap;
}

.external-link {
  color: var(--color-primary);
}

.button-row {
  display: flex;
  gap: 10px;
  margin-top: 22px;
}

.chat-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 12px;
  padding: 11px 20px;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  min-height: 42px;
  background: var(--color-primary);
  color: #fff;
  cursor: not-allowed;
  opacity: 0.45;
}

/* Review section */
.review-section {
  margin-top: 20px;
  padding: 24px;
  border: 1px solid var(--color-line);
  border-radius: 18px;
  background: var(--color-card);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-head h2 {
  font-size: 20px;
  letter-spacing: -0.5px;
}

.review-write-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  background: var(--color-card);
  color: var(--color-muted);
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
