import http from '@/api/http'

export const addBookmark = (cultureId) =>
  http.post(`/api/v1/cultures/${cultureId}/bookmark`)

export const removeBookmark = (cultureId) =>
  http.delete(`/api/v1/cultures/${cultureId}/bookmark`)
