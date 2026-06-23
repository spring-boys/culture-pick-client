<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCultureDetail } from '@/services/culture'
import { addBookmark, removeBookmark } from '@/services/bookmark'
import {
  getCultureReviews,
  createReview,
  updateReview,
  deleteReview,
  getReviewSummary,
} from '@/services/review'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const culture = ref(null)
const loading = ref(true)
const bookmarked = ref(false)
const bookmarkCount = ref(0)
const reviews = ref([])
const reviewLoading = ref(false)
const reviewError = ref('')
const reviewContent = ref('')
const reviewSubmitting = ref(false)
const editingReviewId = ref(null)
const summaryText = ref('')
const summaryLoading = ref(false)
const summaryError = ref('')

const reviewContainer = ref(null)
const currentPage = ref(0)
const hasNext = ref(false)
const pageSize = ref(5)
let resizeObserver = null

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

// loading=false 후 DOM에 reviewContainer가 마운트되면 pageSize 계산 및 초기 리뷰 fetch
watch(reviewContainer, (el) => {
  if (!el) return
  pageSize.value = Math.max(1, Math.floor((el.offsetWidth + 14) / (270 + 14)))
  fetchReviews(culture.value?.id, 0)
  if (resizeObserver) resizeObserver.disconnect()
  resizeObserver = new ResizeObserver(computePageSize)
  resizeObserver.observe(el)
})

async function fetchReviews(cultureId = culture.value?.id, page = currentPage.value) {
  if (!cultureId) return

  reviewLoading.value = true
  reviewError.value = ''

  try {
    const { data } = await getCultureReviews(cultureId, page, pageSize.value)
    reviews.value = Array.isArray(data.content) ? data.content : []
    hasNext.value = data.hasNext ?? false
    currentPage.value = data.currentPage ?? page
  } catch {
    reviewError.value = '리뷰를 불러오지 못했습니다.'
  } finally {
    reviewLoading.value = false
  }
}

function computePageSize() {
  if (!reviewContainer.value) return
  const containerWidth = reviewContainer.value.offsetWidth
  const cardWidth = 270
  const gap = 14
  const computed = Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)))
  if (computed !== pageSize.value) {
    pageSize.value = computed
    currentPage.value = 0
    fetchReviews(culture.value?.id, 0)
  }
}

async function goToPage(page) {
  if (page < 0 || reviewLoading.value) return
  await fetchReviews(culture.value?.id, page)
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

function formatReviewDate(date) {
  if (!date) return '-'

  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '-'

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

function openReviewForm() {
  if (!authStore.isLoggedIn) return

  reviewError.value = ''
  reviewContent.value = ''
  editingReviewId.value = ''
}

function editReview(review) {
  reviewError.value = ''
  reviewContent.value = review.content || ''
  editingReviewId.value = review.id
}

function cancelReviewForm() {
  reviewContent.value = ''
  editingReviewId.value = null
}

async function submitReview() {
  const content = reviewContent.value.trim()
  if (!content || reviewSubmitting.value) return

  reviewSubmitting.value = true
  reviewError.value = ''

  try {
    if (editingReviewId.value) {
      await updateReview(editingReviewId.value, content)
    } else {
      await createReview(culture.value.id, content)
    }

    cancelReviewForm()
    await fetchReviews()
  } catch {
    reviewError.value = editingReviewId.value
      ? '리뷰 수정에 실패했습니다.'
      : '리뷰 등록에 실패했습니다.'
  } finally {
    reviewSubmitting.value = false
  }
}

async function removeReview(reviewId) {
  if (!window.confirm('리뷰를 삭제하시겠습니까?')) return

  reviewSubmitting.value = true
  reviewError.value = ''

  try {
    await deleteReview(reviewId)
    if (editingReviewId.value === reviewId) cancelReviewForm()
    await fetchReviews()
  } catch {
    reviewError.value = '리뷰 삭제에 실패했습니다.'
  } finally {
    reviewSubmitting.value = false
  }
}

async function fetchSummary() {
  if (summaryLoading.value) return

  summaryLoading.value = true
  summaryText.value = ''
  summaryError.value = ''

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
    const headers = {}
    if (authStore.accessToken) headers['Authorization'] = `Bearer ${authStore.accessToken}`

    const response = await fetch(
      `${baseUrl}/api/v1/cultures/${culture.value.id}/reviews/summary/stream`,
      { headers },
    )

    if (!response.ok) throw new Error()

    summaryLoading.value = false

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (line.startsWith('data:')) {
          summaryText.value += line.slice(5)
        }
      }
    }
  } catch {
    summaryError.value = 'AI 요약을 불러오지 못했습니다.'
  } finally {
    summaryLoading.value = false
  }
}

function closeSummary() {
  summaryText.value = ''
  summaryError.value = ''
}

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

