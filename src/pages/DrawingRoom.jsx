import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomHeader from '../components/RoomHeader/RoomHeader'
import ParticipantStatus from '../components/ParticipantStatus/ParticipantStatus'
import DrawingToolbar from '../components/DrawingToolbar/DrawingToolbar'
import Canvas from '../components/Canvas/Canvas'
import ChatPanel from '../components/ChatPanel/ChatPanel'
import ConfirmModal from '../components/Modals/ConfirmModal'
import Button from '../components/UI/Button'
import { joinRoom, RoomError } from '../services/roomService'
import { useCanvas } from '../hooks/useCanvas'
import { useRealtime } from '../hooks/useRealtime'
import { useRoom } from '../hooks/useRoom'
import { useToast } from '../components/UI/Toast'
import { buildInviteLink } from '../utils/roomUtils'

const ERROR_COPY = {
  NOT_FOUND: 'We couldn\u2019t find a room with that code.',
  FULL: 'This private room is full.',
  EXPIRED: 'This room has expired.'
}

function FullScreenMessage({ title, description, onHome }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-950 px-6 text-center text-paper">
      <p className="font-display text-xl font-semibold">{title}</p>
      {description && <p className="max-w-xs text-sm text-paper-dim/70">{description}</p>}
      <Button variant="primary" onClick={onHome}>
        Back to home
      </Button>
    </div>
  )
}

