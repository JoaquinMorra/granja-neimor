import type { LucideIcon } from 'lucide-react'

type KPICardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color?: 'blue' | 'green' | 'red' | 'amber' | 'slate'
  alert?: boolean
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    value: 'text-blue-900',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-100 text-green-600',
    value: 'text-green-900',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'bg-red-100 text-red-600',
    value: 'text-red-900',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'bg-amber-100 text-amber-600',
    value: 'text-amber-900',
  },
  slate: {
    bg: 'bg-slate-50',
    icon: 'bg-slate-100 text-slate-600',
    value: 'text-slate-900',
  },
}

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  alert = false,
}: KPICardProps) {
  const colors = colorMap[color]

  return (
    <div
      className={`card p-5 ${alert ? 'border-red-300 ring-1 ring-red-300' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {title}
          </p>
          <p className={`text-2xl font-bold mt-1 ${colors.value}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`${colors.icon} p-2.5 rounded-lg ml-3`}>
          <Icon size={20} />
        </div>
      </div>
      {alert && (
        <div className="mt-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-600 font-medium">Requiere atención</span>
        </div>
      )}
    </div>
  )
}
