export type MockUser = {
  vitEmail: string
  username: string
  password: string
  verified: boolean
}

const USER_KEY = 'inevitable-mock-user'
const SESSION_KEY = 'inevitable-mock-session'

export function saveMockUser(user: MockUser) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getMockUser(): MockUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as MockUser } catch { return null }
}

export function signInMock(email: string, password: string, remember: boolean) {
  const user = getMockUser()
  const valid = user?.vitEmail === email && user.password === password
  if (valid) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({
      email,
      remember,
      signedInAt: Date.now(),
    }))
  }
  return valid
}

export function isSignedIn() {
  return Boolean(window.localStorage.getItem(SESSION_KEY))
}

export function signOutMock() {
  window.localStorage.removeItem(SESSION_KEY)
}

export function createMockUser(prefix: string, username: string, password: string) {
  const user: MockUser = {
    vitEmail: `${prefix}@vitstudent.ac.in`,
    username,
    password,
    verified: false,
  }
  saveMockUser(user)
  return user
}

export function markMockUserVerified() {
  const user = getMockUser()
  if (user) saveMockUser({ ...user, verified: true })
}

export const VIT_DOMAIN = '@vitstudent.ac.in'
export const DEMO_OTP = '123456'
