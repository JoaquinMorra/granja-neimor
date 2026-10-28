'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Galpon, LoteConCalculos, ProduccionDiaria } from '@/types'
import { formatearFecha, getPosturaEsperada, hoyISO } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastProvider'
import MobileCard from '@/components/ui/MobileCard'
import NumericInput from '@/components/ui/NumericInput'
import FilterChips from '@/components/ui/FilterChips'
import BottomSheet from '@/components/ui/BottomSheet'
import {
  CheckCircle2, TrendingUp, TrendingDown, Minus,
  Edit, Trash2, Filter, Egg, Skull, ChevronDown, ChevronUp,
} from 'lucide-react'

// Un color de acento por galpón (no por tipo colorada/blanca, que se repite
// entre galpones del mismo color y no alcanza para distinguirlos a simple
// vista). Se ciclan si hay más galpones que colores en la lista.
const COLORES_GALPON = [
  { borde: 'border-l-orange-400', franja: 'bg-orange-50', texto: 'text-orange-800' },
  { borde: 'border-l-blue-400', franja: 'bg-blue-50', texto: 'text-blue-800' },
  { borde: 'border-l-purple-400', franja: 'bg-purple-50', texto: 'text-purple-800' },
  { borde: 'border-l-teal-400', franja: 'bg-teal-50', texto: 'text-teal-800' },
  { borde: 'border-l-pink-400', franja: 'bg-pink-50', texto: 'text-pink-800' },
  { borde: 'border-l-indigo-400', franja: 'bg-indigo-50', texto: 'text-indigo-800' },
]

type RendimientoGalpon = {
  galpon: Galpon
  gallinasActivas: number
  avg7: number
  avg30: number
  postura7: number
  postura30: number
  tendencia: 'subiendo' | 'estable' | 'bajando'
  posturaEsperada: { min: number; max: number }
  detalle: { fecha: string; huevos: number; posturaPct: number }[]
}

type Props = {
  galpones: Galpon[]
  lotes: LoteConCalculos[]
  produccionReciente: ProduccionDiaria[]
  hoy: string
  totalesPorFecha: [string, { huevos: number; cajones: number; coloradas: number; blancas: number }][]
  rendimientoPorGalpon: RendimientoGalpon[]
  produccionFiltrada: ProduccionDiaria[]
  filtroGalpon: string
  setFiltroGalpon: (v: string) => void
  filtroSoloFuturas: boolean
  setFiltroSoloFuturas: (v: boolean) => void
  onEditar: (p: ProduccionDiaria) => void
  onEliminar: (p: ProduccionDiaria) => void
}

type ValoresForm = Record<string, { huevos: string; muertes: string }>

