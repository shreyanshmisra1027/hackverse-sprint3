'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '../routes/router'
import {
  createMockUser,
  getMockUser,
  signInMock,
  VIT_DOMAIN,
} from '../lib/mock-auth'

const ease = [0.22, 1, 0.36, 1] as const

function AuthFrame({
  children,
  eyebrow,
  title,
  copy,
}: {
  children: React.ReactNode
  eyebrow: string
  title: string
  copy: string
}) {
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="ambient-grid absolute inset-0 opacity-50" />
      <div className="particles absolute inset-0" />
      <div className="relative z-10 mx-auto flex min-w-0 w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">i</span>
            <span className="text-lg font-semibold tracking-tight">
              ineVITable<span className="text-cyan-400">.</span>
            </span>
          </Link>
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" /> Exit
          </Link>
        </header>
        <div className="grid min-w-0 grid-cols-1 flex-1 items-center gap-12 py-16 lg:grid-cols-[.8fr_1.2fr] lg:gap-24">
          <div className="hidden lg:block">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">{eyebrow}</p>
            <h1 className="max-w-lg text-6xl font-semibold leading-[.98] tracking-[-0.06em] text-balance">{title}</h1>
            <p className="mt-7 max-w-md text-base leading-7 text-muted-foreground">{copy}</p>
            <div className="mt-10 flex items-center gap-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-cyan-400" /> VIT student identity protected
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="mx-auto w-full max-w-md"
          >
            {children}
          </motion.div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground/60">ineVITable · A quieter kind of social network</p>
      </div>
    </main>
  )
}

function Field({
  label,
  icon: Icon,
  ...props
}: {
  label: string
  icon: React.ElementType
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          {...props}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-11 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-cyan-400/50 focus:bg-cyan-400/[0.04] focus:shadow-[0_0_24px_rgba(34,211,238,.08)]"
        />
      </span>
    </label>
  )
}

export function LoginForm() {
  const navigate = useNavigate()
  const [prefix, setPrefix] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    window.setTimeout(async () => {
      try {
        await signInMock(`${prefix}${VIT_DOMAIN}`, password, remember)
        setMessage('Connecting you to your network...')
        window.setTimeout(() => navigate({ to: '/dashboard' }), 900)
      } catch (error) {
        setLoading(false)
        setMessage(error instanceof Error ? error.message : 'Unable to sign in.')
      }
    }, 700)
  }

  return (
    <AuthFrame
      eyebrow="Welcome back"
      title="Your circle is closer than ever."
      copy="Sign in with your VIT identity and get back to the conversations that matter."
    >
      <div className="mb-8 min-w-0 overflow-hidden lg:hidden">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Welcome back</p>
        <h1 className="max-w-full break-words text-4xl font-semibold tracking-[-0.05em]">Your circle is closer.</h1>
      </div>
      <div className="min-w-0 w-full rounded-2xl border border-white/10 bg-card/70 p-6 shadow-2xl shadow-blue-950/20 backdrop-blur-xl sm:p-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Member access</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Log in to ineVITable</h2>
        </div>
        <form onSubmit={submit} className="min-w-0 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">VIT email</span>
            <span className="flex h-12 items-center rounded-xl border border-white/10 bg-white/[0.035] transition-all focus-within:border-cyan-400/50 focus-within:shadow-[0_0_24px_rgba(34,211,238,.08)]">
              <UserRound className="ml-4 h-4 w-4 text-muted-foreground" />
              <input
                required
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
                placeholder="student.username"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/50"
              />
              <span className="shrink-0 pr-3 text-[10px] text-muted-foreground sm:text-xs">{VIT_DOMAIN}</span>
            </span>
          </label>
          <div className="relative">
            <Field
              label="Password"
              icon={LockKeyhole}
              type={show ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-4 top-9 text-muted-foreground"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-cyan-400"
            />{' '}
            Remember me
          </label>
          <button
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_rgba(96,165,250,.25)] disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : (
              <>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </button>
          {message && (
            <p
              className={`text-center text-xs ${
                message.startsWith('Connecting') ? 'text-cyan-300' : 'text-rose-300'
              }`}
            >
              {message}
            </p>
          )}
        </form>
        <p className="mt-7 text-center text-xs text-muted-foreground">
          New to the network?{' '}
          <Link to="/signup" className="font-medium text-cyan-300 hover:text-cyan-200">
            Create identity
          </Link>
        </p>
      </div>
    </AuthFrame>
  )
}

