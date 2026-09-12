import Button from '../UI/Button'

const STATUS_LABEL = {
  connected: 'Connected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected'
}

const STATUS_DOT = {
  connected: 'bg-moss',
  connecting: 'bg-ink-400 animate-pulse',
  reconnecting: 'bg-clay animate-pulse',
  disconnected: 'bg-ink-400'
}

export default function RoomHeader({ roomCode, onlineCount, connectionStatus, onLeave }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 bg-ink-900/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/20">
          <div className="h-3 w-3 rounded-full bg-signal" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold text-paper">DuoDraw</p>
          <p className="text-xs tracking-wide text-paper-dim/70">Room {roomCode}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-paper-dim/80">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[connectionStatus] ?? STATUS_DOT.connecting}`} />
          {STATUS_LABEL[connectionStatus] ?? 'Connecting…'}
        </span>
        <span className="hidden sm:inline">{onlineCount}/2 Artists</span>
        <Button variant="secondary" size="sm" onClick={onLeave}>
          Leave
        </Button>
      </div>
    </header>
  )
}
