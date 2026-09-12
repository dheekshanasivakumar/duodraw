const DOT_COLORS = ['bg-signal', 'bg-clay']

export default function ParticipantStatus({ participants, myDisplayName, onlineIds }) {
  const sorted = [...participants].sort((a, b) => a.display_name.localeCompare(b.display_name))

  return (
    <div className="flex items-center gap-3 border-b border-ink-800 bg-ink-950/60 px-4 py-2 text-xs text-paper-dim/80">
      {sorted.length === 0 && <span>Waiting for another artist…</span>}
      {sorted.map((p, i) => {
        const isOnline = onlineIds ? onlineIds.includes(p.session_id) : true
        return (
          <span key={p.id} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? DOT_COLORS[i % 2] : 'bg-ink-600'}`} />
            {p.display_name}
            {p.display_name === myDisplayName && <span className="text-paper-dim/50">(you)</span>}
          </span>
        )
      })}
      {sorted.length === 1 && <span className="text-paper-dim/50">Waiting for Artist 2…</span>}
    </div>
  )
}
