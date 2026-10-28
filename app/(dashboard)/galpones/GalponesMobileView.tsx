'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Galpon, LoteConCalculos, VentaGallinas } from '@/types'
import { formatearFecha, formatearPeso, hoyISO } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastProvider'
import MobileCard from '@/components/ui/MobileCard'
import NumericInput from '@/components/ui/NumericInput'
import BottomSheet from '@/components/ui/BottomSheet'
import { Egg, Skull, Banknote, Package, CheckCircle2 } from 'lucide-react'

type ProduccionLite = { fecha: string; huevos: number; muertes: number; lote_id: string }

type Props = {
  galpones: Galpon[]
  lotes: LoteConCalculos[]
  ventasGallinas: VentaGallinas[]
  produccionReciente: ProduccionLite[]
  mostrarRetirados: boolean
  onNuevoLote: (galponId: string) => void
  onVentaGallinas: (lote: LoteConCalculos) => void
}

const COLORES_GALPON = [
  { franja: 'bg-orange-50', texto: 'text-orange-800', borde: 'border-l-orange-400' },
  { franja: 'bg-blue-50', texto: 'text-blue-800', borde: 'border-l-blue-400' },
  { franja: 'bg-purple-50', texto: 'text-purple-800', borde: 'border-l-purple-400' },
  { franja: 'bg-teal-50', texto: 'text-teal-800', borde: 'border-l-teal-400' },
  { franja: 'bg-pink-50', texto: 'text-pink-800', borde: 'border-l-pink-400' },
  { franja: 'bg-indigo-50', texto: 'text-indigo-800', borde: 'border-l-indigo-400' },
]

