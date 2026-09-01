'use client'

import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChevronDown,
  LockKeyhole,
  Menu,
  MessageCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from '../routes/router'

const nodes = [
  { x: '12%', y: '26%', label: 'AR', color: 'cyan' },
  { x: '27%', y: '68%', label: 'SK', color: 'blue' },
  { x: '49%', y: '23%', label: 'MP', color: 'purple' },
  { x: '70%', y: '66%', label: 'NV', color: 'cyan' },
  { x: '88%', y: '31%', label: 'RJ', color: 'blue' },
]

const features = [
  { icon: ShieldCheck, title: 'VIT Verified', copy: 'Every identity is tied to your VIT credentials. No strangers, no noise.' },
  { icon: Radio, title: 'Local First', copy: 'Find people around you and stay connected to the campus that matters.' },
  { icon: LockKeyhole, title: 'Private Conversations', copy: 'Your messages are yours. Built for direct, intentional conversations.' },
  { icon: Zap, title: 'Instant Messaging', copy: 'Fast, lightweight, and ready whenever a conversation starts.' },
]

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function CursorSpotlight() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const handleMove = (event: PointerEvent) => {
      ref.current?.style.setProperty('--spot-x', `${event.clientX}px`)
      ref.current?.style.setProperty('--spot-y', `${event.clientY}px`)
    }
    window.addEventListener('pointermove', handleMove, { passive: true })
    return () => window.removeEventListener('pointermove', handleMove)
  }, [])
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 hidden opacity-70 mix-blend-screen transition-opacity md:block spotlight"
    />
  )
}

