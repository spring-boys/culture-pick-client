import { Client } from '@stomp/stompjs'

function getWebSocketUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되어 있지 않습니다.')
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  const protocol = normalizedBaseUrl.startsWith('https') ? 'wss' : 'ws'
  return normalizedBaseUrl.replace(/^https?/, protocol) + '/ws'
}

export function createChatSocket({ chatRoomId, accessToken, onEvent, onConnect, onError }) {
  const client = new Client({
    brokerURL: getWebSocketUrl(),
    connectHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
    reconnectDelay: 3000,
    debug: () => {},
    onConnect: () => {
      client.subscribe(`/topic/chat-rooms/${chatRoomId}`, (message) => {
        try {
          onEvent?.(JSON.parse(message.body))
        } catch (error) {
          onError?.(error)
        }
      })
      onConnect?.()
    },
    onStompError: (frame) => {
      onError?.(new Error(frame.headers.message || 'WebSocket STOMP 오류가 발생했습니다.'))
    },
    onWebSocketError: () => {
      onError?.(new Error('WebSocket 연결에 실패했습니다.'))
    },
  })

  return {
    connect() {
      client.activate()
    },
    disconnect() {
      client.deactivate()
    },
    isConnected() {
      return client.connected
    },
    sendMessage(content) {
      client.publish({
        destination: `/app/chat-rooms/${chatRoomId}/messages`,
        body: JSON.stringify({ content }),
      })
    },
  }
}
