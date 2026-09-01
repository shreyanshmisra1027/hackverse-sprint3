export type AuthUser = {
  vitEmail: string
  username: string
}

export type DirectoryUser = { username: string }

const USER_KEY = 'inevitable-user'
const SESSION_KEY = 'inevitable-session'
// Production requests must stay on Vercel so `/api` reaches the serverless
// functions. A separate host is supported only for local development.
const API_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  : ''

async function api(path: string, body?: unknown) {
  const response = await fetch(`${API_URL}${path}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(localStorage.getItem(SESSION_KEY) ? { authorization: `Bearer ${localStorage.getItem(SESSION_KEY)}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Authentication request failed.')
  return data
}

export function saveMockUser(user: AuthUser) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getMockUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as AuthUser } catch { return null }
}

export async function signInMock(email: string, password: string, _remember: boolean) {
  const result = await api('/api/auth/login', { email, password })
  window.localStorage.setItem(SESSION_KEY, result.token)
  saveMockUser({ vitEmail: result.user.email, username: result.user.username })
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
  const result = await api('/api/auth/signup', { email, username, password })
  window.localStorage.setItem(SESSION_KEY, result.token)
  saveMockUser({ vitEmail: email, username: result.user.username })
  return getMockUser()
}

export async function listUsers(): Promise<DirectoryUser[]> {
  const result = await api('/api/users')
  return Array.isArray(result.users) ? result.users : []
}

export async function archiveMessage(roomId: string, recipientUsername: string, text: string) {
  await api('/api/messages', { roomId, recipientUsername, text })
}

export const VIT_DOMAIN = '@vitstudent.ac.in'
