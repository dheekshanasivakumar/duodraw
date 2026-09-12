import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoomChannel } from '../services/realtimeService'

/**
 * Owns the Supabase Realtime channel for one room and exposes a stable
 * `send` object plus a connection status string:
 * 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
 */
export function useRealtime({ roomCode, sessionId, displayName, handlers }) {
  const [status, setStatus] = useState('connecting')
  const roomRef = useRef(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!roomCode || !sessionId) return undefined

    const room = createRoomChannel(roomCode, { sessionId, displayName })
    roomRef.current = room

    room.subscribe({
      onStroke: (p) => handlersRef.current.onStroke?.(p),
      onClear: (p) => handlersRef.current.onClear?.(p),
      onUndoRedo: (p) => handlersRef.current.onUndoRedo?.(p),
      onChat: (p) => handlersRef.current.onChat?.(p),
      onSyncRequest: (p) => handlersRef.current.onSyncRequest?.(p),
      onSyncResponse: (p) => handlersRef.current.onSyncResponse?.(p),
      onPresenceSync: (state) => handlersRef.current.onPresenceSync?.(state),
      onPresenceLeave: (left) => handlersRef.current.onPresenceLeave?.(left),
      onStatusChange: (rawStatus) => {
        if (rawStatus === 'SUBSCRIBED') setStatus('connected')
        else if (rawStatus === 'CHANNEL_ERROR' || rawStatus === 'TIMED_OUT') setStatus('reconnecting')
        else if (rawStatus === 'CLOSED') setStatus('disconnected')
        else setStatus('connecting')
      }
    })

    return () => {
      room.unsubscribe()
      roomRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, sessionId, displayName])

  const send = {
    stroke: useCallback((payload) => roomRef.current?.sendStroke(payload), []),
    clear: useCallback((payload) => roomRef.current?.sendClear(payload), []),
    undoRedo: useCallback((payload) => roomRef.current?.sendUndoRedo(payload), []),
    chat: useCallback((payload) => roomRef.current?.sendChat(payload), []),
    syncRequest: useCallback((payload) => roomRef.current?.requestSync(payload), []),
    syncResponse: useCallback((payload) => roomRef.current?.respondSync(payload), [])
  }

  return { status, send }
}
