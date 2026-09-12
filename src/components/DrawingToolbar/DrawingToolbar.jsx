import { useState } from 'react'
import {
  Pencil,
  Paintbrush,
  Highlighter,
  Eraser,
  Minus,
  Square,
  Circle,
  Undo2,
  Redo2,
  Trash2,
  Download,
  PenTool
} from 'lucide-react'

const TOOLS = [
  { id: 'pencil', label: 'Pencil', icon: Pencil },
  { id: 'brush', label: 'Brush', icon: Paintbrush },
  { id: 'marker', label: 'Marker', icon: PenTool },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'rectangle', label: 'Rectangle', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle }
]

const SIZES = [2, 4, 8, 12, 20, 30, 50]

const SWATCHES = [
  '#131316', // black
  '#FAF9F6', // white
  '#E4483B', // red
  '#FF6A4D', // orange
  '#F4C22B', // yellow
  '#3FA66B', // green
  '#3B7CE4', // blue
  '#7A4CE0', // purple
  '#E85B9E', // pink
  '#8A5A3A', // brown
  '#83838F' // gray
]

function ToolButton({ tool, active, onSelect }) {
  const Icon = tool.icon
  return (
    <button
      type="button"
      title={tool.label}
      aria-label={tool.label}
      aria-pressed={active}
      onClick={() => onSelect(tool.id)}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
        active ? 'border-signal bg-signal/20 text-signal-bright' : 'border-transparent text-paper-dim/80 hover:bg-ink-800'
      }`}
    >
      <Icon size={18} strokeWidth={2} />
    </button>
  )
}

export default function DrawingToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onDownload,
  recentColors
}) {
  const [customOpen, setCustomOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3 border-b border-ink-800 bg-ink-900/60 px-3 py-3 sm:border-b-0 sm:border-r sm:px-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar sm:flex-col sm:overflow-visible sm:pb-0">
        {TOOLS.map((t) => (
          <ToolButton key={t.id} tool={t} active={tool === t.id} onSelect={onToolChange} />
        ))}
      </div>

      <div className="h-px bg-ink-800 sm:mx-1" />

      <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
        <label htmlFor="brush-size" className="sr-only">
          Brush size
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`${s}px brush`}
              aria-pressed={size === s}
              onClick={() => onSizeChange(s)}
              className={`flex h-8 w-8 items-center justify-center rounded-md border text-[10px] font-medium ${
                size === s ? 'border-signal bg-signal/20 text-signal-bright' : 'border-ink-700 text-paper-dim/70 hover:bg-ink-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          id="brush-size"
          type="range"
          min="1"
          max="60"
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="w-full accent-signal sm:mt-1"
        />
      </div>

      <div className="h-px bg-ink-800 sm:mx-1" />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Color ${swatch}`}
              aria-pressed={color.toLowerCase() === swatch.toLowerCase()}
              onClick={() => onColorChange(swatch)}
              style={{ backgroundColor: swatch }}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${
                color.toLowerCase() === swatch.toLowerCase() ? 'scale-110 border-signal-bright' : 'border-ink-700/80'
              }`}
            />
          ))}
          <button
            type="button"
            aria-label="Custom color"
            onClick={() => setCustomOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-ink-600 text-[10px] text-paper-dim/70"
          >
            +
          </button>
        </div>
        {customOpen && (
          <input
            type="color"
            aria-label="Pick a custom color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="h-8 w-full cursor-pointer rounded-md border border-ink-700 bg-transparent"
          />
        )}
        {recentColors?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {recentColors.map((c, i) => (
              <button
                key={c + i}
                type="button"
                aria-label={`Recent color ${c}`}
                onClick={() => onColorChange(c)}
                style={{ backgroundColor: c }}
                className="h-5 w-5 rounded-full border border-ink-700/80"
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-paper-dim/60">Selected</span>
          <span
            className="h-5 w-5 rounded-full border border-ink-600 shadow-[0_0_0_2px_rgba(122,108,255,0.4)]"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>

      <div className="h-px bg-ink-800 sm:mx-1" />

      <div className="flex items-center gap-1.5 sm:flex-col sm:items-stretch">
        <button
          type="button"
          aria-label="Undo"
          title="Undo"
          disabled={!canUndo}
          onClick={onUndo}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-ink-700 px-3 text-xs text-paper-dim/80 hover:bg-ink-800 disabled:opacity-30"
        >
          <Undo2 size={15} /> <span className="sm:inline">Undo</span>
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo"
          disabled={!canRedo}
          onClick={onRedo}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-ink-700 px-3 text-xs text-paper-dim/80 hover:bg-ink-800 disabled:opacity-30"
        >
          <Redo2 size={15} /> <span className="sm:inline">Redo</span>
        </button>
        <button
          type="button"
          aria-label="Clear canvas"
          title="Clear canvas"
          onClick={onClear}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-clay/40 px-3 text-xs text-clay hover:bg-clay/10"
        >
          <Trash2 size={15} /> Clear
        </button>
        <button
          type="button"
          aria-label="Download drawing as PNG"
          title="Download PNG"
          onClick={onDownload}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-ink-700 px-3 text-xs text-paper-dim/80 hover:bg-ink-800"
        >
          <Download size={15} /> Download
        </button>
      </div>
    </div>
  )
}
