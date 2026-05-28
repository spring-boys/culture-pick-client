import http from '@/api/http'

export const login = (email, password) =>
  http.post('/api/v1/auth/login', { email, password })

export const signup = (email, password, nickname) =>
  http.post('/api/v1/auth/signup', { email, password, nickname })

export const logout = () =>
  http.delete('/api/v1/auth/logout')

export const regenerate = () =>
  http.post('/api/v1/auth/regenerate')

export const sendCode = (email) =>
  http.post('/api/v1/auth/email/code', { email })

export const verifyCode = (email, code) =>
  http.post('/api/v1/auth/email/verification', { email, code })
