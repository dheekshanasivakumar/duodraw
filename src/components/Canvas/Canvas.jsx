export default function Canvas({ containerRef, canvasRef, onPointerDown, onPointerMove, onPointerUp, tool }) {
  const cursorClass = tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'

  return (
    <div ref={containerRef} className="relative min-h-[320px] flex-1 overflow-hidden bg-paper">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Shared drawing canvas"
        className={`touch-none-canvas absolute inset-0 h-full w-full ${cursorClass}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  )
}
