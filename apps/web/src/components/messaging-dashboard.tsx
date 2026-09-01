'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  Check,
  ChevronLeft,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Smile,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '../routes/router'
import { getMockUser, isSignedIn, signOutMock } from '../lib/mock-auth'
import { type ConnectionState, P2PChat } from '../lib/p2p-chat'

type Person = {
  name: string
  username: string
  initials: string
  tone: string
  online: boolean
  preview: string
  time: string
}
type Message = { id: number; text: string; outgoing: boolean; time: string }

const people: Person[] = [
  { name: 'Rahul Kumar', username: '@rahulk', initials: 'RK', tone: 'from-cyan-500/30 to-blue-600/30', online: true, preview: 'The hackathon idea is getting real.', time: '2m' },
  { name: 'Sarah Chen', username: '@sarahc', initials: 'SC', tone: 'from-fuchsia-500/30 to-purple-600/30', online: true, preview: 'See you at the library?', time: '18m' },
  { name: 'Arjun Patel', username: '@arjunp', initials: 'AP', tone: 'from-amber-400/30 to-orange-600/30', online: true, preview: 'Sent a connection request', time: '1h' },
  { name: 'Priya Sharma', username: '@priyash', initials: 'PS', tone: 'from-emerald-400/30 to-teal-600/30', online: false, preview: 'That workshop was great.', time: '3h' },
  { name: 'Alex Johnson', username: '@alexj', initials: 'AJ', tone: 'from-blue-400/30 to-indigo-600/30', online: false, preview: 'Let\'s compare notes tomorrow.', time: 'Yesterday' },
]

const discoveryPeople: Person[] = [
  { name: 'Rahul Kumar', username: '@rahul_kumar', initials: 'RK', tone: 'from-cyan-500/30 to-blue-600/30', online: true, preview: 'Building the next big thing.', time: 'now' },
  { name: 'Ananya Rao', username: '@ananyarao', initials: 'AR', tone: 'from-fuchsia-500/30 to-purple-600/30', online: true, preview: 'Design & innovation enthusiast.', time: 'now' },
  { name: 'Vikram Singh', username: '@vikrams', initials: 'VS', tone: 'from-amber-400/30 to-orange-600/30', online: false, preview: 'Computer Science, 3rd year.', time: '12m' },
]

const seed: Record<string, Message[]> = {
  '@rahulk': [
    { id: 1, text: 'Hey! Did you see the new hackathon brief?', outgoing: false, time: '10:41 AM' },
    { id: 2, text: 'Yes, the campus sustainability track looks incredible.', outgoing: true, time: '10:43 AM' },
    { id: 3, text: 'The hackathon idea is getting real. Want to build a team?', outgoing: false, time: '10:45 AM' },
  ],
  '@sarahc': [{ id: 1, text: 'See you at the library?', outgoing: false, time: '9:24 AM' }],
  '@arjunp': [{ id: 1, text: 'Sent a connection request', outgoing: false, time: 'Yesterday' }],
  '@priyash': [{ id: 1, text: 'That workshop was great.', outgoing: false, time: 'Monday' }],
  '@alexj': [{ id: 1, text: 'Let\'s compare notes tomorrow.', outgoing: false, time: 'Sunday' }],
}

function Avatar({ person, small = false }: { person: Person; small?: boolean }) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br ${person.tone} font-semibold ${
        small ? 'h-9 w-9 text-[10px]' : 'h-11 w-11 text-xs'
      }`}
    >
      {person.initials}
      <span
        className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#080d18] ${
          person.online
            ? 'bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,.9)]'
            : 'bg-slate-600'
        }`}
      />
    </div>
  )
}

