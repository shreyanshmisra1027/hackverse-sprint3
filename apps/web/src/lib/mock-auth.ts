export type MockUser = {
  vitEmail: string
  username: string
  password: string
  verified: boolean
}

const USER_KEY = 'inevitable-mock-user'
const SESSION_KEY = 'inevitable-mock-session'
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:10000').replace(/\/$/, '')

async function api(path: string, body?: unknown) {
  const response = await fetch(`${API_URL}${path}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(localStorage.getItem(SESSION_KEY) ? { authorization: `Bearer ${localStorage.getItem(SESSION_KEY)}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Authentication request failed.')
  return data
}

export function saveMockUser(user: MockUser) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getMockUser(): MockUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as MockUser } catch { return null }
}

export async function signInMock(email: string, password: string, _remember: boolean) {
  const result = await api('/api/auth/login', { email, password })
  window.localStorage.setItem(SESSION_KEY, result.token)
  saveMockUser({ vitEmail: result.user.email, username: result.user.username, password: '', verified: result.user.verified })
  return true
}

export function isSignedIn() {
  return Boolean(window.localStorage.getItem(SESSION_KEY))
}

export function signOutMock() {
  window.localStorage.removeItem(SESSION_KEY)
}

export async function createMockUser(prefix: string, username: string, password: string) {
  const email = `${prefix}@vitstudent.ac.in`
  await api('/api/auth/signup', { email, username, password })
  saveMockUser({ vitEmail: email, username, password: '', verified: false })
  return getMockUser()
}

export async function markMockUserVerified(otp: string) {
  const user = getMockUser()
  if (!user) throw new Error('Signup session expired.')
  const result = await api('/api/auth/verify', { email: user.vitEmail, otp })
  window.localStorage.setItem(SESSION_KEY, result.token)
  saveMockUser({ ...user, password: '', verified: true })
}

export const VIT_DOMAIN = '@vitstudent.ac.in'
export const DEMO_OTP = '123456'
