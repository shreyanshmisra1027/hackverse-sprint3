export type AuthUser = {
  vitEmail: string
  username: string
}

export type DirectoryUser = { username: string; online: boolean }
export type ArchivedMessage = { id: string; recipientUsername: string; roomId: string; text: string; outgoing: boolean; createdAt: string }

const USER_KEY = 'inevitable-user'
const SESSION_KEY = 'inevitable-session'
// Production requests must stay on Vercel so `/api` reaches the serverless
// functions. A separate host is supported only for local development.
const API_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  : ''

async function api(path: string, body?: unknown) {
  const token = sessionToken()
  const response = await fetch(`${API_URL}${path}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Authentication request failed.')
  return data
}

function sessionToken() {
  return window.localStorage.getItem(SESSION_KEY) || window.sessionStorage.getItem(SESSION_KEY)
}

function saveUser(user: AuthUser) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as AuthUser } catch { return null }
}

export async function signIn(email: string, password: string, remember: boolean) {
  const result = await api('/api/auth/login', { email, password })
  const storage = remember ? window.localStorage : window.sessionStorage
  window.localStorage.removeItem(SESSION_KEY)
  window.sessionStorage.removeItem(SESSION_KEY)
  storage.setItem(SESSION_KEY, result.token)
  saveUser({ vitEmail: result.user.email, username: result.user.username })
  return true
}

export function isSignedIn() {
  return Boolean(sessionToken())
}

export function signOut() {
  window.localStorage.removeItem(SESSION_KEY)
  window.sessionStorage.removeItem(SESSION_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export async function createUser(prefix: string, username: string, password: string) {
  const email = `${prefix}@vitstudent.ac.in`
  const result = await api('/api/auth/signup', { email, username, password })
  window.localStorage.setItem(SESSION_KEY, result.token)
  saveUser({ vitEmail: email, username: result.user.username })
  return getCurrentUser()
}

export async function listUsers(): Promise<DirectoryUser[]> {
  const result = await api('/api/users')
  return Array.isArray(result.users) ? result.users : []
}

export async function archiveMessage(roomId: string, recipientUsername: string, text: string, outgoing = true) {
  await api('/api/messages', { roomId, recipientUsername, text, outgoing })
}

export async function loadArchivedMessages(): Promise<ArchivedMessage[]> {
  const result = await api('/api/messages')
  return Array.isArray(result.messages) ? result.messages : []
}

export async function updatePresence() { await api('/api/presence', {}) }

export const VIT_DOMAIN = '@vitstudent.ac.in'
