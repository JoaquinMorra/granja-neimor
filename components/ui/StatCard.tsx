type Props = {
  label: string
  value: string
  sublabel?: string
  color?: 'default' | 'green' | 'red' | 'amber'
}

const COLORES: Record<NonNullable<Props['color']>, string> = {
  default: 'text-slate-800',
  green: 'text-green-700',
  red: 'text-red-700',
  amber: 'text-amber-700',
}

// Card de métrica chica (número grande + label), para filas de KPIs en mobile.
export default function StatCard({ label, value, sublabel, color = 'default' }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 text-center">
      <p className={`text-xl font-bold ${COLORES[color]} truncate`}>{value}</p>
      <p className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">{label}</p>
      {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
    </div>
  )
}
