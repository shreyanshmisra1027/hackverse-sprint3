export type ConnectionState = 'idle' | 'connecting' | 'waiting' | 'connected' | 'error'

type SignalMessage =
  | { type: 'PEER_JOINED'; roomId: string; peerId: string }
  | { type: 'PEER_LEFT'; roomId: string; peerId: string }
  | { type: 'SDP_OFFER' | 'SDP_ANSWER'; roomId: string; targetPeerId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ICE_CANDIDATE'; roomId: string; targetPeerId: string; candidate: RTCIceCandidateInit }
  | { type: 'ERROR'; code: string; message: string }

type Handlers = {
  onState: (state: ConnectionState, detail?: string) => void
  onMessage: (text: string) => void
  onPeer: (peerId?: string) => void
}

function signalingUrl() {
  const configured = import.meta.env.VITE_SIGNALING_URL
  if (configured) return configured
  if (typeof window === 'undefined') return ''
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:10000`
}

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]
  const turnUrl = import.meta.env.VITE_TURN_URL
  if (turnUrl) servers.push({ urls: turnUrl, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL })
  return servers
}

function send(socket: WebSocket, message: object) {
  if (socket.readyState !== WebSocket.OPEN) throw new Error('The signaling connection is not open.')
  socket.send(JSON.stringify(message))
}

/** Two-person WebRTC text chat; only negotiation frames pass through the signaling server. */
export class P2PChat {
  private socket?: WebSocket
  private peer?: RTCPeerConnection
  private channel?: RTCDataChannel
  private remotePeerId?: string
  private pendingCandidates: RTCIceCandidateInit[] = []

  constructor(private readonly roomId: string, private readonly peerId: string, private readonly handlers: Handlers) {}

  create() { this.connect('CREATE_ROOM') }
  join() { this.connect('JOIN_ROOM') }
  send(text: string) {
    if (this.channel?.readyState !== 'open') throw new Error('Your peer is not connected yet.')
    this.channel.send(text)
  }
  close() {
    this.channel?.close()
    this.peer?.close()
    this.socket?.close()
    this.handlers.onState('idle')
  }

  private connect(action: 'CREATE_ROOM' | 'JOIN_ROOM') {
    const url = signalingUrl()
    if (!url) return this.handlers.onState('error', 'Set VITE_SIGNALING_URL to your signaling server URL.')
    this.handlers.onState('connecting')
    this.socket = new WebSocket(url)
    this.socket.addEventListener('open', () => {
      try {
        send(this.socket!, { type: action, roomId: this.roomId, peerId: this.peerId })
        this.handlers.onState(action === 'CREATE_ROOM' ? 'waiting' : 'connecting')
      } catch (error) { this.handlers.onState('error', error instanceof Error ? error.message : 'Unable to join room.') }
    })
    this.socket.addEventListener('message', (event) => this.handleSignal(event.data))
    this.socket.addEventListener('error', () => this.handlers.onState('error', 'Could not reach the signaling server.'))
    this.socket.addEventListener('close', () => { if (this.channel?.readyState !== 'open') this.handlers.onState('idle') })
  }

  private async handleSignal(data: unknown) {
    if (typeof data !== 'string') return
    let message: SignalMessage
    try { message = JSON.parse(data) as SignalMessage } catch { return }
    if (message.type === 'ERROR') return this.handlers.onState('error', message.message)
    if (message.type === 'PEER_LEFT') { this.handlers.onPeer(); return this.handlers.onState('waiting', 'The other person left the room.') }
    if (message.type === 'PEER_JOINED') {
      this.remotePeerId = message.peerId
      this.handlers.onPeer(message.peerId)
      this.ensurePeer()
      if (this.channel) await this.makeOffer()
      return
    }
    if (!this.remotePeerId || message.targetPeerId !== this.peerId) return
    try {
      const peer = this.ensurePeer()
      if (message.type === 'SDP_OFFER') {
        await peer.setRemoteDescription(message.sdp)
        await this.flushCandidates()
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        send(this.socket!, { type: 'SDP_ANSWER', roomId: this.roomId, targetPeerId: this.remotePeerId, sdp: answer })
      } else if (message.type === 'SDP_ANSWER') {
        await peer.setRemoteDescription(message.sdp)
        await this.flushCandidates()
      } else if (message.type === 'ICE_CANDIDATE' && peer.remoteDescription) await peer.addIceCandidate(message.candidate)
      else if (message.type === 'ICE_CANDIDATE') this.pendingCandidates.push(message.candidate)
    } catch { this.handlers.onState('error', 'Could not establish the peer-to-peer connection.') }
  }

  private ensurePeer() {
    if (this.peer) return this.peer
    const peer = new RTCPeerConnection({ iceServers: iceServers() })
    peer.addEventListener('icecandidate', (event) => {
      if (event.candidate && this.remotePeerId) send(this.socket!, { type: 'ICE_CANDIDATE', roomId: this.roomId, targetPeerId: this.remotePeerId, candidate: event.candidate.toJSON() })
    })
    peer.addEventListener('datachannel', (event) => this.attachChannel(event.channel))
    peer.addEventListener('connectionstatechange', () => {
      if (peer.connectionState === 'connected') this.handlers.onState('connected')
      if (peer.connectionState === 'failed') this.handlers.onState('error', 'The direct connection failed. Try another network or a TURN relay.')
    })
    this.peer = peer
    return peer
  }
  private attachChannel(channel: RTCDataChannel) {
    this.channel = channel
    channel.addEventListener('open', () => this.handlers.onState('connected'))
    channel.addEventListener('close', () => this.handlers.onState('waiting', 'The direct connection was closed.'))
    channel.addEventListener('message', (event) => { if (typeof event.data === 'string') this.handlers.onMessage(event.data) })
  }
  private async makeOffer() {
    const peer = this.ensurePeer()
    this.attachChannel(peer.createDataChannel('chat', { ordered: true }))
    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    send(this.socket!, { type: 'SDP_OFFER', roomId: this.roomId, targetPeerId: this.remotePeerId, sdp: offer })
  }
  private async flushCandidates() {
    const candidates = this.pendingCandidates.splice(0)
    await Promise.all(candidates.map((candidate) => this.peer!.addIceCandidate(candidate)))
  }
}
