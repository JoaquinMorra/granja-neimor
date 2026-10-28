type Props = {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

// Card estándar para listas en mobile: padding, sombra y radius uniformes.
export default function MobileCard({ children, className = '', onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-md p-4 mb-3 ${onClick ? 'cursor-pointer active:bg-slate-50 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
