import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import { sendHeartbeat, leaveRoom as leaveRoomRequest, fetchParticipants } from '../services/roomService'

const HEARTBEAT_INTERVAL_MS = 20_000

/**
 * Tracks live participant presence for a room (via Supabase Presence,
 * which is ephemeral) and keeps the room alive with a periodic heartbeat.
 * Also watches the room's `expires_at` / row deletion so the UI can react
 * the instant a room expires or is closed, even for the participant who
 * isn't the one who left.
 */
export function useRoom({ room, sessionId, presenceState }) {
  const [participants, setParticipants] = useState([])
  const [roomExpired, setRoomExpired] = useState(false)
  const heartbeatRef = useRef(null)

  const refreshParticipants = useCallback(async () => {
    if (!room) return
    try {
      const rows = await fetchParticipants(room.id)
      setParticipants(rows)
    } catch {
      // Non-fatal — presence state still drives the "who's online" UI.
    }
  }, [room])

  useEffect(() => {
    refreshParticipants()
  }, [refreshParticipants])

  // Presence is the fast, ephemeral signal for "who's connected right now";
  // Postgres changes below keep display names correct if presence hiccups.
  useEffect(() => {
    if (!room) return undefined

    const channel = supabase
      .channel(`room-db:${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${room.id}` },
        () => refreshParticipants()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        () => setRoomExpired(true)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room, refreshParticipants])

  // Heartbeat: extends room lifetime and refreshes last_seen while this tab
  // is actually part of the room.
  useEffect(() => {
    if (!room || !sessionId) return undefined

    sendHeartbeat(room.id, sessionId).catch(() => {})
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat(room.id, sessionId).catch(() => {})
    }, HEARTBEAT_INTERVAL_MS)

    return () => clearInterval(heartbeatRef.current)
  }, [room, sessionId])

  // If the room's expires_at passes locally, treat it as expired even if
  // the DELETE event from cleanup hasn't arrived yet.
  useEffect(() => {
    if (!room) return undefined
    const msUntilExpiry = new Date(room.expires_at).getTime() - Date.now()
    if (msUntilExpiry <= 0) {
      setRoomExpired(true)
      return undefined
    }
    const timer = setTimeout(() => setRoomExpired(true), msUntilExpiry)
    return () => clearTimeout(timer)
  }, [room])

  const leave = useCallback(async () => {
    clearInterval(heartbeatRef.current)
    if (room && sessionId) {
      await leaveRoomRequest(room.id, sessionId).catch(() => {})
    }
  }, [room, sessionId])

  const onlineCount = presenceState ? Object.keys(presenceState).length : participants.length

  return { participants, onlineCount, roomExpired, leave, refreshParticipants }
}