function colorBarra(pct: number): string {
  if (pct >= 70) return 'bg-green-500'
  if (pct >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

export default function GalponesMobileView({
  galpones, lotes, ventasGallinas, produccionReciente, mostrarRetirados,
  onNuevoLote, onVentaGallinas,
}: Props) {
  const router = useRouter()
  const toast = useToast()
  const hoy = hoyISO()

  const inicioMes = `${hoy.slice(0, 7)}-01`
  const fecha7dAtras = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]

  const datosPorGalpon = useMemo(() => {
    return galpones.map((galpon) => {
      const lotesGalpon = lotes.filter((l) => l.galpon_id === galpon.id)
      const lotesActivos = lotesGalpon.filter((l) => l.activo)
      const loteIds = lotesActivos.map((l) => l.id)
      const gallinasActivas = lotesActivos.reduce((s, l) => s + l.gallinas_actuales, 0)

      const prod = produccionReciente.filter((p) => loteIds.includes(p.lote_id) && p.fecha <= hoy)
      const prod7 = prod.filter((p) => p.fecha >= fecha7dAtras)
      const prodMes = prod.filter((p) => p.fecha >= inicioMes)

      const huevosPorFecha7 = new Map<string, number>()
      prod7.forEach((p) => huevosPorFecha7.set(p.fecha, (huevosPorFecha7.get(p.fecha) ?? 0) + p.huevos))
      const dias7 = huevosPorFecha7.size
      const suma7 = Array.from(huevosPorFecha7.values()).reduce((s, v) => s + v, 0)
      const avg7 = dias7 > 0 ? suma7 / dias7 : 0
      const postura7 = gallinasActivas > 0 ? (avg7 / gallinasActivas) * 100 : 0

      const huevosMes = prodMes.reduce((s, p) => s + p.huevos, 0)
      const cajonesMes = huevosMes / 360
      const muertes7 = prod7.reduce((s, p) => s + p.muertes, 0)

      const historial = Array.from(
        prod.reduce((mapa, p) => mapa.set(p.fecha, (mapa.get(p.fecha) ?? 0) + p.huevos), new Map<string, number>())
      ).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7)

      return { galpon, lotesActivos, gallinasActivas, postura7, cajonesMes, muertes7, historial }
    })
  }, [galpones, lotes, produccionReciente, hoy, fecha7dAtras, inicioMes])

  // ── Muertes rápidas ─────────────────────────────────────────────────────
  const [muertesPara, setMuertesPara] = useState<{ galpon: Galpon; lotesActivos: LoteConCalculos[] } | null>(null)
  const [valoresMuertes, setValoresMuertes] = useState<Record<string, string>>({})
  const [guardandoMuertes, setGuardandoMuertes] = useState(false)

  function abrirMuertes(galpon: Galpon, lotesActivos: LoteConCalculos[]) {
    const iniciales: Record<string, string> = {}
    lotesActivos.forEach((l) => {
      const existente = produccionReciente.find((p) => p.lote_id === l.id && p.fecha === hoy)
      iniciales[l.id] = existente ? existente.muertes.toString() : ''
    })
    setValoresMuertes(iniciales)
    setMuertesPara({ galpon, lotesActivos })
  }

  async function guardarMuertes() {
    if (!muertesPara) return
    setGuardandoMuertes(true)
    const supabase = createClient()
    const registros = muertesPara.lotesActivos.map((l) => {
      const existente = produccionReciente.find((p) => p.lote_id === l.id && p.fecha === hoy)
      return {
        lote_id: l.id,
        fecha: hoy,
        huevos: existente?.huevos ?? 0,
        muertes: parseInt(valoresMuertes[l.id] || '0'),
        deleted_at: null,
      }
    })
    const { error } = await supabase.from('produccion_diaria').upsert(registros, { onConflict: 'lote_id,fecha' })
    setGuardandoMuertes(false)
    if (error) { toast(error.message, 'error'); return }
    toast('✓ Muertes cargadas')
    setMuertesPara(null)
    router.refresh()
  }

  // ── Elegir lote cuando el galpón tiene más de uno activo ────────────────
  const [eligiendoLotePara, setEligiendoLotePara] = useState<{ accion: 'venta'; lotesActivos: LoteConCalculos[] } | null>(null)

  function iniciarVenta(lotesActivos: LoteConCalculos[]) {
    if (lotesActivos.length === 1) { onVentaGallinas(lotesActivos[0]); return }
    setEligiendoLotePara({ accion: 'venta', lotesActivos })
  }

  // ── Detalle (tap en la card) ─────────────────────────────────────────────
  const [detalle, setDetalle] = useState<(typeof datosPorGalpon)[number] | null>(null)

  return (
    <div className="lg:hidden space-y-3">
      {datosPorGalpon.map(({ galpon, lotesActivos, gallinasActivas, postura7, cajonesMes, muertes7 }, gIdx) => {
        if (lotesActivos.length === 0 && !mostrarRetirados) return null
        const color = COLORES_GALPON[gIdx % COLORES_GALPON.length]
        return (
          <MobileCard key={galpon.id} className={`border-l-4 ${color.borde} overflow-hidden`}>
            <div
              onClick={() => setDetalle(datosPorGalpon[gIdx])}
              className={`-mx-4 -mt-4 mb-3 px-4 py-2.5 flex items-center gap-2 ${color.franja}`}
            >
              <span className={`font-bold ${color.texto}`}>{galpon.nombre}</span>
              <span className="text-xs text-slate-400 capitalize">· {galpon.tipo}</span>
              {lotesActivos.length === 0 && (
                <span className="ml-auto text-xs text-slate-400">Sin lotes activos</span>
              )}
            </div>

            {lotesActivos.length > 0 && (
              <>
                <div className="flex justify-between items-end mb-2" onClick={() => setDetalle(datosPorGalpon[gIdx])}>
                  <div>
                    <p className="text-3xl font-bold text-slate-800">{postura7.toFixed(1)}%</p>
                    <p className="text-xs text-slate-400">postura (prom. 7d)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-700">{gallinasActivas.toLocaleString('es-AR')}</p>
                    <p className="text-xs text-slate-400">gallinas</p>
                  </div>
                </div>

                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full ${colorBarra(postura7)}`} style={{ width: `${Math.min(postura7, 100)}%` }} />
                </div>

                <div className="flex gap-4 text-xs text-slate-500 mb-3">
                  <span className="flex items-center gap-1"><Package size={13} /> {cajonesMes.toFixed(0)} cajones/mes</span>
                  <span className="flex items-center gap-1"><Skull size={13} /> {muertes7} muertes (7d)</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => router.push(`/produccion?galpon=${galpon.id}`)}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium"
                  >
                    <Egg size={18} /> Producción
                  </button>
                  <button
                    onClick={() => abrirMuertes(galpon, lotesActivos)}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium"
                  >
                    <Skull size={18} /> Muertes
                  </button>
                  <button
                    onClick={() => iniciarVenta(lotesActivos)}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium"
                  >
                    <Banknote size={18} /> Venta
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => onNuevoLote(galpon.id)}
              className="w-full mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 font-medium"
            >
              + Nuevo lote en este galpón
            </button>
          </MobileCard>
        )
      })}

      {/* Detalle del galpón */}
      <BottomSheet abierto={!!detalle} onClose={() => setDetalle(null)} titulo={detalle?.galpon.nombre}>
        {detalle && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Histórico de huevos — últimos días</p>
            {detalle.historial.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">Sin datos recientes</p>
            ) : (
              detalle.historial.map(([fecha, huevos]) => (
                <div key={fecha} className="flex items-center justify-between text-sm border-b border-slate-50 py-2">
                  <span className="text-slate-600">{formatearFecha(fecha)}</span>
                  <span className="font-semibold text-slate-800">{huevos.toLocaleString('es-AR')} huevos</span>
                </div>
              ))
            )}
          </div>
        )}
      </BottomSheet>

      {/* Elegir lote si el galpón tiene más de uno activo */}
      <BottomSheet abierto={!!eligiendoLotePara} onClose={() => setEligiendoLotePara(null)} titulo="Elegir lote">
        <div className="space-y-2">
          {eligiendoLotePara?.lotesActivos.map((l) => (
            <button
              key={l.id}
              onClick={() => { onVentaGallinas(l); setEligiendoLotePara(null) }}
              className="w-full text-left px-3 py-3 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700"
            >
              {l.nombre} · {l.gallinas_actuales.toLocaleString()} gallinas
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Muertes rápidas del día */}
      <BottomSheet abierto={!!muertesPara} onClose={() => setMuertesPara(null)} titulo={`Muertes de hoy — ${muertesPara?.galpon.nombre ?? ''}`}>
        {muertesPara && (
          <div className="space-y-4">
            {muertesPara.lotesActivos.map((l) => (
              <div key={l.id}>
                <label className="text-sm font-medium text-red-600 mb-1 flex items-center gap-1.5">
                  <Skull size={15} /> {l.nombre}
                </label>
                <NumericInput
                  value={valoresMuertes[l.id] ?? ''}
                  onChange={(v) => setValoresMuertes((prev) => ({ ...prev, [l.id]: v }))}
                  className="border-red-200 bg-red-50/40 text-red-700"
                  autoFocus={muertesPara.lotesActivos[0]?.id === l.id}
                />
              </div>
            ))}
            <button
              onClick={guardarMuertes}
              disabled={guardandoMuertes}
              className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} /> {guardandoMuertes ? 'Guardando...' : 'Guardar muertes'}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