export function SignupForm() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [prefix, setPrefix] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const strength = [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)]

  const nextIdentity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prefix || !username || !strength.every(Boolean)) return setError('Complete all password requirements.')
    if (password !== confirm) return setError('Passwords do not match.')
    try { await createMockUser(prefix, username, password); navigate({ to: '/login' }) } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create account.') }
  }

  const updateOtp = (i: number, value: string) => {
    const chars = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[i] = chars
    setOtp(next)
    if (chars && i < 5) refs.current[i + 1]?.focus()
  }

  return (
    <AuthFrame
      eyebrow="Join the circle"
      title="Make campus feel smaller."
      copy="Create a verified student identity and find the conversations already happening around you."
    >
      <div className="mb-8 min-w-0 overflow-hidden lg:hidden">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Join the circle</p>
        <h1 className="text-4xl font-semibold tracking-[-0.05em]">Make campus feel smaller.</h1>
      </div>
      <div className="min-w-0 w-full rounded-2xl border border-white/10 bg-card/70 p-6 shadow-2xl shadow-blue-950/20 backdrop-blur-xl sm:p-8">
        <div className="mb-8">
          <div className="mb-5 flex items-center gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    step >= i ? 'bg-primary text-primary-foreground' : 'border border-white/10 text-muted-foreground'
                  }`}
                >
                  {step > i ? <Check className="h-3.5 w-3.5" /> : i}
                </span>
                {i < 3 && <span className={`h-px flex-1 ${step > i ? 'bg-cyan-400' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step {step} of 3</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {step === 1 ? 'Verify your VIT email' : step === 2 ? 'Create your identity' : 'Confirm your identity'}
          </h2>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.3, ease }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setError('')
                setStep(2)
              }}
              className={step === 1 ? 'space-y-5' : 'hidden'}
            >
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-muted-foreground">VIT email</span>
                <span className="flex h-12 items-center rounded-xl border border-white/10 bg-white/[0.035] focus-within:border-cyan-400/50">
                  <UserRound className="ml-4 h-4 w-4 text-muted-foreground" />
                  <input
                    required
                    autoFocus
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
                    placeholder="student.username"
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                  <span className="shrink-0 pr-3 text-[10px] text-muted-foreground sm:text-xs">{VIT_DOMAIN}</span>
                </span>
              </label>
              <button className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                Continue <ArrowRight className="ml-2 inline h-4 w-4" />
              </button>
            </form>
            <form onSubmit={nextIdentity} className={step === 2 ? 'space-y-5' : 'hidden'}>
              <Field
                label="Username"
                icon={UserRound}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="How people will find you"
              />
              <Field
                label="Password"
                icon={KeyRound}
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
              />
              <div className="space-y-2">
                <div className="flex gap-1">
                  {strength.map((good, i) => (
                    <span key={i} className={`h-1 flex-1 rounded-full ${good ? 'bg-cyan-400' : 'bg-white/10'}`} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                  {['8+ characters', 'uppercase', 'number', 'special character'].map((label, i) => (
                    <span key={label} className={strength[i] ? 'text-cyan-300' : ''}>
                      {strength[i] ? '✓' : '○'} {label}
                    </span>
                  ))}
                </div>
              </div>
              <Field
                label="Confirm password"
                icon={LockKeyhole}
                required
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
              />
              <button className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                Continue <ArrowRight className="ml-2 inline h-4 w-4" />
              </button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                navigate({ to: '/login' })
              }}
              className={step === 3 ? 'space-y-5' : 'hidden'}
            >
              <p className="text-sm leading-6 text-muted-foreground">
                We sent a six-digit code to <span className="text-foreground">{prefix}{VIT_DOMAIN}</span>.
              </p>
              <div className="flex gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      refs.current[i] = el
                    }}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => updateOtp(i, e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault()
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
                      const next = [...otp]
                      pasted.forEach((v, j) => {
                        next[j] = v
                      })
                      setOtp(next)
                      refs.current[Math.min(pasted.length, 5)]?.focus()
                    }}
                    className={`h-12 min-w-0 flex-1 rounded-xl border bg-white/[0.035] text-center text-lg font-semibold outline-none transition-all focus:border-cyan-400/50 ${
                      otp.join('').length === 6 ? 'border-cyan-400/60 shadow-[0_0_24px_rgba(34,211,238,.15)]' : 'border-white/10'
                    }`}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>
              <button className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                Verify and enter <ArrowRight className="ml-2 inline h-4 w-4" />
              </button>
            </form>
          </motion.div>
        </AnimatePresence>
        {error && <p className="mt-4 text-center text-xs text-rose-300">{error}</p>}
        <p className="mt-7 text-center text-xs text-muted-foreground">
          Already have an identity?{' '}
          <Link to="/login" className="font-medium text-cyan-300 hover:text-cyan-200">
            Log in
          </Link>
        </p>
      </div>
    </AuthFrame>
  )
}