function goToChatRoom() {
  if (!culture.value?.chatRoomId) return
  router.push(`/chat-rooms/${culture.value.chatRoomId}`)
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
            <button
              type="button"
              class="chat-button"
              :disabled="!culture.chatRoomId"
              @click="goToChatRoom"
            >채팅방 바로가기</button>
          </div>
        </div>
      </section>

      <section class="review-section">
        <div class="section-head">
          <h2>사용자 리뷰</h2>
          <div class="section-head-actions">
            <button
              type="button"
              class="summary-button"
              :disabled="summaryLoading"
              @click="fetchSummary"
            >
              <span class="summary-icon">✦</span>
              {{ summaryLoading ? '요약 중...' : 'AI 요약' }}
            </button>
            <button
              type="button"
              class="review-write-button"
              :disabled="!authStore.isLoggedIn || reviewSubmitting"
              @click="openReviewForm"
            >리뷰 작성하기</button>
          </div>
        </div>

        <div v-if="summaryText || summaryError" class="summary-box">
          <div class="summary-box-head">
            <span class="summary-box-label">✦ AI 리뷰 요약</span>
            <button type="button" class="summary-close" @click="closeSummary">✕</button>
          </div>
          <p v-if="summaryError" class="summary-error">{{ summaryError }}</p>
          <p v-else class="summary-text">{{ summaryText }}</p>
        </div>

        <form v-if="editingReviewId !== null" class="review-form" @submit.prevent="submitReview">
          <textarea
            v-model="reviewContent"
            maxlength="500"
            placeholder="방문 후기를 작성해주세요."
          ></textarea>
          <div class="review-form-foot">
            <span class="review-count">{{ reviewContent.length }}/500</span>
            <div class="review-form-actions">
              <button
                type="submit"
                class="review-submit-button"
                :disabled="!reviewContent.trim() || reviewSubmitting"
              >{{ editingReviewId ? '수정 완료' : '등록' }}</button>
              <button
                type="button"
                class="review-cancel-button"
                :disabled="reviewSubmitting"
                @click="cancelReviewForm"
              >취소</button>
            </div>
          </div>
        </form>

        <p v-if="reviewError" class="review-message error">{{ reviewError }}</p>

        <div class="review-paginator">
          <button
            class="nav-btn"
            :disabled="currentPage === 0 || reviewLoading"
            @click="goToPage(currentPage - 1)"
          >‹</button>

          <div ref="reviewContainer" class="review-scroll" :class="{ 'is-loading': reviewLoading }">
            <p v-if="reviewLoading && reviews.length === 0" class="review-message">리뷰를 불러오는 중...</p>
            <p v-else-if="!reviewLoading && !reviewError && reviews.length === 0" class="review-message">아직 작성된 리뷰가 없습니다.</p>
            <template v-else-if="reviews.length > 0">
              <article v-for="review in reviews" :key="review.id" class="review-card">
                <div class="review-card-head">
                  <strong>{{ review.memberNickname || '사용자' }}</strong>
                </div>
                <p class="review-content">{{ review.content }}</p>
                <div class="review-card-foot">
                  <time>{{ formatReviewDate(review.createdAt) }}</time>
                  <div v-if="review.mine === true" class="review-card-actions">
                    <button
                      type="button"
                      :disabled="reviewSubmitting"
                      @click="editReview(review)"
                    >수정</button>
                    <button
                      type="button"
                      :disabled="reviewSubmitting"
                      @click="removeReview(review.id)"
                    >삭제</button>
                  </div>
                </div>
              </article>
            </template>
          </div>

          <button
            class="nav-btn"
            :disabled="!hasNext || reviewLoading"
            @click="goToPage(currentPage + 1)"
          >›</button>
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
  transition:
    background 0.2s ease,
    transform 0.2s ease;
}

.chat-button:not(:disabled) {
  cursor: pointer;
  opacity: 1;
}

.chat-button:hover:not(:disabled) {
  background: #e85f2f;
  transform: translateY(-1px);
}

/* Review section */
.review-section {
  margin-top: 24px;
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
  cursor: pointer;
}

.review-write-button:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.review-write-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.review-form {
  margin-top: 18px;
}

.review-form textarea {
  width: 100%;
  min-height: 96px;
  resize: vertical;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  padding: 14px;
  font-size: 14px;
  line-height: 1.6;
  font-family: inherit;
  color: inherit;
  background: #fff;
}

.review-form textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.review-form-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.review-count,
.review-message,
.review-card-foot {
  color: var(--color-muted);
  font-size: 13px;
}

.review-form-actions,
.review-card-actions {
  display: flex;
  gap: 8px;
}

.review-submit-button,
.review-cancel-button,
.review-card-actions button {
  border: 1px solid var(--color-line);
  border-radius: 10px;
  padding: 7px 12px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  background: #fff;
  color: inherit;
  cursor: pointer;
}

.review-submit-button {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.review-submit-button:disabled,
.review-cancel-button:disabled,
.review-card-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.review-message {
  margin-top: 18px;
}

.review-message.error {
  color: var(--color-primary);
}

.review-paginator {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 18px;
}

.nav-btn {
  flex: 0 0 32px;
  height: 32px;
  align-self: center;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: var(--color-card);
  color: var(--color-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  padding: 0;
}

.nav-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.review-scroll {
  flex: 1;
  display: flex;
  gap: 14px;
  min-width: 0;
  overflow: hidden;
  transition: opacity 0.15s;
}

.review-scroll.is-loading {
  opacity: 0.45;
  pointer-events: none;
}

.review-card {
  display: flex;
  flex: 0 0 270px;
  flex-direction: column;
  min-height: 136px;
  padding: 16px;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: #fff;
}

.review-card-head {
  font-size: 14px;
}

.review-content {
  flex: 1;
  margin: 12px 0;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.review-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.review-card-actions button:hover:not(:disabled),
.review-cancel-button:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.section-head-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.summary-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--color-primary-border);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.summary-button:hover:not(:disabled) {
  background: var(--color-primary);
  color: #fff;
  transform: translateY(-1px);
}

.summary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.summary-icon {
  font-size: 11px;
}

.summary-box {
  margin-top: 16px;
  padding: 18px 20px;
  border: 1px solid var(--color-primary-border);
  border-radius: 14px;
  background: var(--color-primary-soft);
}

.summary-box-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.summary-box-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.2px;
}

.summary-close {
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.summary-close:hover {
  color: var(--color-primary);
}

.summary-text {
  font-size: 14px;
  line-height: 1.75;
  color: var(--color-text, #333);
  white-space: pre-wrap;
  word-break: break-word;
}

.summary-error {
  font-size: 14px;
  color: var(--color-primary);
}
</style>