export function MessagingDashboard() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Person | null>(people[0])
  const [messages, setMessages] = useState(seed)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [discoveryQuery, setDiscoveryQuery] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [roomCode, setRoomCode] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chat = useRef<P2PChat | null>(null)
  const user = getMockUser()

  useEffect(() => {
    if (!isSignedIn()) navigate({ to: '/login' })
    return () => chat.current?.close()
  }, [navigate])

  const filtered = useMemo(
    () => people.filter((p) => `${p.name} ${p.username}`.toLowerCase().includes(search.toLowerCase())),
    [search],
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [selected])

  const send = () => {
    const text = draft.trim()
    if (!text || !selected) return
    if (chat.current && connectionState !== 'connected') return
    try { chat.current?.send(text) } catch { return }
    setMessages((current) => ({
      ...current,
      [selected.username]: [
        ...(current[selected.username] || []),
        { id: Date.now(), text, outgoing: true, time: 'Now' },
      ],
    }))
    setDraft('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  const startRoom = (person: Person, join = false) => {
    const code = (join ? joinRoomCode : Array.from(crypto.getRandomValues(new Uint8Array(8)), (value) => value.toString(36).padStart(2, '0')).join('').slice(0, 12)).trim()
    if (code.length < 3 || !/^[A-Za-z0-9_-]+$/.test(code)) return
    const username = user?.username || 'student'
    const peerId = `${username.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48) || 'student'}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`
    chat.current?.close()
    setRoomCode(code)
    setSelected(person)
    setDiscoverOpen(false)
    setMessages((current) => ({ ...current, [person.username]: [] }))
    setConnectionState('connecting')
    chat.current = new P2PChat(code, peerId, {
      onState: (state) => setConnectionState(state),
      onPeer: () => undefined,
      onMessage: (text) => setMessages((current) => ({
        ...current,
        [person.username]: [...(current[person.username] || []), { id: Date.now(), text, outgoing: false, time: 'Now' }],
      })),
    })
    if (join) chat.current.join()
    else chat.current.create()
  }

  const select = (person: Person) => {
    setSelected(person)
    setSidebarOpen(false)
  }

  const me: Person = {
    name: user?.username || 'You',
    username: '@you',
    initials: (user?.username || 'YO').slice(0, 2).toUpperCase(),
    tone: 'from-cyan-400/40 to-blue-500/40',
    online: true,
    preview: '',
    time: '',
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden="true" className="ambient-grid pointer-events-none absolute inset-0 opacity-25" />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(88vw,340px)] flex-col border-r border-white/[0.08] bg-[#070b13]/95 backdrop-blur-2xl transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/[0.08] px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">i</span>
            <span className="text-lg font-semibold tracking-tight">
              ineVITable<span className="text-cyan-400">.</span>
            </span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden" aria-label="Close conversations">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4">
          <button
            onClick={() => {
              setDiscoverOpen(true)
              setConnectionState('idle')
            }}
            className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-blue-950/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-cyan-950/30 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b13]"
          >
            <Plus className="h-4 w-4" /> New conversation
          </button>
          <label className="relative mt-4 block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-xs outline-none focus:border-cyan-400/40"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <p className="px-2 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Active now <span className="text-muted-foreground">3</span>
          </p>
          {filtered.filter((p) => p.online).map((p) => (
            <ConversationItem key={p.username} person={p} active={selected?.username === p.username} onClick={() => select(p)} />
          ))}
          <p className="px-2 pb-3 pt-7 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recent conversations</p>
          {filtered.filter((p) => !p.online).map((p) => (
            <ConversationItem key={p.username} person={p} active={selected?.username === p.username} onClick={() => select(p)} />
          ))}
        </div>

        <div className="border-t border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <Avatar person={me} small />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user?.username || 'Your identity'}</p>
              <p className="text-[11px] text-cyan-300">Verified student</p>
            </div>
            <button
              onClick={() => {
                signOutMock()
                navigate({ to: '/login' })
              }}
              aria-label="Sign out"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      {/* Chat area */}
      <section className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
          <span className="select-none whitespace-nowrap bg-gradient-to-r from-blue-400/10 via-indigo-400/10 to-purple-400/10 bg-clip-text text-[clamp(4.5rem,14vw,13rem)] font-black leading-none tracking-[-0.08em] text-transparent opacity-80 blur-[0.2px] drop-shadow-[0_0_28px_rgba(99,102,241,0.12)]">
            ineVITable
          </span>
        </div>

        <header className="flex h-20 items-center justify-between border-b border-white/[0.08] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden" aria-label="Open conversations">
              <Menu className="h-5 w-5" />
            </button>
            {selected ? (
              <>
                <Avatar person={selected} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-sm font-semibold">{selected.name}</h1>
                    <span className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-300 sm:inline-flex">
                      Direct connection
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selected.username} ·{' '}
                    <span className={selected.online ? 'text-cyan-300' : ''}>
                      {selected.online ? 'Online now' : 'Offline'}
                    </span>
                  </p>
                  {roomCode && (
                    <p className="mt-1 text-[10px] text-cyan-300">
                      Room {roomCode} · {connectionState === 'waiting' ? 'Share this code with your peer' : connectionState}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <h1 className="text-sm font-semibold">Conversations</h1>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <button aria-label="Notifications" className="rounded-lg p-2 hover:bg-white/[0.05] hover:text-foreground">
              <Bell className="h-4 w-4" />
            </button>
            <button aria-label="More options" className="rounded-lg p-2 hover:bg-white/[0.05] hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </header>

        {selected ? (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-12">
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                <div className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="h-px flex-1 bg-white/[0.08]" /> Today <span className="h-px flex-1 bg-white/[0.08]" />
                </div>
                <AnimatePresence initial={false}>
                  {(messages[selected.username] || []).map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.outgoing ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex max-w-[82%] flex-col ${m.outgoing ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                            m.outgoing
                              ? 'rounded-br-md bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-950/30'
                              : 'rounded-bl-md border border-white/10 bg-white/[0.055] shadow-xl shadow-black/10 backdrop-blur-md'
                          }`}
                        >
                          {m.text}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
                          {m.time}
                          {m.outgoing && (
                            <>
                              <span>·</span>
                              <Check className="h-3 w-3 text-cyan-300" /> Delivered
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="border-t border-white/[0.08] bg-background/70 px-4 py-4 backdrop-blur-xl sm:px-8 lg:px-12">
              <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-2 focus-within:border-cyan-400/30">
                <button aria-label="Add emoji" className="mb-1 rounded-lg p-2 text-muted-foreground hover:text-cyan-300">
                  <Smile className="h-5 w-5" />
                </button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder={`Message ${selected.name.split(' ')[0]}...`}
                  className="max-h-[140px] min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-5 outline-none placeholder:text-muted-foreground/60"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={send}
                  aria-label="Send message"
                  className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_25px_rgba(34,211,238,.25)]"
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              </div>
              <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground/60">Enter to send · Shift + Enter for a new line</p>
            </div>
          </>
        ) : (
          <EmptyState />
        )}
      </section>

      <DiscoverModal
        open={discoverOpen}
        query={discoveryQuery}
        setQuery={setDiscoveryQuery}
        onlineOnly={onlineOnly}
        setOnlineOnly={setOnlineOnly}
        state={connectionState}
        joinCode={joinRoomCode}
        setJoinCode={setJoinRoomCode}
        onClose={() => setDiscoverOpen(false)}
        onStart={startRoom}
        onJoin={(person) => startRoom(person, true)}
      />
    </main>
  )
}

function DiscoverModal({
  open,
  query,
  setQuery,
  onlineOnly,
  setOnlineOnly,
  state,
  joinCode,
  setJoinCode,
  onClose,
  onStart,
  onJoin,
}: {
  open: boolean
  query: string
  setQuery: (value: string) => void
  onlineOnly: boolean
  setOnlineOnly: (value: boolean) => void
  state: ConnectionState
  joinCode: string
  setJoinCode: (value: string) => void
  onClose: () => void
  onStart: (person: Person) => void
  onJoin: (person: Person) => void
}) {
  const results = discoveryPeople.filter(
    (person) =>
      `${person.name} ${person.username}`.toLowerCase().includes(query.toLowerCase()) &&
      (!onlineOnly || person.online),
  )
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="discover-title"
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#0b1220] shadow-[0_0_80px_rgba(34,211,238,.12)]"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {state === 'connecting' || state === 'waiting' ? (
              <div className="flex flex-col items-center px-8 py-14 text-center">
                <div className="relative mb-7 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/[0.08]">
                  <span className="absolute inset-0 animate-ping rounded-full border border-cyan-300/30" />
                  <Users className="h-8 w-8 text-cyan-300" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{state === 'waiting' ? 'Room created' : 'Connecting...'}</p>
                <h2 className="mt-3 text-2xl font-semibold">{state === 'waiting' ? 'Waiting for your peer' : 'Making the introduction'}</h2>
                <div className="mt-8 flex w-full max-w-sm items-center justify-between text-xs text-muted-foreground">
                  <span className="text-cyan-300">Finding peer</span>
                  <span className="text-cyan-300">→</span>
                  <span>Establishing connection</span>
                  <span>→</span>
                  <span>Ready</span>
                </div>
                <div className="mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-cyan-300"
                    initial={{ width: '8%' }}
                    animate={{ width: '82%' }}
                    transition={{ duration: 2.2, ease: 'easeInOut' }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Peer network</p>
                    <h2 id="discover-title" className="mt-1 text-2xl font-semibold tracking-tight">
                      Discover VIT Students
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close discovery"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4 px-6 py-5">
                  <label className="relative block">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by username"
                      className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.045] pl-10 pr-4 text-sm outline-none focus:border-cyan-300/50"
                    />
                  </label>
                  <button
                    onClick={() => setOnlineOnly(!onlineOnly)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      onlineOnly
                        ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200'
                        : 'border-white/10 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ● Available now
                  </button>
                  <div className="space-y-2">
                    {results.length ? (
                      results.map((person) => (
                        <div
                          key={person.username}
                          className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 transition-colors hover:border-cyan-300/20"
                        >
                          <Avatar person={person} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{person.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {person.username} ·{' '}
                              <span className={person.online ? 'text-cyan-300' : ''}>
                                {person.online ? 'Available' : 'Away'}
                              </span>
                            </p>
                          </div>
                          <button
                            onClick={() => onStart(person)}
                            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
                          >
                            Start Conversation
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-muted-foreground">
                        No students found. Try another username.
                      </div>
                    )}
                  </div>
                  <div className="border-t border-white/[0.08] pt-4">
                    <p className="text-xs text-muted-foreground">Already have a room code?</p>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={joinCode}
                        onChange={(event) => setJoinCode(event.target.value)}
                        placeholder="Paste room code"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.045] px-3 font-mono text-xs outline-none focus:border-cyan-300/50"
                      />
                      <button
                        onClick={() => results[0] && onJoin(results[0])}
                        disabled={!joinCode.trim() || !results[0]}
                        className="rounded-lg border border-cyan-300/40 px-3 text-xs font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Join room
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ConversationItem({
  person,
  active,
  onClick,
}: {
  person: Person
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group flex min-h-16 w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-inset ${
        active
          ? 'bg-cyan-400/[0.09] shadow-[inset_2px_0_0_rgba(103,232,249,.8)]'
          : 'hover:bg-white/[0.04]'
      }`}
    >
      <Avatar person={person} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium">{person.name}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{person.time}</span>
        </span>
        <span className="mt-1 block truncate text-[11px] text-muted-foreground transition-colors group-hover:text-slate-300">
          {person.preview}
        </span>
      </span>
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/[0.04] shadow-[0_0_70px_rgba(34,211,238,.12)]">
          <span className="absolute inset-4 rounded-full border border-blue-400/20" />
          <MessageCircle className="h-9 w-9 text-cyan-300" />
          <Sparkles className="absolute -right-2 -top-2 h-5 w-5 text-cyan-300" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Your conversations start here.</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Discover students around you and start a direct connection.
        </p>
        <button className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:-translate-y-0.5">
          <Users className="mr-2 inline h-4 w-4" /> Discover Students
        </button>
      </div>
    </div>
  )
}
