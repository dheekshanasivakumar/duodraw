import { useCallback, useEffect, useRef, useState } from 'react'
import {
  drawStroke,
  redrawAll,
  getCanvasPoint,
  resizeCanvasPreservingContent,
  FREEHAND_TOOLS,
  SHAPE_TOOLS
} from '../utils/canvasUtils'

let strokeCounter = 0
function nextStrokeId(sessionId) {
  strokeCounter += 1
  return `${sessionId}-${Date.now()}-${strokeCounter}`
}

/**
 * Owns all canvas state: pointer input, the in-memory stroke list (the
 * only "history" that exists — never sent to a server as a log, only kept
 * per-browser so the canvas can be redrawn on resize/undo), and applying
 * strokes that arrive from the other participant.
 *
 * `onLocalStroke`, `onLocalClear`, `onLocalUndoRedo` are called so the
 * caller can broadcast these over realtime — this hook has no network
 * knowledge of its own.
 */
export function useCanvas({ sessionId, onLocalStroke, onLocalClear, onLocalUndoRedo }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  const committedRef = useRef([]) // authoritative strokes, both users, in draw order
  const remoteInProgressRef = useRef(new Map()) // strokeId -> in-flight remote stroke
  const localUndoStackRef = useRef([]) // ids of MY committed strokes, oldest first
  const localRedoStackRef = useRef([]) // full stroke objects I've undone

  const activeStrokeRef = useRef(null) // my current in-progress stroke
  const pendingPointsRef = useRef([]) // points not yet flushed to the network
  const rafRef = useRef(null)

  const [tool, setTool] = useState('pencil')
  const [color, setColor] = useState('#1B1B21')
  const [size, setSize] = useState(6)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const refreshUndoRedoState = useCallback(() => {
    setCanUndo(localUndoStackRef.current.length > 0)
    setCanRedo(localRedoStackRef.current.length > 0)
  }, [])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    redrawAll(canvas, committedRef.current)
  }, [])

  // --- Sizing -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      const changed = resizeCanvasPreservingContent(canvas, Math.max(width, 1), Math.max(height, 1))
      if (changed) redraw()
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [redraw])

  // --- Local pointer drawing ----------------------------------------------
  const drawIncrementalSegment = useCallback((stroke, fromIndex) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const ctx = canvas.getContext('2d')
    const pts = stroke.points.slice(Math.max(fromIndex - 1, 0))
    if (pts.length < 1) return
    drawStroke(ctx, { ...stroke, points: pts }, dpr)
  }, [])

  const flushPending = useCallback(() => {
    rafRef.current = null
    const stroke = activeStrokeRef.current
    const pending = pendingPointsRef.current
    if (!stroke || pending.length === 0) return
    pendingPointsRef.current = []
    onLocalStroke?.({
      phase: 'move',
      strokeId: stroke.id,
      sessionId,
      tool: stroke.tool,
      color: stroke.color,
      size: stroke.size,
      points: pending
    })
  }, [onLocalStroke, sessionId])

  const schedulePendingFlush = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(flushPending)
  }, [flushPending])

  const handlePointerDown = useCallback(
    (e) => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.setPointerCapture?.(e.pointerId)
      const point = getCanvasPoint(canvas, e.clientX, e.clientY)
      const stroke = {
        id: nextStrokeId(sessionId),
        sessionId,
        tool,
        color,
        size,
        points: [point]
      }
      activeStrokeRef.current = stroke
      pendingPointsRef.current = []

      if (FREEHAND_TOOLS.has(tool)) {
        drawIncrementalSegment(stroke, 0)
      }

      onLocalStroke?.({
        phase: 'start',
        strokeId: stroke.id,
        sessionId,
        tool,
        color,
        size,
        points: [point]
      })
    },
    [tool, color, size, sessionId, drawIncrementalSegment, onLocalStroke]
  )

  const handlePointerMove = useCallback(
    (e) => {
      const stroke = activeStrokeRef.current
      const canvas = canvasRef.current
      if (!stroke || !canvas) return
      const point = getCanvasPoint(canvas, e.clientX, e.clientY)
      const fromIndex = stroke.points.length

      if (FREEHAND_TOOLS.has(stroke.tool)) {
        stroke.points.push(point)
        drawIncrementalSegment(stroke, fromIndex)
      } else if (SHAPE_TOOLS.has(stroke.tool)) {
        stroke.points = [stroke.points[0], point]
        redraw()
        const ctx = canvas.getContext('2d')
        const dpr = window.devicePixelRatio || 1
        drawStroke(ctx, stroke, dpr)
      }

      pendingPointsRef.current.push(point)
      schedulePendingFlush()
    },
    [drawIncrementalSegment, redraw, schedulePendingFlush]
  )

  const handlePointerUp = useCallback(() => {
    const stroke = activeStrokeRef.current
    if (!stroke) return
    activeStrokeRef.current = null
    pendingPointsRef.current = []

    committedRef.current = [...committedRef.current, stroke]
    localUndoStackRef.current = [...localUndoStackRef.current, stroke.id]
    localRedoStackRef.current = []
    refreshUndoRedoState()
    redraw()

    onLocalStroke?.({
      phase: 'end',
      strokeId: stroke.id,
      sessionId,
      tool: stroke.tool,
      color: stroke.color,
      size: stroke.size,
      points: stroke.points
    })
  }, [onLocalStroke, redraw, refreshUndoRedoState, sessionId])

  // --- Remote strokes -------------------------------------------------------
  const applyRemoteStroke = useCallback(
    (payload) => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (payload.sessionId === sessionId) return // safety: never apply our own echo

      if (payload.phase === 'start') {
        remoteInProgressRef.current.set(payload.strokeId, {
          id: payload.strokeId,
          sessionId: payload.sessionId,
          tool: payload.tool,
          color: payload.color,
          size: payload.size,
          points: [...payload.points]
        })
        const stroke = remoteInProgressRef.current.get(payload.strokeId)
        if (FREEHAND_TOOLS.has(stroke.tool)) drawIncrementalSegment(stroke, 0)
        return
      }

      if (payload.phase === 'move') {
        const stroke = remoteInProgressRef.current.get(payload.strokeId)
        if (!stroke) return
        const fromIndex = stroke.points.length
        stroke.points.push(...payload.points)
        if (FREEHAND_TOOLS.has(stroke.tool)) {
          drawIncrementalSegment(stroke, fromIndex)
        } else if (SHAPE_TOOLS.has(stroke.tool)) {
          stroke.points = [stroke.points[0], stroke.points[stroke.points.length - 1]]
          redraw()
          const ctx = canvas.getContext('2d')
          const dpr = window.devicePixelRatio || 1
          drawStroke(ctx, stroke, dpr)
        }
        return
      }

      if (payload.phase === 'end') {
        remoteInProgressRef.current.delete(payload.strokeId)
        const alreadyHave = committedRef.current.some((s) => s.id === payload.strokeId)
        if (!alreadyHave) {
          committedRef.current = [
            ...committedRef.current,
            {
              id: payload.strokeId,
              sessionId: payload.sessionId,
              tool: payload.tool,
              color: payload.color,
              size: payload.size,
              points: payload.points
            }
          ]
        }
        redraw()
      }
    },
    [drawIncrementalSegment, redraw, sessionId]
  )

  const applyRemoteClear = useCallback(() => {
    committedRef.current = []
    remoteInProgressRef.current.clear()
    localUndoStackRef.current = []
    localRedoStackRef.current = []
    refreshUndoRedoState()
    redraw()
  }, [redraw, refreshUndoRedoState])

  const applyRemoteUndoRedo = useCallback(
    (payload) => {
      if (payload.action === 'undo') {
        committedRef.current = committedRef.current.filter((s) => s.id !== payload.strokeId)
      } else if (payload.action === 'redo' && payload.stroke) {
        if (!committedRef.current.some((s) => s.id === payload.stroke.id)) {
          committedRef.current = [...committedRef.current, payload.stroke]
        }
      }
      redraw()
    },
    [redraw]
  )

  // --- Local actions: clear / undo / redo ----------------------------------
  const clearCanvas = useCallback(() => {
    committedRef.current = []
    localUndoStackRef.current = []
    localRedoStackRef.current = []
    refreshUndoRedoState()
    redraw()
    onLocalClear?.({ sessionId })
  }, [onLocalClear, redraw, refreshUndoRedoState, sessionId])

  const undo = useCallback(() => {
    const stack = localUndoStackRef.current
    if (stack.length === 0) return
    const strokeId = stack[stack.length - 1]
    localUndoStackRef.current = stack.slice(0, -1)
    const removed = committedRef.current.find((s) => s.id === strokeId)
    committedRef.current = committedRef.current.filter((s) => s.id !== strokeId)
    if (removed) localRedoStackRef.current = [...localRedoStackRef.current, removed]
    refreshUndoRedoState()
    redraw()
    onLocalUndoRedo?.({ action: 'undo', strokeId, sessionId })
  }, [onLocalUndoRedo, redraw, refreshUndoRedoState, sessionId])

  const redo = useCallback(() => {
    const stack = localRedoStackRef.current
    if (stack.length === 0) return
    const stroke = stack[stack.length - 1]
    localRedoStackRef.current = stack.slice(0, -1)
    committedRef.current = [...committedRef.current, stroke]
    localUndoStackRef.current = [...localUndoStackRef.current, stroke.id]
    refreshUndoRedoState()
    redraw()
    onLocalUndoRedo?.({ action: 'redo', strokeId: stroke.id, sessionId, stroke })
  }, [onLocalUndoRedo, redraw, refreshUndoRedoState, sessionId])

  // --- Sync snapshot for late joiners ---------------------------------------
  const getSnapshot = useCallback(() => committedRef.current, [])

  const loadSnapshot = useCallback(
    (strokes) => {
      if (committedRef.current.length > 0) return // don't clobber work already in progress
      committedRef.current = strokes ?? []
      redraw()
    },
    [redraw]
  )

  const downloadPNG = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvas.width
    exportCanvas.height = canvas.height
    const ctx = exportCanvas.getContext('2d')
    ctx.fillStyle = '#FAF9F6'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    ctx.drawImage(canvas, 0, 0)

    const link = document.createElement('a')
    link.download = `duodraw-${Date.now()}.png`
    link.href = exportCanvas.toDataURL('image/png')
    link.click()
  }, [])

  return {
    canvasRef,
    containerRef,
    tool,
    setTool,
    color,
    setColor,
    size,
    setSize,
    canUndo,
    canRedo,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    applyRemoteStroke,
    applyRemoteClear,
    applyRemoteUndoRedo,
    clearCanvas,
    undo,
    redo,
    getSnapshot,
    loadSnapshot,
    downloadPNG
  }
}
