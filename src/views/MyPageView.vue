<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getMyPage, updateMemberInfo, getBookmarkedCultures, getMyChatRooms } from '@/services/mypage'

const router = useRouter()
const authStore = useAuthStore()

const CATEGORY_LABELS = {
  EXHIBITION: '전시',
  PERFORMANCE: '공연',
  EDUCATION: '교육/체험',
  FESTIVAL: '행사/축제',
}

const loading = ref(true)

// 내 정보
const memberInfo = ref(null)
const nicknameInput = ref('')
const isEditing = ref(false)
const saving = ref(false)

// 즐겨찾기
const bookmarks = ref([])
const currentPage = ref(0)
const totalPages = ref(0)
const bookmarkLoading = ref(false)

// 채팅방
const chatRooms = ref([])

const hasPrev = computed(() => currentPage.value > 0)
const hasNext = computed(() => currentPage.value < totalPages.value - 1)

async function fetchAll() {
  loading.value = true
  try {
    const [infoRes, chatRes] = await Promise.all([
      getMyPage(),
      getMyChatRooms(),
    ])
    memberInfo.value = infoRes.data
    nicknameInput.value = infoRes.data.nickname
    chatRooms.value = chatRes.data
    await fetchBookmarks(0)
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

async function fetchBookmarks(page) {
  bookmarkLoading.value = true
  try {
    const { data } = await getBookmarkedCultures(page)
    bookmarks.value = data.content
    currentPage.value = data.currentPage
    totalPages.value = data.totalPages
  } catch {
    bookmarks.value = []
  } finally {
    bookmarkLoading.value = false
  }
}

function startEdit() {
  isEditing.value = true
}

function cancelEdit() {
  nicknameInput.value = memberInfo.value.nickname
  isEditing.value = false
}

async function saveInfo() {
  if (!nicknameInput.value.trim()) return
  saving.value = true
  try {
    await updateMemberInfo(nicknameInput.value.trim())
    memberInfo.value.nickname = nicknameInput.value.trim()
    isEditing.value = false
  } catch {
    // silent
  } finally {
    saving.value = false
  }
}

function formatLastMessage(dateStr) {
  if (!dateStr) return '최근 메시지 없음'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

onMounted(fetchAll)
</script>

<template>
  <main class="page-shell">
    <section class="page-header">
      <h1>마이페이지</h1>
    </section>

    <div v-if="loading" class="loading-state">불러오는 중...</div>

    <div v-else class="mypage-grid">
      <!-- 내 정보 -->
      <aside class="profile-card">
        <h2>내 정보</h2>

        <div class="field">
          <label>이메일</label>
          <input type="email" :value="memberInfo?.email" readonly />
        </div>

        <div class="field">
          <label>닉네임</label>
          <input
            v-model="nicknameInput"
            type="text"
            :readonly="!isEditing"
            :class="{ editable: isEditing }"
          />
        </div>

        <div class="button-row">
          <template v-if="!isEditing">
            <button class="btn-secondary" type="button" @click="startEdit">정보 수정</button>
          </template>
          <template v-else>
            <button class="btn-primary" type="button" :disabled="saving" @click="saveInfo">
              {{ saving ? '저장 중...' : '저장' }}
            </button>
            <button class="btn-ghost" type="button" @click="cancelEdit">취소</button>
          </template>
        </div>
      </aside>

      <div class="content-col">
        <!-- 즐겨찾기 -->
        <section class="list-card">
          <div class="section-head">
            <h2>즐겨찾기한 문화행사</h2>
            <div class="page-nav" v-if="totalPages > 1">
              <button
                class="nav-btn"
                type="button"
                :disabled="!hasPrev || bookmarkLoading"
                aria-label="이전 페이지"
                @click="fetchBookmarks(currentPage - 1)"
              >‹</button>
              <span class="page-label">{{ currentPage + 1 }} / {{ totalPages }}</span>
              <button
                class="nav-btn"
                type="button"
                :disabled="!hasNext || bookmarkLoading"
                aria-label="다음 페이지"
                @click="fetchBookmarks(currentPage + 1)"
              >›</button>
            </div>
          </div>

          <div v-if="bookmarkLoading" class="empty-state">불러오는 중...</div>
          <div v-else-if="bookmarks.length === 0" class="empty-state">
            아직 즐겨찾기한 문화행사가 없습니다.
          </div>
          <div v-else class="bookmark-grid" :class="{ loading: bookmarkLoading }">
            <button
              v-for="item in bookmarks"
              :key="item.id"
              type="button"
              class="culture-card"
              @click="router.push({ name: 'culture-detail', params: { id: item.id } })"
            >
              <img :src="item.thumbnail || ''" :alt="item.title" />
              <div class="culture-info">
                <h3>{{ item.title }}</h3>
                <p>{{ item.place }}</p>
                <p class="meta">
                  <span class="category-badge">{{ CATEGORY_LABELS[item.category] ?? item.category }}</span>
                  {{ item.area }} {{ item.sigungu }}
                </p>
                <p class="bookmark-count">★ {{ item.bookmarkCount }}</p>
              </div>
            </button>
          </div>
        </section>

        <!-- 채팅방 -->
        <section class="list-card">
          <div class="section-head">
            <h2>참여 중인 채팅방</h2>
          </div>

          <div v-if="chatRooms.length === 0" class="empty-state">
            참여 중인 채팅방이 없습니다.
          </div>
          <div v-else class="chat-grid">
            <button
              v-for="room in chatRooms"
              :key="room.id"
              type="button"
              class="chat-card"
              @click="router.push({ name: 'chat-room', params: { chatRoomId: room.id } })"
            >
              <strong>{{ room.cultureTitle }}</strong>
              <span class="chat-name">{{ room.name }}</span>
              <span class="chat-time">{{ formatLastMessage(room.lastMessageAt) }}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.page-shell {
  padding: 24px 32px 56px;
  min-width: 1100px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.8px;
  color: var(--color-text);
}

.page-header p {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
}

.loading-state {
  padding: 80px 0;
  text-align: center;
  color: var(--color-muted);
  font-size: 15px;
}

/* Grid layout */
.mypage-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 18px;
  align-items: start;
}

.content-col {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Card base */
.profile-card,
.list-card {
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: 18px;
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.03);
  padding: 24px;
}

/* 내 정보 */
.profile-card h2 {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text);
}

.field {
  margin-bottom: 14px;
}

.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.field input {
  width: 100%;
  padding: 10px 13px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text);
  background: #fafafa;
  outline: none;
  transition: border-color 0.15s;
}

