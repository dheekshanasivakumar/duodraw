import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../components/UI/Button'
import { joinRoom, RoomError } from '../services/roomService'
import { validateRoomCodeInput } from '../utils/validation'

const ERROR_COPY = {
  NOT_FOUND: 'We couldn\u2019t find a room with that code.',
  FULL: 'This room is full — it already has two artists.',
  EXPIRED: 'This room has expired.'
}

export default function JoinRoom() {
  const { code: codeFromLink } = useParams()
  const [code, setCode] = useState(codeFromLink ?? '')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validateRoomCodeInput(code)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { room } = await joinRoom(code)
      navigate(`/room/${room.room_code}`, { replace: true })
    } catch (err) {
      if (err instanceof RoomError) {
        setError(ERROR_COPY[err.code] ?? err.message)
      } else {
        // eslint-disable-next-line no-console
        console.error(err)
        setError('Something went wrong joining that room. Please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 text-paper">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate('/')} className="mb-6 text-xs text-paper-dim/50 hover:text-paper-dim">
          ← Back
        </button>
        <h1 className="font-display text-2xl font-semibold">Join a room</h1>
        <p className="mt-1.5 text-sm text-paper-dim/60">Enter the code your friend shared with you.</p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label htmlFor="room-code" className="mb-1.5 block text-xs font-medium text-paper-dim/70">
              Room code
            </label>
            <input
              id="room-code"
              type="text"
              autoFocus
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AB7K9Q"
              maxLength={12}
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-center font-display text-xl tracking-[0.3em] text-paper placeholder:text-paper-dim/30 focus:border-signal"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'room-code-error' : undefined}
            />
            {error && (
              <p id="room-code-error" role="alert" className="mt-2 text-xs text-clay">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
            {loading ? 'Joining…' : 'Join Room'}
          </Button>
        </form>
      </div>
    </div>
  )
}
