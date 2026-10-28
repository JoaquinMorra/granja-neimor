'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Caja } from '@/types'
import { formatearFecha, formatearPeso, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO, hoyISO } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastProvider'
import MobileCard from '@/components/ui/MobileCard'
import FilterChips from '@/components/ui/FilterChips'
import NumericInput from '@/components/ui/NumericInput'
import FAB from '@/components/ui/FAB'
import BottomSheet from '@/components/ui/BottomSheet'
import { Plus, TrendingUp, TrendingDown, CalendarDays, Pencil, Trash2, Banknote, ArrowLeftRight } from 'lucide-react'

type Periodo = { inicio: string; fin: string; label: string }

type Props = {
  movimientos: Caja[]
  periodoLabel: string
  periodoInicio: string
  periodoFin: string
  periodos: Periodo[]
  totalIngresos: number
  totalEgresos: number
  saldoMes: number
  saldoEfectivo: number
  saldoTransf: number
  cantFuturas: number
}

function fechaRelativa(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy'
  const ayer = new Date(hoy + 'T12:00:00')
  ayer.setDate(ayer.getDate() - 1)
  const ayerISO = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`
  if (fecha === ayerISO) return 'Ayer'
  const dias = Math.round((new Date(hoy + 'T12:00:00').getTime() - new Date(fecha + 'T12:00:00').getTime()) / 86400000)
  if (dias > 0 && dias < 7) return `Hace ${dias} días`
  return formatearFecha(fecha)
}

type FormState = {
  fecha: string
  tipo: 'INGRESO' | 'EGRESO'
  medio_pago: 'EFECTIVO' | 'TRANSFERENCIA'
  categoria: string
  descripcion: string
  monto: string
}

export default function CajaMobileView({
  movimientos, periodoLabel, periodoInicio, periodoFin, periodos,
  totalIngresos, totalEgresos, saldoMes, saldoEfectivo, saldoTransf, cantFuturas,
}: Props) {
  const router = useRouter()
  const toast = useToast()
  const hoy = hoyISO()

  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [detalle, setDetalle] = useState<Caja | null>(null)
  const [eligiendoTipo, setEligiendoTipo] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [movimientoEditandoId, setMovimientoEditandoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // ── Selector de período (mismo motor que desktop: fijo o rango a medida) ──
  const [periodoPickerAbierto, setPeriodoPickerAbierto] = useState(false)
  const [personalizadoAbierto, setPersonalizadoAbierto] = useState(false)
  const [inicioForm, setInicioForm] = useState(periodoInicio)
  const [finForm, setFinForm] = useState(periodoFin)
  const [periodoGuardado, setPeriodoGuardado] = useState<{ inicio: string; fin: string } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('caja-periodo-personalizado')
      if (raw) setPeriodoGuardado(JSON.parse(raw))
    } catch { /* localStorage no disponible */ }
  }, [])

  function irAPeriodo(inicio: string, fin: string) {
    setPeriodoPickerAbierto(false)
    router.push(`/caja?inicio=${inicio}&fin=${fin}`)
  }

  function aplicarPersonalizado(e: React.FormEvent) {
    e.preventDefault()
    try {
      localStorage.setItem('caja-periodo-personalizado', JSON.stringify({ inicio: inicioForm, fin: finForm }))
    } catch { /* sin problema si no se puede guardar */ }
    setPeriodoGuardado({ inicio: inicioForm, fin: finForm })
    irAPeriodo(inicioForm, finForm)
  }

  const movimientosFiltrados = movimientos.filter((m) => filtroTipo === 'todos' || m.tipo === filtroTipo)

  // ── Alta / edición (bottom sheet) ──────────────────────────────────────
  function abrirNuevo(tipo: 'INGRESO' | 'EGRESO') {
    setEligiendoTipo(false)
    setForm({ fecha: hoy, tipo, medio_pago: 'EFECTIVO', categoria: '', descripcion: '', monto: '' })
  }

  function abrirEditar(m: Caja) {
    setDetalle(null)
    setForm({
      fecha: m.fecha, tipo: m.tipo, medio_pago: m.medio_pago,
      categoria: m.categoria, descripcion: m.descripcion ?? '', monto: String(m.monto),
    })
    setMovimientoEditandoId(m.id)
  }

  async function guardarForm() {
    if (!form) return
    if (!form.categoria) { toast('Seleccioná una categoría.', 'error'); return }
    if (!form.monto || parseFloat(form.monto) <= 0) { toast('El monto debe ser mayor a 0.', 'error'); return }

    setGuardando(true)
    const supabase = createClient()
    const payload = {
      fecha: form.fecha,
      tipo: form.tipo,
      medio_pago: form.medio_pago,
      categoria: form.categoria,
      descripcion: form.descripcion || null,
      monto: parseFloat(form.monto),
    }
    const { error } = movimientoEditandoId
      ? await supabase.from('caja').update(payload).eq('id', movimientoEditandoId)
      : await supabase.from('caja').insert(payload)
    setGuardando(false)

    if (error) { toast(error.message, 'error'); return }
    toast(movimientoEditandoId ? '✓ Movimiento actualizado' : '✓ Movimiento registrado')
    setForm(null)
    setMovimientoEditandoId(null)
    router.refresh()
  }

  async function eliminar(m: Caja) {
    if (!confirm('¿Eliminar este movimiento?')) return
    setDetalle(null)
    const supabase = createClient()
    await supabase.from('caja').delete().eq('id', m.id)
    toast('✓ Movimiento eliminado')
    router.refresh()
  }

  const categoriasForm = form?.tipo === 'INGRESO' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO

  return (
    <div className="lg:hidden space-y-4">
      {/* Alerta movimientos futuros */}
      {cantFuturas > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Hay <strong>{cantFuturas}</strong> movimiento{cantFuturas > 1 ? 's' : ''} con fecha futura.
        </div>
      )}

      {/* Saldo actual */}
      <MobileCard className="text-center">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo del período</p>
        <p className={`text-4xl font-bold mt-1 ${saldoMes >= 0 ? 'text-green-700' : 'text-red-700'}`}>
          {formatearPeso(saldoMes)}
        </p>
        <div className="flex justify-center gap-6 mt-3 text-sm">
          <span className="text-green-700 font-medium">+ {formatearPeso(totalIngresos)}</span>
          <span className="text-red-700 font-medium">- {formatearPeso(totalEgresos)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 justify-center">
            <Banknote size={16} className="text-slate-400 shrink-0" />
            <div className="text-left">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">Efectivo</p>
              <p className={`font-bold ${saldoEfectivo >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatearPeso(saldoEfectivo)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <ArrowLeftRight size={16} className="text-slate-400 shrink-0" />
            <div className="text-left">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">Transferencia</p>
              <p className={`font-bold ${saldoTransf >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatearPeso(saldoTransf)}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setPeriodoPickerAbierto(true)}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full"
        >
          <CalendarDays size={13} /> {periodoLabel}
        </button>
      </MobileCard>

      {/* Filtros */}
      <FilterChips
        opciones={[
          { value: 'todos', label: 'Todo' },
          { value: 'INGRESO', label: 'Ingresos' },
          { value: 'EGRESO', label: 'Egresos' },
        ]}
        valor={filtroTipo}
        onChange={setFiltroTipo}
      />

      {/* Lista de movimientos */}
      <div className="pb-20">
        {movimientosFiltrados.length === 0 ? (
          <MobileCard><p className="text-center text-slate-400 py-6">Sin movimientos</p></MobileCard>
        ) : (
          movimientosFiltrados.map((m) => (
            <MobileCard key={m.id} onClick={() => setDetalle(m)} className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                m.tipo === 'INGRESO' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {m.tipo === 'INGRESO' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800 truncate">{m.categoria}</p>
                <p className="text-xs text-slate-400 truncate">{m.descripcion || (m.origen === 'puesto' ? 'Puesto' : 'Granja')}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-bold ${m.tipo === 'INGRESO' ? 'text-green-700' : 'text-red-700'}`}>
                  {m.tipo === 'INGRESO' ? '+' : '-'} {formatearPeso(m.monto)}
                </p>
                <p className="text-xs text-slate-400">{fechaRelativa(m.fecha, hoy)}</p>
              </div>
            </MobileCard>
          ))
        )}
      </div>

      <FAB onClick={() => setEligiendoTipo(true)} icon={<Plus size={26} />} label="Nuevo movimiento" />

      {/* Elegir tipo (desde el FAB) */}
      <BottomSheet abierto={eligiendoTipo} onClose={() => setEligiendoTipo(false)} titulo="Nuevo movimiento">
        <div className="space-y-3">
          <button
            onClick={() => abrirNuevo('INGRESO')}
            className="w-full flex items-center gap-3 bg-green-50 hover:bg-green-100 text-green-800 font-semibold rounded-xl px-4 py-4 text-left"
          >
            <TrendingUp size={22} /> Registrar INGRESO
          </button>
          <button
            onClick={() => abrirNuevo('EGRESO')}
            className="w-full flex items-center gap-3 bg-red-50 hover:bg-red-100 text-red-800 font-semibold rounded-xl px-4 py-4 text-left"
          >
            <TrendingDown size={22} /> Registrar EGRESO
          </button>
        </div>
      </BottomSheet>

      {/* Detalle de un movimiento */}
      <BottomSheet abierto={!!detalle} onClose={() => setDetalle(null)} titulo="Detalle del movimiento">
        {detalle && (
          <div className="space-y-3">
            <p className={`text-3xl font-bold ${detalle.tipo === 'INGRESO' ? 'text-green-700' : 'text-red-700'}`}>
              {detalle.tipo === 'INGRESO' ? '+' : '-'} {formatearPeso(detalle.monto)}
            </p>
            <div className="text-sm space-y-1.5 text-slate-600">
              <p><span className="text-slate-400">Categoría:</span> {detalle.categoria}</p>
              <p><span className="text-slate-400">Fecha:</span> {formatearFecha(detalle.fecha)}</p>
              <p><span className="text-slate-400">Medio:</span> {detalle.medio_pago === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo'}</p>
              <p><span className="text-slate-400">Origen:</span> {detalle.origen === 'puesto' ? 'Puesto' : 'Granja'}</p>
              {detalle.descripcion && <p><span className="text-slate-400">Descripción:</span> {detalle.descripcion}</p>}
            </div>
            <div className="flex gap-3 pt-3">
              <button onClick={() => abrirEditar(detalle)} className="flex-1 flex items-center justify-center gap-2 btn-secondary py-3">
                <Pencil size={16} /> Editar
              </button>
              <button
                onClick={() => eliminar(detalle)}
                className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-700 font-medium rounded-lg py-3"
              >
                <Trash2 size={16} /> Eliminar
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Formulario alta/edición */}
      <BottomSheet
        abierto={!!form}
        onClose={() => { setForm(null); setMovimientoEditandoId(null) }}
        titulo={movimientoEditandoId ? 'Editar movimiento' : `Nuevo ${form?.tipo === 'INGRESO' ? 'ingreso' : 'egreso'}`}
      >
        {form && (
          <div className="space-y-4">
            <div>
              <label className="label">Monto</label>
              <NumericInput
                decimal
                value={form.monto}
                onChange={(v) => setForm((p) => p && { ...p, monto: v })}
                autoFocus
                className="text-2xl"
              />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm((p) => p && { ...p, categoria: e.target.value })}
                className="input py-3"
              >
                <option value="">Seleccioná una categoría</option>
                {categoriasForm.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Fecha</label>
                <input type="date" value={form.fecha}
                  onChange={(e) => setForm((p) => p && { ...p, fecha: e.target.value })}
                  className="input py-3" />
              </div>
              <div>
                <label className="label">Medio</label>
                <select
                  value={form.medio_pago}
                  onChange={(e) => setForm((p) => p && { ...p, medio_pago: e.target.value as FormState['medio_pago'] })}
                  className="input py-3"
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Descripción (opcional)</label>
              <input type="text" value={form.descripcion}
                onChange={(e) => setForm((p) => p && { ...p, descripcion: e.target.value })}
                className="input py-3" placeholder="Detalle del movimiento..." />
            </div>
            <button
              onClick={guardarForm}
              disabled={guardando}
              className={`w-full h-14 rounded-xl text-white font-bold text-lg disabled:opacity-60 ${
                form.tipo === 'INGRESO' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {guardando ? 'Guardando...' : movimientoEditandoId ? 'GUARDAR CAMBIOS' : 'REGISTRAR'}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Selector de período */}
      <BottomSheet abierto={periodoPickerAbierto} onClose={() => setPeriodoPickerAbierto(false)} titulo="Elegir período">
        <div className="space-y-1">
          {periodoGuardado && (
            <button
              onClick={() => irAPeriodo(periodoGuardado.inicio, periodoGuardado.fin)}
              className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium ${
                periodoInicio === periodoGuardado.inicio && periodoFin === periodoGuardado.fin ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              📌 {formatearFecha(periodoGuardado.inicio)} – {formatearFecha(periodoGuardado.fin)}
            </button>
          )}
          {[...periodos].reverse().map((p) => (
            <button
              key={p.inicio}
              onClick={() => irAPeriodo(p.inicio, p.fin)}
              className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium ${
                p.inicio === periodoInicio ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setPersonalizadoAbierto((v) => !v)}
            className="w-full text-left px-3 py-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Rango personalizado…
          </button>
          {personalizadoAbierto && (
            <form onSubmit={aplicarPersonalizado} className="px-3 py-2 space-y-3">
              <div>
                <label className="label">Desde</label>
                <input type="date" value={inicioForm} onChange={(e) => setInicioForm(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Hasta</label>
                <input type="date" value={finForm} onChange={(e) => setFinForm(e.target.value)} className="input" required />
              </div>
              <button type="submit" className="btn-primary w-full">Aplicar</button>
            </form>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
