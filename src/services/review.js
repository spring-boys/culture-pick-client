import http from '@/api/http'

export const getCultureReviews = (cultureId, page = 0, size = 5) =>
  http.get(`/api/v1/cultures/${cultureId}/reviews`, { params: { page, size } })

export const createReview = (cultureId, content) =>
  http.post(`/api/v1/cultures/${cultureId}/reviews`, { content })

export const updateReview = (reviewId, content) =>
  http.patch(`/api/v1/reviews/${reviewId}`, { content })

export const deleteReview = (reviewId) =>
  http.delete(`/api/v1/reviews/${reviewId}`)

export const getReviewSummary = (cultureId) =>
  http.get(`/api/v1/cultures/${cultureId}/reviews/summary`)
