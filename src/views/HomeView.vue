<script setup>
import { ref, computed, watch, onMounted, triggerRef } from 'vue'
import { getCalendar, getDayList } from '@/services/culture'
import { addBookmark, removeBookmark } from '@/services/bookmark'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const CATEGORIES = [
  { label: '분야 전체', value: '' },
  { label: '전시', value: 'EXHIBITION' },
  { label: '공연', value: 'PERFORMANCE' },
  { label: '교육/체험', value: 'EDUCATION' },
  { label: '행사/축제', value: 'FESTIVAL' },
]

const AREAS = [
  { label: '지역 전체', value: '' },
  ...['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
    '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
    .map(v => ({ label: v, value: v })),
]

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const today = new Date()
const todayStr = toDateStr(today)

const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth() + 1)

const keyword = ref('')
const selectedArea = ref('')
const selectedCategory = ref('')

const calendarData = ref([])
const calendarLoading = ref(false)

const bookmarkedIds = ref(new Set())

const modalOpen = ref(false)
const modalDate = ref(null)
const modalTotalCount = ref(0)
const modalItems = ref([])
const modalLoading = ref(false)
const modalHasNext = ref(false)
const modalCurrentPage = ref(0)

const monthTitle = computed(() =>
  `${currentYear.value}.${String(currentMonth.value).padStart(2, '0')}`
)

const calendarDays = computed(() => {
  const firstDate = new Date(currentYear.value, currentMonth.value - 1, 1)
  const startDay = firstDate.getDay()
  const daysInMonth = new Date(currentYear.value, currentMonth.value, 0).getDate()
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7
  const dayMap = new Map(calendarData.value.map(d => [d.date, d]))

  return Array.from({ length: totalCells }, (_, i) => {
    const dateObj = new Date(currentYear.value, currentMonth.value - 1, 1 - startDay + i)
    const dateStr = toDateStr(dateObj)
    const dayData = dayMap.get(dateStr)

    return {
      dateObj,
      dateStr,
      isCurrentMonth: dateObj.getMonth() === currentMonth.value - 1,
      isToday: dateStr === todayStr,
      totalCount: dayData?.totalCount ?? 0,
      cultures: dayData?.cultures ?? [],
    }
  })
})

