import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom } from '../services/roomService'

export default function CreateRoom() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    createRoom()
      .then(({ room }) => navigate(`/room/${room.room_code}`, { replace: true }))
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err)
        setError('Could not create a room right now. Please check your connection and try again.')
      })
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 text-center text-paper">
      {error ? (
        <div className="max-w-sm">
          <p className="font-display text-lg font-semibold">Something went wrong</p>
          <p className="mt-2 text-sm text-paper-dim/70">{error}</p>
          <button onClick={() => navigate('/')} className="mt-6 text-sm text-signal-bright underline">
            Back to home
          </button>
        </div>
      ) : (
        <div>
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-signal" />
          <p className="text-sm text-paper-dim/70">Creating your private room…</p>
        </div>
      )}
    </div>
  )
}
