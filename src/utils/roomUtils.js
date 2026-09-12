// Characters chosen to avoid visually-ambiguous pairs (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export function generateRoomCode() {
  let code = ''
  const bytes = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

export function formatRoomCode(raw) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function buildInviteLink(roomCode) {
  return `${window.location.origin}/join/${roomCode}`
}

const NAME_STORAGE_PREFIX = 'duodraw:name:'

/**
 * Assigns "Artist 1" to whoever created/first-joined the room and
 * "Artist 2" to the second. Kept in sessionStorage only (cleared when the
 * tab closes) so a refresh doesn't change your own label mid-session, and
 * so a new tab / new room never inherits it.
 */
export function assignDisplayName(roomCode, participantIndex) {
  const key = NAME_STORAGE_PREFIX + roomCode
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const name = `Artist ${participantIndex}`
  sessionStorage.setItem(key, name)
  return name
}
