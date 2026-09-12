export const MAX_CHAT_LENGTH = 500
export const MAX_STROKE_POINTS = 4000

export function validateRoomCodeInput(code) {
  if (!code || code.trim().length === 0) {
    return 'Enter a room code to join.'
  }
  const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleaned.length < 4) {
    return 'That room code looks too short.'
  }
  return null
}

/**
 * Escapes text for safe rendering. We render chat as plain React text
 * (never dangerouslySetInnerHTML), so React already escapes HTML — this
 * is a defense-in-depth trim/length guard, not an HTML sanitizer.
 */
export function sanitizeChatMessage(raw) {
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  return trimmed.slice(0, MAX_CHAT_LENGTH)
}

export function isValidChatMessage(raw) {
  const trimmed = raw.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_CHAT_LENGTH
}
