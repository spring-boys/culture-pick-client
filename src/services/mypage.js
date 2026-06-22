import http from '@/api/http'

export const getMyPage = () =>
  http.get('/api/v1/mypage')

export const updateMemberInfo = (nickname) =>
  http.put('/api/v1/mypage', { nickname })

export const getBookmarkedCultures = (page = 0) =>
  http.get('/api/v1/mypage/bookmarks', { params: { page } })

export const getMyChatRooms = () =>
  http.get('/api/v1/mypage/chat-rooms')
