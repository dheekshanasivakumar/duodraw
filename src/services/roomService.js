import { supabase, ensureAnonymousSession, ROOM_EXPIRY_MINUTES } from './supabase'
import { generateRoomCode } from '../utils/roomUtils'

function expiryTimestamp() {
  return new Date(Date.now() + ROOM_EXPIRY_MINUTES * 60 * 1000).toISOString()
}

/** Creates a new temporary room and joins the creator as "Artist 1". */
export async function createRoom() {
  const session = await ensureAnonymousSession()
  const sessionId = session.user.id

  // Extremely unlikely to collide, but retry once on the off chance the
  // random code is already taken by a still-active room.
  for (let attempt = 0; attempt < 3; attempt++) {
    const roomCode = generateRoomCode()
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({ room_code: roomCode, expires_at: expiryTimestamp(), status: 'waiting' })
      .select()
      .single()

    if (roomError) {
      if (roomError.code === '23505') continue // unique_violation on room_code — retry
      throw roomError
    }

    const { error: participantError } = await supabase.from('participants').insert({
      room_id: room.id,
      session_id: sessionId,
      display_name: 'Artist 1'
    })
    if (participantError) throw participantError

    return { room, sessionId, participantIndex: 1 }
  }

  throw new Error('Could not create a room right now. Please try again.')
}

export class RoomError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

/** Validates and joins an existing room by code as "Artist 2" (or rejoin). */
export async function joinRoom(rawCode) {
  const session = await ensureAnonymousSession()
  const sessionId = session.user.id
  const roomCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (roomError) throw roomError
  if (!room) throw new RoomError('NOT_FOUND', 'This room code doesn\u2019t exist.')
  if (new Date(room.expires_at) < new Date()) {
    throw new RoomError('EXPIRED', 'This room has expired.')
  }

  const { data: existingParticipants, error: listError } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', room.id)

  if (listError) throw listError

  const self = existingParticipants.find((p) => p.session_id === sessionId)
  if (self) {
    // Rejoining after a refresh — not a new participant.
    return { room, sessionId, participantIndex: self.display_name === 'Artist 1' ? 1 : 2 }
  }

  if (existingParticipants.length >= 2) {
    throw new RoomError('FULL', 'This private room is full.')
  }

  const participantIndex = existingParticipants.length + 1
  const { error: insertError } = await supabase.from('participants').insert({
    room_id: room.id,
    session_id: sessionId,
    display_name: `Artist ${participantIndex}`
  })

  if (insertError) {
    if (insertError.message?.includes('ROOM_FULL')) {
      throw new RoomError('FULL', 'This private room is full.')
    }
    throw insertError
  }

  return { room, sessionId, participantIndex }
}

export async function fetchParticipants(roomId) {
  const { data, error } = await supabase.from('participants').select('*').eq('room_id', roomId)
  if (error) throw error
  return data
}

/** Removes the current session from a room ("Leave Room"). */
export async function leaveRoom(roomId, sessionId) {
  await supabase.from('participants').delete().eq('room_id', roomId).eq('session_id', sessionId)
}

/** Keeps a room alive while someone is actively in it, and refreshes last_seen. */
export async function sendHeartbeat(roomId, sessionId) {
  await supabase.from('participants').update({ last_seen: new Date().toISOString() }).eq('room_id', roomId).eq('session_id', sessionId)
  await supabase.from('rooms').update({ expires_at: expiryTimestamp() }).eq('id', roomId)
}