export default function DrawingRoom() {
  const { code } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [session, setSession] = useState(null) // { room, sessionId, participantIndex }
  const [joinError, setJoinError] = useState(null)
  const [messages, setMessages] = useState([])
  const [presenceState, setPresenceState] = useState({})
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [recentColors, setRecentColors] = useState([])

  const startedRef = useRef(false)
  const syncedRef = useRef(false)
  const realtimeRef = useRef(null)

  // 1. Establish (or re-establish, on refresh) this browser's membership.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    joinRoom(code)
      .then(setSession)
      .catch((err) => {
        if (err instanceof RoomError) {
          setJoinError(ERROR_COPY[err.code] ?? err.message)
        } else {
          // eslint-disable-next-line no-console
          console.error(err)
          setJoinError('Something went wrong opening this room.')
        }
      })
  }, [code])

  const sessionId = session?.sessionId ?? null
  const displayName = session ? `Artist ${session.participantIndex}` : null

  const handleLocalChat = useCallback(
    (text) => {
      const message = { id: `${sessionId}-${Date.now()}`, displayName, text, timestamp: Date.now() }
      setMessages((prev) => [...prev, message])
      realtimeRef.current?.send.chat({ sessionId, displayName, text, timestamp: message.timestamp })
    },
    [sessionId, displayName]
  )

  const canvas = useCanvas({
    sessionId,
    onLocalStroke: (payload) => realtimeRef.current?.send.stroke(payload),
    onLocalClear: (payload) => realtimeRef.current?.send.clear(payload),
    onLocalUndoRedo: (payload) => realtimeRef.current?.send.undoRedo(payload)
  })

  const canvasRefLive = useRef(canvas)
  canvasRefLive.current = canvas

  const handlers = {
    onStroke: (p) => canvasRefLive.current.applyRemoteStroke(p),
    onClear: () => {
      canvasRefLive.current.applyRemoteClear()
      toast.push('The other artist cleared the canvas.')
    },
    onUndoRedo: (p) => canvasRefLive.current.applyRemoteUndoRedo(p),
    onChat: (p) => {
      if (p.sessionId === sessionId) return
      setMessages((prev) => [...prev, { id: `${p.sessionId}-${p.timestamp}`, displayName: p.displayName, text: p.text, timestamp: p.timestamp }])
    },
    onSyncRequest: () => {
      const snapshot = canvasRefLive.current.getSnapshot()
      if (snapshot.length > 0) {
        realtimeRef.current?.send.syncResponse({ strokes: snapshot })
      }
    },
    onSyncResponse: (p) => canvasRefLive.current.loadSnapshot(p.strokes),
    onPresenceSync: (state) => setPresenceState(state),
    onPresenceLeave: (left) => {
      const name = left?.[0]?.displayName
      if (name) toast.push(`${name} left the room.`)
    }
  }

  const realtime = useRealtime({ roomCode: code, sessionId, displayName, handlers })
  realtimeRef.current = realtime

  const room = useRoom({ room: session?.room, sessionId, presenceState })

  // Ask the other participant for their current canvas once we're connected.
  useEffect(() => {
    if (realtime.status === 'connected' && !syncedRef.current) {
      syncedRef.current = true
      const timer = setTimeout(() => realtime.send.syncRequest({ requestedBy: sessionId }), 400)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [realtime.status, realtime.send, sessionId])

  useEffect(() => {
    if (realtime.status === 'reconnecting') {
      toast.push('Connection interrupted. Trying to reconnect…', { tone: 'error', duration: 3000 })
    }
  }, [realtime.status, toast])

  const handleColorChange = useCallback(
    (c) => {
      canvas.setColor(c)
      setRecentColors((prev) => [c, ...prev.filter((x) => x !== c)].slice(0, 6))
    },
    [canvas]
  )

  const handleLeaveConfirmed = useCallback(async () => {
    await room.leave()
    navigate('/', { replace: true })
  }, [room, navigate])

  const handleCopyInvite = useCallback(() => {
    navigator.clipboard?.writeText(buildInviteLink(code)).then(
      () => toast.push('Invite link copied.', { tone: 'success', duration: 2000 }),
      () => toast.push('Could not copy the link — copy it from the address bar instead.', { tone: 'error' })
    )
  }, [code, toast])

  if (joinError) {
    return <FullScreenMessage title={joinError} onHome={() => navigate('/')} />
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 text-paper">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-signal" />
      </div>
    )
  }

  if (room.roomExpired) {
    return (
      <FullScreenMessage
        title="This room has expired"
        description="Create a new room to start a fresh session."
        onHome={() => navigate('/')}
      />
    )
  }

  const waitingForPartner = room.participants.length < 2

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-950 text-paper">
      <RoomHeader roomCode={code} onlineCount={room.onlineCount} connectionStatus={realtime.status} onLeave={() => setShowLeaveConfirm(true)} />
      <ParticipantStatus participants={room.participants} myDisplayName={displayName} onlineIds={Object.keys(presenceState)} />

      {waitingForPartner ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-display text-2xl font-semibold">Waiting for Artist 2…</p>
          <p className="text-sm text-paper-dim/60">Share this room so someone can join you.</p>
          <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-5 py-3">
            <span className="font-display text-2xl tracking-[0.3em]">{code}</span>
          </div>
          <Button variant="secondary" onClick={handleCopyInvite}>
            Copy Invite Link
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
          <div className="order-2 shrink-0 sm:order-1 sm:w-60 sm:overflow-y-auto">
            <DrawingToolbar
              tool={canvas.tool}
              onToolChange={canvas.setTool}
              color={canvas.color}
              onColorChange={handleColorChange}
              size={canvas.size}
              onSizeChange={canvas.setSize}
              canUndo={canvas.canUndo}
              canRedo={canvas.canRedo}
              onUndo={canvas.undo}
              onRedo={canvas.redo}
              onClear={() => setShowClearConfirm(true)}
              onDownload={canvas.downloadPNG}
              recentColors={recentColors}
            />
          </div>

          <div className="order-1 flex flex-1 sm:order-2">
            <Canvas
              containerRef={canvas.containerRef}
              canvasRef={canvas.canvasRef}
              onPointerDown={canvas.handlePointerDown}
              onPointerMove={canvas.handlePointerMove}
              onPointerUp={canvas.handlePointerUp}
              tool={canvas.tool}
            />
          </div>

          <div className="order-3 h-64 shrink-0 sm:order-3 sm:h-auto sm:w-80">
            <ChatPanel messages={messages} myDisplayName={displayName} onSend={handleLocalChat} disabled={waitingForPartner} />
          </div>
        </div>
      )}

      <ConfirmModal
        open={showClearConfirm}
        title="Clear the entire canvas for both artists?"
        confirmLabel="Clear Canvas"
        danger
        onConfirm={() => {
          canvas.clearCanvas()
          setShowClearConfirm(false)
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      <ConfirmModal
        open={showLeaveConfirm}
        title="Leave this drawing session?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        danger
        onConfirm={handleLeaveConfirmed}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  )
}
