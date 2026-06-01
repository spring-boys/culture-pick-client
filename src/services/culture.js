import http from '@/api/http'

export const getCalendar = (year, month, params = {}) =>
  http.get('/api/v1/cultures', { params: { year, month, ...params } })

export const getDayList = (date, params = {}) =>
  http.get(`/api/v1/cultures/${date}`, { params })
