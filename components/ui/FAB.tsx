'use client'

type Props = {
  onClick: () => void
  icon: React.ReactNode
  label: string
  className?: string
}

// Botón flotante de acción principal, solo en mobile/tablet (<1024px).
// Posicionado por encima de la bottom tab bar.
export default function FAB({ onClick, icon, label, className = '' }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`lg:hidden fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-lg flex items-center justify-center transition-colors ${className}`}
    >
      {icon}
    </button>
  )
}
