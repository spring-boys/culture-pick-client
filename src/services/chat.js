import http from '@/api/http'

export const joinChatRoom = (chatRoomId) =>
  http.post(`/api/v1/chat-rooms/${chatRoomId}/join`)

export const getChatMessages = (chatRoomId) =>
  http.get(`/api/v1/chat-rooms/${chatRoomId}/messages`)

export const sendChatMessageByHttp = (chatRoomId, content) =>
  http.post(`/api/v1/chat-rooms/${chatRoomId}/messages`, { content })

export const deleteChatMessage = (chatRoomId, messageId) =>
  http.delete(`/api/v1/chat-rooms/${chatRoomId}/messages/${messageId}`)

export const getMyChatRooms = () =>
  http.get('/api/v1/mypage/chat-rooms')

export const getMyPage = () =>
  http.get('/api/v1/mypage')
