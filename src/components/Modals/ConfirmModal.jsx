import Button from '../UI/Button'

export default function ConfirmModal({ open, title, description, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, danger = false }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-sm rounded-xl2 border border-ink-700 bg-ink-900 p-6 shadow-panel">
        <h2 id="confirm-modal-title" className="font-display text-lg font-semibold text-paper">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-paper-dim/80">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