.field input.editable {
  background: var(--color-card);
  border-color: var(--color-primary);
}

.button-row {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}

.btn-primary,
.btn-secondary,
.btn-ghost {
  padding: 9px 18px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: 1px solid var(--color-primary);
}

.btn-primary:hover:not(:disabled) {
  background: #3fa374;
  border-color: #3fa374;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn-secondary {
  background: var(--color-card);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-border);
}

.btn-secondary:hover {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.btn-ghost {
  background: var(--color-card);
  color: var(--color-muted);
  border: 1px solid var(--color-line);
}

.btn-ghost:hover {
  background: #f0f0f0;
}

/* Section head */
.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-head h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text);
}

.section-head p {
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
}

/* Pagination */
.page-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.nav-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-line);
  background: var(--color-card);
  border-radius: 50%;
  font-size: 20px;
  color: var(--color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.nav-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.page-label {
  font-size: 13px;
  color: var(--color-muted);
  min-width: 40px;
  text-align: center;
}

/* Empty state */
.empty-state {
  padding: 32px 0;
  text-align: center;
  color: var(--color-muted);
  font-size: 14px;
}

/* Bookmark grid */
.bookmark-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.bookmark-grid.loading {
  opacity: 0.5;
  pointer-events: none;
}

.culture-card {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 11px;
  align-items: start;
  padding: 12px;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  background: var(--color-card);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s, background 0.15s;
}

.culture-card:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.culture-card img {
  width: 64px;
  height: 82px;
  object-fit: cover;
  border-radius: 10px;
  background: #eee;
  flex-shrink: 0;
}

.culture-info h3 {
  margin: 0 0 5px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--color-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.culture-info p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.category-badge {
  display: inline-block;
  padding: 1px 7px;
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary-border);
  border-radius: 999px;
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 700;
  white-space: nowrap;
}

.bookmark-count {
  font-size: 11px;
  color: #f6bd16;
  font-weight: 700;
}

/* Chat grid */
.chat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.chat-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px 16px;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  background: var(--color-card);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s, background 0.15s;
}

.chat-card:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.chat-card strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chat-name {
  font-size: 13px;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-time {
  font-size: 12px;
  color: var(--color-muted);
}
</style>
