// Tools that draw a continuous freehand path vs. tools that draw a single
// shape from a start point to an end point.
export const FREEHAND_TOOLS = new Set(['pencil', 'brush', 'marker', 'highlighter', 'eraser'])
export const SHAPE_TOOLS = new Set(['line', 'rectangle', 'circle'])

export function getToolComposite(tool) {
  return tool === 'eraser' ? 'destination-out' : 'source-over'
}

export function getToolAlpha(tool) {
  if (tool === 'highlighter') return 0.35
  if (tool === 'marker') return 0.75
  return 1
}

export function getToolLineCap(tool) {
  return tool === 'highlighter' ? 'square' : 'round'
}

/** Resizes a canvas for the current devicePixelRatio without losing content. */
export function resizeCanvasPreservingContent(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1
  const targetWidth = Math.round(cssWidth * dpr)
  const targetHeight = Math.round(cssHeight * dpr)

  if (canvas.width === targetWidth && canvas.height === targetHeight) return false

  const prev = document.createElement('canvas')
  prev.width = canvas.width
  prev.height = canvas.height
  const prevCtx = prev.getContext('2d')
  if (canvas.width > 0 && canvas.height > 0) {
    prevCtx.drawImage(canvas, 0, 0)
  }

  canvas.width = targetWidth
  canvas.height = targetHeight
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`

  const ctx = canvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (prev.width > 0 && prev.height > 0) {
    ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, targetWidth, targetHeight)
  }
  return true
}

function strokePath(ctx, points, { color, size, tool }) {
  if (points.length === 0) return
  ctx.save()
  ctx.globalCompositeOperation = getToolComposite(tool)
  ctx.globalAlpha = getToolAlpha(tool)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = size
  ctx.lineCap = getToolLineCap(tool)
  ctx.lineJoin = 'round'

  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    const midX = (points[i - 1].x + points[i].x) / 2
    const midY = (points[i - 1].y + points[i].y) / 2
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, midX, midY)
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
  ctx.stroke()
  ctx.restore()
}

function strokeShape(ctx, start, end, { color, size, tool }) {
  ctx.save()
  ctx.globalCompositeOperation = getToolComposite(tool)
  ctx.globalAlpha = getToolAlpha(tool)
  ctx.strokeStyle = color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()

  if (tool === 'line') {
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
  } else if (tool === 'rectangle') {
    ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y)
  } else if (tool === 'circle') {
    const rx = Math.abs(end.x - start.x) / 2
    const ry = Math.abs(end.y - start.y) / 2
    const cx = (start.x + end.x) / 2
    const cy = (start.y + end.y) / 2
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  }
  ctx.stroke()
  ctx.restore()
}

/** Draws a single normalized stroke object (see hooks/useCanvas.js) onto a context at devicePixelRatio scale. */
export function drawStroke(ctx, stroke, dpr) {
  const scaled = (p) => ({ x: p.x * dpr, y: p.y * dpr })
  const style = { color: stroke.color, size: stroke.size * dpr, tool: stroke.tool }

  if (FREEHAND_TOOLS.has(stroke.tool)) {
    strokePath(ctx, stroke.points.map(scaled), style)
  } else if (SHAPE_TOOLS.has(stroke.tool) && stroke.points.length >= 2) {
    strokeShape(ctx, scaled(stroke.points[0]), scaled(stroke.points[stroke.points.length - 1]), style)
  }
}

/** Clears and fully redraws a canvas from an ordered list of committed strokes. */
export function redrawAll(canvas, strokes) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const dpr = window.devicePixelRatio || 1
  for (const stroke of strokes) {
    drawStroke(ctx, stroke, dpr)
  }
}
export function getCanvasPoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Compute exact scale ratio between CSS pixels and internal canvas resolution
  const scaleX = (canvas.width / dpr) / rect.width;
  const scaleY = (canvas.height / dpr) / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}
