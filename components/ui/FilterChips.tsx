type Opcion = { value: string; label: string }

type Props = {
  opciones: Opcion[]
  valor: string
  onChange: (value: string) => void
}

// Chips horizontales scrolleables para filtros rápidos (estado, período, etc.)
export default function FilterChips({ opciones, valor, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {opciones.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`shrink-0 px-4 h-9 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            valor === o.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
