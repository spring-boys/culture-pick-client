<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { deleteChatMessage, getChatMessages, getMyPage, joinChatRoom, sendChatMessageByHttp } from '@/services/chat'
import { createChatSocket } from '@/services/chatSocket'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const chatRoomId = computed(() => route.params.chatRoomId)
const messages = ref([])
const messageText = ref('')
const loading = ref(true)
const sending = ref(false)
const connected = ref(false)
const errorMessage = ref('')
const messageListRef = ref(null)
const currentMemberId = ref(null)
let chatSocket = null

function isMyMessage(message) {
  return currentMemberId.value !== null && Number(message.senderId) === Number(currentMemberId.value)
}

function formatTime(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function scrollToBottom() {
  await nextTick()
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

function handleSocketEvent(event) {
  if (!event?.type || !event?.message) return

  if (event.type === 'MESSAGE_CREATED') {
    const exists = messages.value.some((message) => message.id === event.message.id)
    if (!exists) {
      messages.value.push(event.message)
      scrollToBottom()
    }
    return
  }

  if (event.type === 'MESSAGE_DELETED') {
    messages.value = messages.value.map((message) =>
      message.id === event.message.id ? event.message : message,
    )
  }
}

function connectSocket() {
  if (!authStore.accessToken) {
    router.replace('/login')
    return
  }

  chatSocket = createChatSocket({
    chatRoomId: chatRoomId.value,
    accessToken: authStore.accessToken,
    onConnect: () => {
      connected.value = true
    },
    onEvent: handleSocketEvent,
    onError: (error) => {
      errorMessage.value = error.message || 'WebSocket 연결 중 문제가 발생했습니다.'
    },
  })

  chatSocket.connect()
}

async function loadChatRoom() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data: myPage } = await getMyPage()
    currentMemberId.value = myPage.memberId
    await joinChatRoom(chatRoomId.value)
    const { data } = await getChatMessages(chatRoomId.value)
    messages.value = data
    await scrollToBottom()
    connectSocket()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || '채팅방 정보를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

async function handleSendMessage() {
  const content = messageText.value.trim()
  if (!content || sending.value) return

  sending.value = true
  errorMessage.value = ''

  try {
    if (chatSocket?.isConnected()) {
      chatSocket.sendMessage(content)
    } else {
      const { data } = await sendChatMessageByHttp(chatRoomId.value, content)
      handleSocketEvent({ type: 'MESSAGE_CREATED', message: data })
    }
    messageText.value = ''
  } catch (error) {
    errorMessage.value = error.response?.data?.message || '메시지 전송에 실패했습니다.'
  } finally {
    sending.value = false
  }
}

async function handleDeleteMessage(message) {
  if (!isMyMessage(message) || message.deleted) return
  if (!window.confirm('메시지를 삭제할까요?')) return

  try {
    await deleteChatMessage(chatRoomId.value, message.id)

    if (!chatSocket?.isConnected()) {
      messages.value = messages.value.map((item) =>
        item.id === message.id
          ? {
              ...item,
              content: '삭제된 메시지입니다.',
              deleted: true,
              deletedAt: new Date().toISOString(),
            }
          : item,
      )
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || '메시지 삭제에 실패했습니다.'
  }
}

onMounted(loadChatRoom)

onBeforeUnmount(() => {
  chatSocket?.disconnect()
})
</script>

<template>
  <main class="chat-page">
    <section class="chat-panel">
      <div class="chat-header">
        <div>
          <h1>문화행사 채팅방 #{{ chatRoomId }}</h1>
          <p>같은 문화행사에 관심 있는 사용자들과 실시간으로 정보를 공유합니다.</p>
        </div>
        <button class="secondary-button" type="button" @click="router.back()">이전 화면</button>
      </div>

      <div v-if="errorMessage" class="notice error">{{ errorMessage }}</div>
      <div v-else-if="loading" class="notice">채팅방을 불러오는 중입니다.</div>

      <div ref="messageListRef" class="message-list">
        <p v-if="!loading && messages.length === 0" class="empty-message">
          아직 메시지가 없습니다. 첫 메시지를 남겨보세요.
        </p>

        <div
          v-for="message in messages"
          :key="message.id"
          class="message-row"
          :class="{ me: isMyMessage(message) }"
        >
          <div class="message-bubble" :class="{ deleted: message.deleted }">
            <div class="message-meta">
              <span class="message-name">{{ message.senderNickname }}</span>
              <span class="message-time">{{ formatTime(message.createdAt) }}</span>
            </div>
            <p class="message-content">{{ message.content }}</p>
            <button
              v-if="isMyMessage(message) && !message.deleted"
              class="delete-button"
              type="button"
              @click="handleDeleteMessage(message)"
            >
              삭제
            </button>
          </div>
        </div>
      </div>

      <form class="message-form" @submit.prevent="handleSendMessage">
        <input
          v-model="messageText"
          type="text"
          maxlength="1000"
          placeholder="메시지를 입력하세요."
          :disabled="loading"
        />
        <button class="primary-button" type="submit" :disabled="loading || sending || !messageText.trim()">
          {{ sending ? '전송 중' : '전송' }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.chat-page {
  min-height: calc(100vh - 64px);
  padding: 24px 32px 56px;
  background: var(--color-bg);
  display: flex;
  justify-content: center;
}

.chat-panel {
  width: 980px;
  height: calc(100vh - 120px);
  min-height: 620px;
  border: 1px solid var(--color-line);
  border-radius: 18px;
  background: var(--color-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.chat-header h1 {
  margin: 0 0 6px;
  font-size: 24px;
  color: var(--color-text);
}

.chat-header p {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
}

.notice {
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-line);
  font-size: 14px;
  color: var(--color-muted);
  background: var(--color-primary-soft);
}

.notice.error {
  color: #d33;
  background: #fff1f1;
}

.message-list {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  background: #fafafa;
}

.empty-message {
  text-align: center;
  color: var(--color-muted);
  font-size: 14px;
  margin-top: 180px;
}

.message-row {
  display: flex;
  margin-bottom: 12px;
}

.message-row.me {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 62%;
  padding: 12px 14px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid var(--color-line);
  line-height: 1.45;
  font-size: 14px;
  color: var(--color-text);
}

.message-row.me .message-bubble {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.message-bubble.deleted {
  opacity: 0.65;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-name {
  font-weight: 700;
  font-size: 12px;
  color: #777;
}

.message-row.me .message-name,
.message-row.me .message-time {
  color: #fff9;
}

.message-time {
  font-size: 11px;
  color: #aaa;
}

.message-content {
  margin: 0;
  word-break: break-word;
  white-space: pre-wrap;
}

.delete-button {
  margin-top: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  opacity: 0.75;
  font-size: 11px;
  cursor: pointer;
}

.delete-button:hover {
  opacity: 1;
  text-decoration: underline;
}

.message-form {
  display: grid;
  grid-template-columns: 1fr 90px;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid var(--color-line);
}

.message-form input {
  height: 44px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  padding: 0 14px;
  font-size: 14px;
  outline: none;
}

.message-form input:focus {
  border-color: var(--color-primary);
}

.primary-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  min-height: 42px;
  font-family: inherit;
  cursor: pointer;
}

.primary-button {
  border: 0;
  background: var(--color-primary);
  color: #fff;
}

.primary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-button {
  border: 1px solid var(--color-line);
  background: #fff;
  color: #333;
}
</style>