export function InevitableLanding() {
  const [menuOpen, setMenuOpen] = useState(false)
  const phrases = ['verified students', 'people nearby', 'real conversations']
  const [typed, setTyped] = useState(phrases[0])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let i = 0
    const timer = window.setInterval(() => {
      i = (i + 1) % phrases.length
      setTyped(phrases[i])
    }, 3200)
    return () => window.clearInterval(timer)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-cyan-400/30">
      <CursorSpotlight />
      <div aria-hidden="true" className="ambient-grid absolute inset-0 opacity-50" />
      <div aria-hidden="true" className="particles absolute inset-0" />

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <button onClick={() => scrollTo('top')} className="flex items-center gap-2" aria-label="ineVITable home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">i</span>
            <span className="text-lg font-semibold tracking-tight">ineVITable<span className="text-cyan-400">.</span></span>
          </button>
          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <button onClick={() => scrollTo('top')} className="transition-colors hover:text-foreground">Home</button>
            <button onClick={() => scrollTo('how')} className="transition-colors hover:text-foreground">How It Works</button>
            <button onClick={() => scrollTo('features')} className="transition-colors hover:text-foreground">Features</button>
            <button onClick={() => scrollTo('security')} className="transition-colors hover:text-foreground">Security</button>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/login" className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">Login</Link>
            <Link to="/signup" className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]">
              Launch App <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-white/[0.06] px-6 py-5 md:hidden">
            <div className="flex flex-col gap-5 text-sm text-muted-foreground">
              <button onClick={() => scrollTo('top')} className="text-left">Home</button>
              <button onClick={() => scrollTo('how')} className="text-left">How It Works</button>
              <button onClick={() => scrollTo('features')} className="text-left">Features</button>
              <button onClick={() => scrollTo('security')} className="text-left">Security</button>
              <Link to="/signup" onClick={() => setMenuOpen(false)} className="w-full rounded-full bg-primary py-3 text-center text-primary-foreground">
                Launch App
              </Link>
            </div>
          </div>
        )}
      </nav>

      <section id="top" className="relative mx-auto flex min-h-[760px] max-w-7xl flex-col justify-center px-6 pb-20 pt-40 lg:px-10 lg:pt-32">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[620px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.16),transparent_62%)]" />
        <div className="relative z-10 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-cyan-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" /> VIT STUDENT NETWORK
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="text-balance text-6xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-7xl lg:text-[88px]"
          >
            Messaging that <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">stays close.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mt-7 max-w-lg text-pretty text-base leading-7 text-muted-foreground sm:text-lg"
          >
            A private, local-first messaging space for the people who make VIT feel like home.{' '}
            <span className="typewriter-line text-cyan-200">
              {typed}
              <span aria-hidden="true" className="typewriter-cursor" />
            </span>{' '}
            . Right around you.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Link to="/signup" className="group rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_35px_rgba(59,130,246,.28)]">
              Start Chatting <ArrowRight className="ml-2 inline h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/signup" className="rounded-full border border-white/10 px-6 py-3.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-white/[0.05]">
              Explore Network <ChevronDown className="ml-2 inline h-4 w-4" />
            </Link>
          </motion.div>
        </div>
        <NetworkVisual />
      </section>

      <section id="features" className="relative border-t border-white/[0.06] bg-[#080d18] px-6 py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Built for your circle</p>
              <h2 className="max-w-md text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Close connections, <span className="text-muted-foreground">without the clutter.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              A focused layer for campus life. Nothing to upload. Nothing to broadcast. Just people and messages.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <motion.div
                whileHover={{ backgroundColor: 'rgba(255,255,255,.045)' }}
                key={feature.title}
                className="bg-[#080d18] p-7"
              >
                <feature.icon className="mb-12 h-5 w-5 text-cyan-400" />
                <h3 className="mb-3 text-lg font-medium">{feature.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{feature.copy}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-6 py-28 lg:px-10">
        <div className="grid gap-16 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Your network, your way</p>
            <h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              From verified<br /><span className="text-muted-foreground">to connected.</span>
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">
              ineVITable keeps the experience simple so your conversations can be anything but.
            </p>
          </div>
          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {['Create your VIT identity', 'Choose your student username', 'Discover people nearby', 'Connect and start talking'].map((item, i) => (
              <div key={item} className="flex items-center gap-5 py-6">
                <span className="font-mono text-xs text-cyan-400">0{i + 1}</span>
                <span className="text-lg font-medium">{item}</span>
                <Check className="ml-auto h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="border-y border-white/[0.06] bg-gradient-to-br from-blue-950/40 via-background to-background px-6 py-24 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <div className="mb-4 flex items-center gap-2 text-sm text-cyan-300">
              <LockKeyhole className="h-4 w-4" /> Privacy is the default
            </div>
            <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              A quieter kind of social network.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            No public feeds. No follower counts. No algorithm deciding who you should talk to. Only conversations that start with you.
          </p>
        </div>
      </section>

      <footer id="footer" className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-black text-primary-foreground">i</span>
          <span className="font-semibold">ineVITable<span className="text-cyan-400">.</span></span>
        </div>
        <p className="text-xs text-muted-foreground">Built for VIT students, by VIT students.</p>
        <div className="flex gap-5 text-xs text-muted-foreground">
          <a href="#security" className="transition-colors hover:text-foreground">Terms</a>
          <a href="#security" className="transition-colors hover:text-foreground">Privacy</a>
          <a href="mailto:hello@inevitable.app" className="transition-colors hover:text-foreground">Contact</a>
        </div>
      </footer>
    </main>
  )
}

function NetworkVisual() {
  return (
    <div className="relative mt-20 h-[260px] w-full lg:absolute lg:bottom-28 lg:right-0 lg:mt-0 lg:h-[430px] lg:w-[58%]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.08),transparent_65%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 400" fill="none" aria-hidden="true">
        <path
          d="M80 110 L180 290 L320 90 L430 280 L530 130 M180 290 L430 280 M320 90 L530 130"
          stroke="url(#line)"
          strokeWidth="1"
          strokeDasharray="4 7"
        />
        <defs>
          <linearGradient id="line" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#22d3ee" stopOpacity=".1" />
            <stop offset=".5" stopColor="#3b82f6" stopOpacity=".8" />
            <stop offset="1" stopColor="#a78bfa" stopOpacity=".1" />
          </linearGradient>
        </defs>
      </svg>
      {nodes.map((node, i) => (
        <motion.div
          key={node.label}
          className="absolute"
          style={{ left: node.x, top: node.y }}
          animate={{ y: [0, -9, 0] }}
          transition={{ duration: 4 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div
            className={`relative flex h-12 w-12 items-center justify-center rounded-full border text-xs font-semibold shadow-2xl ${
              node.color === 'cyan'
                ? 'border-cyan-300/40 bg-cyan-950 text-cyan-200 shadow-cyan-500/20'
                : node.color === 'purple'
                ? 'border-purple-300/40 bg-purple-950 text-purple-200 shadow-purple-500/20'
                : 'border-blue-300/40 bg-blue-950 text-blue-200 shadow-blue-500/20'
            }`}
          >
            {node.label}
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
          </div>
        </motion.div>
      ))}
      <motion.div
        className="absolute left-[38%] top-[45%] flex h-20 w-20 items-center justify-center rounded-full border border-blue-300/50 bg-blue-600/20 shadow-[0_0_70px_rgba(37,99,235,.5)]"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <MessageCircle className="h-7 w-7 text-cyan-300" />
        <Sparkles className="absolute -right-2 -top-2 h-4 w-4 text-cyan-300" />
      </motion.div>
      <div className="absolute bottom-1 right-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <Users className="h-3 w-3 text-cyan-400" /> 1,284 students online
      </div>
    </div>
  )
}
