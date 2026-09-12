import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { MAX_CHAT_LENGTH, isValidChatMessage, sanitizeChatMessage } from '../../utils/validation'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPanel({ messages, myDisplayName, onSend, disabled }) {
  const [draft, setDraft] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    const cleaned = sanitizeChatMessage(draft)
    if (!isValidChatMessage(cleaned)) return
    onSend(cleaned)
    setDraft('')
  }

  return (
    <div className="flex h-full flex-col border-t border-ink-800 bg-ink-900/60 sm:border-l sm:border-t-0">
      <div className="border-b border-ink-800 px-4 py-3">
        <p className="font-display text-sm font-semibold text-paper">Chat</p>
        <p className="text-[11px] text-paper-dim/50">Messages disappear when this room ends</p>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && <p className="pt-6 text-center text-xs text-paper-dim/40">Say hello to start the session.</p>}
        {messages.map((m) => {
          const mine = m.displayName === myDisplayName
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${
                  mine ? 'bg-signal text-white' : 'bg-ink-800 text-paper'
                }`}
              >
                {!mine && <p className="mb-0.5 text-[11px] font-medium text-paper-dim/60">{m.displayName}</p>}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
              <span className="mt-1 text-[10px] text-paper-dim/40">{formatTime(m.timestamp)}</span>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-ink-800 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <input
          id="chat-input"
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHAT_LENGTH))}
          placeholder={disabled ? 'Waiting for another artist to join…' : 'Type a message…'}
          className="flex-1 rounded-full border border-ink-700 bg-ink-950 px-4 py-2.5 text-sm text-paper placeholder:text-paper-dim/40 focus:border-signal"
        />
        <button
          type="submit"
          disabled={disabled || !isValidChatMessage(draft)}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal text-white transition hover:bg-signal-bright disabled:opacity-30"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