export default function ProduccionMobileView({
  galpones, lotes, produccionReciente, hoy,
  totalesPorFecha, rendimientoPorGalpon, produccionFiltrada,
  filtroGalpon, setFiltroGalpon, filtroSoloFuturas, setFiltroSoloFuturas,
  onEditar, onEliminar,
}: Props) {
  const router = useRouter()
  const toast = useToast()

  // ── Formulario de carga ──────────────────────────────────────────────────
  const [fecha, setFecha] = useState(hoy)
  const [valores, setValores] = useState<ValoresForm>({})
  const [guardando, setGuardando] = useState(false)
  const [confirmarSobreescribir, setConfirmarSobreescribir] = useState(false)
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({})

  const galponesConLotes = useMemo(
    () => galpones.map((g) => ({ galpon: g, lotesActivos: lotes.filter((l) => l.galpon_id === g.id && l.activo) }))
      .filter((g) => g.lotesActivos.length > 0),
    [galpones, lotes]
  )

  const datosExistentes = useMemo(() => {
    const mapa = new Map<string, { huevos: number; muertes: number }>()
    produccionReciente.filter((p) => p.fecha === fecha).forEach((p) => {
      mapa.set(p.lote_id, { huevos: p.huevos, muertes: p.muertes })
    })
    return mapa
  }, [produccionReciente, fecha])

  // Al cambiar de fecha, recarga el formulario con lo que ya había (si hay) o vacío.
  useEffect(() => {
    const iniciales: ValoresForm = {}
    for (const { lotesActivos } of galponesConLotes) {
      for (const l of lotesActivos) {
        const existente = datosExistentes.get(l.id)
        iniciales[l.id] = { huevos: existente ? existente.huevos.toString() : '', muertes: existente ? existente.muertes.toString() : '' }
      }
    }
    setValores(iniciales)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  // Orden de los campos para que "Siguiente" en el teclado salte en orden.
  const ordenCampos = useMemo(() => {
    const orden: string[] = []
    for (const { lotesActivos } of galponesConLotes) {
      for (const l of lotesActivos) {
        orden.push(`${l.id}:huevos`, `${l.id}:muertes`)
      }
    }
    return orden
  }, [galponesConLotes])

  function enfocarSiguiente(key: string) {
    const idx = ordenCampos.indexOf(key)
    const siguiente = idx >= 0 ? ordenCampos[idx + 1] : undefined
    if (siguiente) inputsRef.current[siguiente]?.focus()
    else inputsRef.current[key]?.blur()
  }

  function actualizarValor(loteId: string, campo: 'huevos' | 'muertes', valor: string) {
    setValores((prev) => ({ ...prev, [loteId]: { ...prev[loteId], [campo]: valor } }))
  }

  function construirRegistros() {
    const registros: { lote_id: string; fecha: string; huevos: number; muertes: number; deleted_at: null }[] = []
    for (const { lotesActivos } of galponesConLotes) {
      for (const l of lotesActivos) {
        const v = valores[l.id]
        if (!v || (v.huevos === '' && v.muertes === '')) continue
        registros.push({
          lote_id: l.id,
          fecha,
          huevos: parseInt(v.huevos || '0'),
          muertes: parseInt(v.muertes || '0'),
          deleted_at: null,
        })
      }
    }
    return registros
  }

  async function guardar() {
    const registros = construirRegistros()
    if (registros.length === 0) {
      toast('Ingresá al menos un valor para guardar.', 'error')
      return
    }
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase.from('produccion_diaria').upsert(registros, { onConflict: 'lote_id,fecha' })
    setGuardando(false)

    if (error) {
      toast(error.message, 'error')
      return
    }

    toast('✓ Producción cargada')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setValores((prev) => {
      const limpio: ValoresForm = {}
      Object.keys(prev).forEach((k) => { limpio[k] = { huevos: '', muertes: '' } })
      return limpio
    })
    router.refresh()
  }

  function handleGuardarClick() {
    const registros = construirRegistros()
    if (registros.length === 0) {
      toast('Ingresá al menos un valor para guardar.', 'error')
      return
    }
    const haySobreescritura = registros.some((r) => datosExistentes.has(r.lote_id))
    if (haySobreescritura) setConfirmarSobreescribir(true)
    else guardar()
  }

  // ── Historial (cards) ─────────────────────────────────────────────────────
  const [galponExpandidoMobile, setGalponExpandidoMobile] = useState<RendimientoGalpon | null>(null)
  const [filtroAbierto, setFiltroAbierto] = useState(false)
  // Colapsado por defecto (es lo que se consulta ocasionalmente, no la tarea
  // diaria) y, aunque se abra, se va mostrando de a poco en vez de todo junto.
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [cantidadVisible, setCantidadVisible] = useState(10)
  const produccionVisible = produccionFiltrada.slice(0, cantidadVisible)
  const quedanPorMostrar = produccionFiltrada.length - produccionVisible.length

  const diaSemanaFecha = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="lg:hidden space-y-5">
      {/* ── Formulario de carga ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-slate-500 capitalize">📅 {diaSemanaFecha}</p>
          <input
            type="date" value={fecha} max={hoy}
            onChange={(e) => setFecha(e.target.value)}
            className="input w-auto text-sm"
          />
        </div>

        {galponesConLotes.map(({ galpon, lotesActivos }, gIdx) => {
          const cargado = lotesActivos.every((l) => datosExistentes.has(l.id))
          const color = COLORES_GALPON[gIdx % COLORES_GALPON.length]
          return (
            <MobileCard key={galpon.id} className={`border-l-4 ${color.borde} overflow-hidden`}>
              {/* Franja de color: identifica el galpón de un vistazo, sin depender del tipo colorada/blanca */}
              <div className={`-mx-4 -mt-4 mb-3 px-4 py-2.5 flex items-center gap-2 ${color.franja}`}>
                <span className={`font-bold ${color.texto}`}>{galpon.nombre}</span>
                <span className="text-xs text-slate-400 capitalize">· {galpon.tipo}</span>
                {cargado && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-white/70 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={13} /> Cargado
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {lotesActivos.map((lote) => {
                  const v = valores[lote.id] ?? { huevos: '', muertes: '' }
                  const postura = getPosturaEsperada(lote.edad_semanas)
                  return (
                    <div key={lote.id} className={lotesActivos.length > 1 ? 'pt-3 border-t border-slate-100 first:pt-0 first:border-0' : ''}>
                      {lotesActivos.length > 1 && (
                        <p className="text-xs font-semibold text-slate-500 mb-2">{lote.nombre} · {lote.gallinas_actuales.toLocaleString()} gall.</p>
                      )}
                      <label className="text-sm font-medium text-amber-700 mb-1 flex items-center gap-1.5">
                        <Egg size={15} /> Huevos del día
                        {postura.min > 0 && <span className="text-slate-400 font-normal">· esperado {postura.min}-{postura.max}%</span>}
                      </label>
                      <NumericInput
                        ref={(el) => { inputsRef.current[`${lote.id}:huevos`] = el }}
                        value={v.huevos}
                        onChange={(val) => actualizarValor(lote.id, 'huevos', val)}
                        enterKeyHint="next"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enfocarSiguiente(`${lote.id}:huevos`) } }}
                        className="border-amber-300 bg-amber-50/50 focus:ring-amber-500"
                      />
                      <label className="text-sm font-medium text-red-600 mb-1 mt-3 flex items-center gap-1.5">
                        <Skull size={15} /> Muertes del día (opcional)
                      </label>
                      <NumericInput
                        ref={(el) => { inputsRef.current[`${lote.id}:muertes`] = el }}
                        value={v.muertes}
                        onChange={(val) => actualizarValor(lote.id, 'muertes', val)}
                        enterKeyHint={gIdx === galponesConLotes.length - 1 ? 'done' : 'next'}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enfocarSiguiente(`${lote.id}:muertes`) } }}
                        className="border-red-200 bg-red-50/40 text-red-700 focus:ring-red-500"
                      />
                    </div>
                  )
                })}
              </div>
            </MobileCard>
          )
        })}

        <button
          onClick={handleGuardarClick}
          disabled={guardando}
          className="sticky bottom-20 w-full h-14 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-60 text-white font-bold text-lg shadow-lg transition-colors"
        >
          {guardando ? 'Guardando...' : 'GUARDAR PRODUCCIÓN DEL DÍA'}
        </button>
      </div>

      {/* ── Resumen últimos 7 días ── */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-2">Resumen últimos 7 días</h3>
        {totalesPorFecha.length === 0 ? (
          <MobileCard><p className="text-center text-slate-400 py-4">Sin registros</p></MobileCard>
        ) : (
          totalesPorFecha.map(([f, t]) => (
            <MobileCard key={f} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{formatearFecha(f)}</p>
                <p className="text-xs text-slate-400">{t.huevos.toLocaleString('es-AR')} huevos</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800">{t.cajones.toFixed(1)} caj.</p>
                <p className="text-xs text-slate-400">
                  <span className="text-orange-600">{(t.coloradas / 360).toFixed(1)}</span> col. ·{' '}
                  <span className="text-blue-600">{(t.blancas / 360).toFixed(1)}</span> bla.
                </p>
              </div>
            </MobileCard>
          ))
        )}
      </div>

      {/* ── Rendimiento por galpón ── */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-2">Rendimiento por galpón</h3>
        {rendimientoPorGalpon.map((r) => (
          <MobileCard key={r.galpon.id} onClick={() => setGalponExpandidoMobile(r)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${r.galpon.tipo === 'coloradas' ? 'bg-orange-400' : 'bg-blue-400'}`} />
                <span className="font-bold text-slate-800">{r.galpon.nombre}</span>
              </div>
              {r.tendencia === 'subiendo' && <TrendingUp size={16} className="text-green-600" />}
              {r.tendencia === 'bajando' && <TrendingDown size={16} className="text-red-600" />}
              {r.tendencia === 'estable' && <Minus size={16} className="text-slate-400" />}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div>
                <p className="text-lg font-bold text-slate-800">{r.postura7.toFixed(1)}%</p>
                <p className="text-[11px] text-slate-400">postura 7d</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-600">{r.avg7.toLocaleString('es-AR')}</p>
                <p className="text-[11px] text-slate-400">prom. huevos</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-600">{r.gallinasActivas.toLocaleString('es-AR')}</p>
                <p className="text-[11px] text-slate-400">gallinas</p>
              </div>
            </div>
          </MobileCard>
        ))}
      </div>

      <BottomSheet
        abierto={!!galponExpandidoMobile}
        onClose={() => setGalponExpandidoMobile(null)}
        titulo={galponExpandidoMobile?.galpon.nombre}
      >
        {galponExpandidoMobile && (
          <div className="space-y-3">
            {galponExpandidoMobile.posturaEsperada.min > 0 && (
              <p className="text-sm text-slate-500">
                Postura esperada: {galponExpandidoMobile.posturaEsperada.min}–{galponExpandidoMobile.posturaEsperada.max}%
              </p>
            )}
            {galponExpandidoMobile.detalle.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">Sin datos en los últimos 30 días</p>
            ) : (
              [...galponExpandidoMobile.detalle].reverse().map(({ fecha: f, huevos, posturaPct }) => (
                <div key={f} className="flex items-center justify-between text-sm border-b border-slate-50 py-2">
                  <span className="text-slate-600">{formatearFecha(f)}</span>
                  <span className="font-semibold text-slate-800">{huevos.toLocaleString('es-AR')} huevos</span>
                  <span className={`font-medium ${
                    galponExpandidoMobile.posturaEsperada.min > 0 && posturaPct < galponExpandidoMobile.posturaEsperada.min
                      ? 'text-amber-600' : 'text-green-700'
                  }`}>
                    {posturaPct.toFixed(1)}%
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </BottomSheet>

      {/* ── Historial de cargas (colapsado por defecto) ── */}
      <div>
        <button
          onClick={() => setHistorialAbierto((v) => !v)}
          className="w-full flex items-center justify-between py-1"
        >
          <h3 className="font-semibold text-slate-800">Historial de cargas (30 días)</h3>
          {historialAbierto ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>

        {historialAbierto && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">{produccionFiltrada.length} registros</p>
              <button onClick={() => setFiltroAbierto((v) => !v)} className="text-slate-400 p-1.5">
                <Filter size={16} />
              </button>
            </div>
            {filtroAbierto && (
              <div className="mb-3 space-y-2">
                <FilterChips
                  opciones={[{ value: 'todos', label: 'Todos los galpones' }, ...galpones.map((g) => ({ value: g.nombre, label: g.nombre }))]}
                  valor={filtroGalpon}
                  onChange={setFiltroGalpon}
                />
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={filtroSoloFuturas} onChange={(e) => setFiltroSoloFuturas(e.target.checked)} className="rounded" />
                  Solo fechas futuras
                </label>
              </div>
            )}
            {produccionFiltrada.length === 0 ? (
              <MobileCard><p className="text-center text-slate-400 py-4">Sin registros para los filtros aplicados</p></MobileCard>
            ) : (
              <>
                {produccionVisible.map((p) => {
                  const esFutura = p.fecha > hoy
                  const galponNombre = (p.lote as any)?.galpon?.nombre ?? '—'
                  return (
                    <MobileCard key={p.id} className={esFutura ? 'bg-amber-50/60' : ''}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800">
                            {formatearFecha(p.fecha)}
                            {esFutura && <span className="ml-1.5 text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">futura</span>}
                          </p>
                          <p className="text-xs text-slate-400">{galponNombre}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">{p.huevos.toLocaleString('es-AR')} huevos</p>
                          {p.muertes > 0 && <p className="text-xs text-red-600">{p.muertes} muertes</p>}
                        </div>
                      </div>
                      <div className="flex gap-4 mt-3 pt-2 border-t border-slate-100">
                        <button onClick={() => onEditar(p)} className="flex items-center gap-1.5 text-sm text-blue-600 font-medium py-1">
                          <Edit size={15} /> Editar
                        </button>
                        <button onClick={() => onEliminar(p)} className="flex items-center gap-1.5 text-sm text-red-600 font-medium py-1">
                          <Trash2 size={15} /> Eliminar
                        </button>
                      </div>
                    </MobileCard>
                  )
                })}
                {quedanPorMostrar > 0 && (
                  <button
                    onClick={() => setCantidadVisible((v) => v + 10)}
                    className="w-full py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg"
                  >
                    Ver {Math.min(10, quedanPorMostrar)} más ({quedanPorMostrar} restantes)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <BottomSheet
        abierto={confirmarSobreescribir}
        onClose={() => setConfirmarSobreescribir(false)}
        titulo="¿Sobreescribir carga?"
      >
        <p className="text-sm text-slate-600 mb-5">
          Ya cargaste producción para el {formatearFecha(fecha)} en alguno de estos galpones. ¿Querés sobreescribir los valores?
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmarSobreescribir(false)} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={() => { setConfirmarSobreescribir(false); guardar() }}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-4 py-2.5"
          >
            Sobreescribir
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
