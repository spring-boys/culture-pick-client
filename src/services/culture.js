import http from '@/api/http'

export const getCalendar = (year, month, params = {}) =>
  http.get('/api/v1/cultures', { params: { year, month, ...params } })

export const getDayList = (date, params = {}) =>
  http.get(`/api/v1/cultures/date/${date}`, { params })

export const getCultureDetail = (id) =>
  http.get(`/api/v1/cultures/${id}`)