const modalDateLabel = computed(() => {
  if (!modalDate.value) return ''
  const d = modalDate.value
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 문화행사`
})

function decodeHtml(str) {
  if (!str) return str
  const el = document.createElement('textarea')
  el.innerHTML = str
  return el.value
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildFilterParams() {
  const p = {}
  if (keyword.value.trim()) p.keyword = keyword.value.trim()
  if (selectedArea.value) p.area = selectedArea.value
  if (selectedCategory.value) p.category = selectedCategory.value
  return p
}

async function fetchCalendar() {
  calendarLoading.value = true
  try {
    const { data } = await getCalendar(currentYear.value, currentMonth.value, buildFilterParams())
    calendarData.value = data.map(day => ({
      ...day,
      cultures: day.cultures.map(c => ({ ...c, title: decodeHtml(c.title) })),
    }))
    const next = new Set(bookmarkedIds.value)
    calendarData.value.forEach(day =>
      day.cultures.forEach(c => { if (c.bookmarked) next.add(c.id) })
    )
    bookmarkedIds.value = next
  } catch {
    calendarData.value = []
  } finally {
    calendarLoading.value = false
  }
}

function moveMonth(offset) {
  let m = currentMonth.value + offset
  let y = currentYear.value
  if (m < 1) { y--; m = 12 }
  if (m > 12) { y++; m = 1 }
  currentYear.value = y
  currentMonth.value = m
}

async function openModal(cell) {
  modalDate.value = cell.dateObj
  modalTotalCount.value = cell.totalCount
  modalItems.value = []
  modalCurrentPage.value = 0
  modalHasNext.value = false
  modalOpen.value = true
  await fetchModalPage(0)
}

async function fetchModalPage(page) {
  modalLoading.value = true
  try {
    const { data } = await getDayList(toDateStr(modalDate.value), {
      ...buildFilterParams(),
      page,
      size: 20,
    })
    const decoded = data.content.map(item => ({
      ...item,
      title: decodeHtml(item.title),
      place: decodeHtml(item.place),
      area: decodeHtml(item.area),
      sigungu: decodeHtml(item.sigungu),
    }))
    if (page === 0) {
      modalItems.value = decoded
    } else {
      modalItems.value.push(...decoded)
    }
    modalCurrentPage.value = data.currentPage
    modalHasNext.value = data.hasNext
    const next = new Set(bookmarkedIds.value)
    decoded.forEach(item => { if (item.bookmarked) next.add(item.id) })
    bookmarkedIds.value = next
  } catch {
    // silent
  } finally {
    modalLoading.value = false
  }
}

function closeModal() {
  modalOpen.value = false
}

function syncBookmarkCount(cultureId, delta) {
  for (const day of calendarData.value) {
    const culture = day.cultures.find(c => c.id === cultureId)
    if (culture) {
      culture.bookmarkCount += delta
      day.cultures.sort((a, b) =>
        b.bookmarkCount - a.bookmarkCount || a.title.localeCompare(b.title, 'ko')
      )
    }
  }
  triggerRef(calendarData)

  const modalItem = modalItems.value.find(i => i.id === cultureId)
  if (modalItem) {
    modalItem.bookmarkCount += delta
    modalItems.value = [...modalItems.value].sort((a, b) =>
      b.bookmarkCount - a.bookmarkCount || a.title.localeCompare(b.title, 'ko')
    )
  }
}

async function toggleBookmark(cultureId) {
  if (!authStore.isLoggedIn) return

  const isBookmarked = bookmarkedIds.value.has(cultureId)
  const next = new Set(bookmarkedIds.value)
  const delta = isBookmarked ? -1 : 1

  if (isBookmarked) next.delete(cultureId)
  else next.add(cultureId)
  bookmarkedIds.value = next
  const fromModal = modalOpen.value
  syncBookmarkCount(cultureId, delta)

  try {
    if (isBookmarked) await removeBookmark(cultureId)
    else await addBookmark(cultureId)
    if (fromModal) fetchCalendar()
  } catch {
    const rollback = new Set(bookmarkedIds.value)
    if (isBookmarked) rollback.add(cultureId)
    else rollback.delete(cultureId)
    bookmarkedIds.value = rollback
    syncBookmarkCount(cultureId, -delta)
  }
}

watch([currentYear, currentMonth, selectedArea, selectedCategory], fetchCalendar)

onMounted(() => {
  if (authStore.checked) {
    fetchCalendar()
  } else {
    const stop = watch(() => authStore.checked, (val) => {
      if (val) {
        stop()
        fetchCalendar()
      }
    })
  }
})
</script>

<template>
  <main class="page-shell">
    <section class="search-panel" aria-label="조회 조건">
      <div class="search-box">
        <span class="search-icon">⌕</span>
        <input
          v-model="keyword"
          type="text"
          placeholder="문화행사명, 장소, 지역을 검색하세요."
          @keyup.enter="fetchCalendar"
        />
      </div>
      <div class="filter-group">
        <select v-model="selectedCategory" aria-label="분야 선택">
          <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <select v-model="selectedArea" aria-label="지역 선택">
          <option v-for="a in AREAS" :key="a.value" :value="a.value">{{ a.label }}</option>
        </select>
      </div>
    </section>

    <section class="calendar-card" aria-label="월간 문화행사 캘린더">
      <div class="calendar-toolbar">
        <button class="month-button" type="button" aria-label="이전 달" @click="moveMonth(-1)">‹</button>
        <h1>{{ monthTitle }}</h1>
        <button class="month-button" type="button" aria-label="다음 달" @click="moveMonth(1)">›</button>
      </div>

      <div class="weekday-grid" aria-hidden="true">
        <div v-for="day in WEEKDAYS" :key="day">{{ day }}</div>
      </div>

      <div class="calendar-grid" :class="{ loading: calendarLoading }">
        <article
          v-for="cell in calendarDays"
          :key="cell.dateStr"
          class="day-cell"
          :class="{ muted: !cell.isCurrentMonth }"
        >
          <div class="day-number" :class="{ 'today-number': cell.isToday }">{{ cell.dateObj.getDate() }}</div>
          <div class="event-list">
            <span v-if="cell.cultures.length === 0" class="empty-day">등록된 문화행사 없음</span>
            <div v-for="culture in cell.cultures" :key="culture.id" class="event-chip">
              <span class="event-title">{{ culture.title }}</span>
              <button
                type="button"
                class="bookmark-mini"
                :class="{ active: bookmarkedIds.has(culture.id) }"
                @click.stop="toggleBookmark(culture.id)"
              >{{ bookmarkedIds.has(culture.id) ? '★' : '☆' }} {{ culture.bookmarkCount }}</button>
            </div>
          </div>
          <button
            v-if="cell.totalCount > 3"
            type="button"
            class="more-button"
            @click="openModal(cell)"
          >
            ... 전체보기 ({{ cell.totalCount }})
          </button>
        </article>
      </div>
    </section>
  </main>

  <Teleport to="body">
    <div v-if="modalOpen" class="modal-backdrop" @click.self="closeModal">
      <section class="day-modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <h2>{{ modalDateLabel }}</h2>
            <p>총 {{ modalTotalCount }}개의 문화행사가 진행 중입니다.</p>
          </div>
          <button class="close-button" type="button" aria-label="모달 닫기" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <article v-for="item in modalItems" :key="item.id" class="modal-event-card">
            <img :src="item.thumbnail || ''" :alt="`${item.title} 썸네일`" />
            <div class="modal-event-info">
              <h3>{{ item.title }}</h3>
              <p>{{ item.category }} · {{ item.area }} {{ item.sigungu }}</p>
              <p>{{ item.startDate }} ~ {{ item.endDate }}</p>
              <p>{{ item.place }}</p>
            </div>
            <div class="modal-bookmark">
              <button
                type="button"
                class="bookmark-button"
                :class="{ active: bookmarkedIds.has(item.id) }"
                @click="toggleBookmark(item.id)"
              >{{ bookmarkedIds.has(item.id) ? '★' : '☆' }}</button>
              <span class="bookmark-count">{{ item.bookmarkCount }}</span>
            </div>
          </article>
          <div v-if="modalLoading" class="modal-status">불러오는 중...</div>
          <div v-else-if="!modalLoading && modalItems.length === 0" class="modal-status">문화행사가 없습니다.</div>
          <button
            v-if="modalHasNext && !modalLoading"
            type="button"
            class="load-more-button"
            @click="fetchModalPage(modalCurrentPage + 1)"
          >
            더 보기
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.page-shell {
  padding: 24px 32px 56px;
  min-width: 1100px;
}

/* Search panel */
.search-panel {
  display: grid;
  grid-template-columns: 1fr 440px;
  gap: 14px;
  margin-bottom: 14px;
}

.search-box,
.filter-group {
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: 14px;
  min-height: 62px;
}

.search-box {
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 10px;
}

.search-icon {
  font-size: 28px;
  color: #999;
  transform: rotate(-20deg);
}

.search-box input {
  flex: 1;
  border: 0;
  outline: none;
  font-size: 15px;
  font-family: inherit;
  background: transparent;
}

.filter-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  overflow: hidden;
}

.filter-group select {
  border: 0;
  border-right: 1px solid var(--color-line);
  padding: 0 36px 0 16px;
  font-size: 14px;
  color: #555;
  background: var(--color-card);
  outline: none;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
}

.filter-group select:last-child {
  border-right: 0;
}

/* Calendar card */
.calendar-card {
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: 16px;
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.calendar-toolbar {
  height: 74px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  border-bottom: 1px solid var(--color-line);
}

.calendar-toolbar h1 {
  margin: 0;
  min-width: 160px;
  text-align: center;
  color: var(--color-primary);
  font-size: 30px;
  font-weight: 900;
}

.month-button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-line);
  background: var(--color-card);
  border-radius: 50%;
  font-size: 22px;
  color: var(--color-muted);
  transition:
    border-color 0.15s,
    color 0.15s;
}

.month-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.weekday-grid,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-grid > div {
  padding: 9px 0;
  background: #efefef;
  border-right: 1px solid var(--color-line);
  text-align: center;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 800;
}

.calendar-grid.loading {
  opacity: 0.5;
  pointer-events: none;
}

.day-cell {
  min-height: 166px;
  padding: 8px;
  border-right: 1px solid #eee;
  border-bottom: 1px solid #eee;
  background: var(--color-card);
}

.day-cell.muted {
  color: #aaa;
}

.day-number {
  display: flex;
  align-items: center;
  height: 24px;
  margin-bottom: 7px;
  color: #555;
  font-size: 13px;
  font-weight: 800;
}

.today-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--color-primary);
  color: #fff;
  border-radius: 50%;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.event-chip {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 6px 7px;
  border: 1px solid var(--color-primary-border);
  background: var(--color-primary-soft);
  border-radius: 9px;
}

.event-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #333;
  font-size: 12px;
}

.bookmark-mini {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 11px;
  color: var(--color-muted);
  white-space: nowrap;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.15s;
}

.bookmark-mini.active {
  color: #f6bd16;
}

.more-button {
  width: 100%;
  margin-top: 7px;
  border: 1px dashed var(--color-primary-border);
  color: var(--color-primary);
  background: var(--color-card);
  border-radius: 9px;
  padding: 7px;
  font-size: 12px;
  font-family: inherit;
  transition: background 0.15s;
}

.more-button:hover {
  background: var(--color-primary-soft);
}

.empty-day {
  color: #b5b5b5;
  font-size: 12px;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  padding: 48px 20px;
  background: rgba(0, 0, 0, 0.42);
}

.day-modal {
  max-width: 880px;
  max-height: 84vh;
  margin: 0 auto;
  background: var(--color-card);
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-line);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-shrink: 0;
}

.modal-header h2 {
  margin: 0 0 5px;
  font-size: 22px;
}

.modal-header p {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
}

.close-button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: #f0f0f0;
  font-size: 20px;
  flex-shrink: 0;
  transition: background 0.15s;
}

.close-button:hover {
  background: var(--color-line);
}

.modal-body {
  padding: 12px 24px 24px;
  overflow-y: auto;
}

.modal-event-card {
  display: grid;
  grid-template-columns: 78px 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-line);
}

.modal-event-card img {
  width: 78px;
  height: 100px;
  object-fit: cover;
  border-radius: 12px;
  background: #eee;
}

.modal-event-info h3 {
  margin: 0 0 8px;
  font-size: 17px;
}

.modal-event-info p {
  margin: 4px 0;
  color: #666;
  font-size: 13px;
}

.modal-bookmark {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.bookmark-button {
  border: 0;
  background: transparent;
  font-size: 22px;
  color: #ccc;
  line-height: 1;
  padding: 0;
  transition: color 0.15s, transform 0.1s;
}

.bookmark-button:hover {
  color: #f6bd16;
  transform: scale(1.15);
}

.bookmark-button.active {
  color: #f6bd16;
}

.bookmark-count {
  font-size: 12px;
  color: var(--color-muted);
}

.modal-status {
  padding: 32px 0;
  text-align: center;
  color: var(--color-muted);
  font-size: 14px;
}

.load-more-button {
  display: block;
  width: 100%;
  padding: 12px;
  margin-top: 12px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--color-card);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.15s;
}

.load-more-button:hover {
  background: var(--color-primary-soft);
}
</style>
