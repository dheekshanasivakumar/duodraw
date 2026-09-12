const VARIANTS = {
  primary: 'bg-signal hover:bg-signal-bright text-white shadow-[0_8px_24px_-8px_rgba(91,76,255,0.6)]',
  secondary: 'bg-ink-800 hover:bg-ink-700 text-paper border border-ink-600',
  ghost: 'bg-transparent hover:bg-ink-800 text-paper-dim',
  danger: 'bg-clay hover:brightness-110 text-white'
}

export default function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  const sizing = size === 'sm' ? 'px-3.5 py-2 text-sm' : size === 'lg' ? 'px-7 py-3.5 text-base' : 'px-5 py-2.5 text-sm'
  return (
    <Tag
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${sizing} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  )
}
