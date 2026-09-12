import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, { tone = 'default', duration = 4000 } = {}) => {
      counterRef.current += 1
      const id = counterRef.current
      setToasts((prev) => [...prev, { id, message, tone }])
      if (duration) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-[fadein_0.15s_ease-out] rounded-xl border px-4 py-3 text-sm shadow-panel backdrop-blur-md ${
              t.tone === 'error'
                ? 'border-clay/40 bg-clay/15 text-paper'
                : t.tone === 'success'
                  ? 'border-moss/40 bg-moss/15 text-paper'
                  : 'border-ink-600 bg-ink-800/95 text-paper'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
