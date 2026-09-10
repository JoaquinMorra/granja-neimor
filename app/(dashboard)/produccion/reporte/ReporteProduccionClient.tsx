'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReporteProduccionPeriodo } from '@/lib/produccion/reporte'
import { formatearFecha } from '@/lib/utils'
import { ArrowLeft, Egg } from 'lucide-react'

type Periodo = { inicio: string; fin: string; label: string }

type Props = {
  reporte: ReporteProduccionPeriodo
  fechaInicio: string
  fechaFin: string
  periodoAnterior: Periodo
  periodoActual: Periodo
  hoy: string
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function ultimos30Dias(hoy: string): { inicio: string; fin: string } {
  const fin = new Date(hoy + 'T12:00:00')
  const inicio = new Date(fin)
  inicio.setDate(inicio.getDate() - 29)
  return { inicio: toISO(inicio), fin: toISO(fin) }
}

export default function ReporteProduccionClient({
  reporte, fechaInicio, fechaFin, periodoAnterior, periodoActual, hoy,
}: Props) {
  const router = useRouter()
  const ultimos30 = ultimos30Dias(hoy)
  const esPersonalizado =
    !(fechaInicio === periodoAnterior.inicio && fechaFin === periodoAnterior.fin) &&
    !(fechaInicio === periodoActual.inicio && fechaFin === periodoActual.fin) &&
    !(fechaInicio === ultimos30.inicio && fechaFin === ultimos30.fin)

  const [modoPersonalizado, setModoPersonalizado] = useState(esPersonalizado)
  const [inicioForm, setInicioForm] = useState(fechaInicio)
  const [finForm, setFinForm] = useState(fechaFin)

  function irA(inicio: string, fin: string) {
    setModoPersonalizado(false)
    router.push(`/produccion/reporte?inicio=${inicio}&fin=${fin}`)
  }

  function aplicarPersonalizado(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/produccion/reporte?inicio=${inicioForm}&fin=${finForm}`)
  }

  const btnClase = (activo: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      activo ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`

  const { porGalpon, totalHuevos, totalCajones, totalDiasConProduccion, promedioDiarioPeriodo, posturaPromedioPonderada } = reporte

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/produccion" className="hover:text-slate-700 flex items-center gap-1">
          <ArrowLeft size={14} /> Producción
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">Reporte por período</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reporte de producción</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Producción del período {formatearFecha(fechaInicio)} al {formatearFecha(fechaFin)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => irA(periodoAnterior.inicio, periodoAnterior.fin)}
          className={btnClase(!modoPersonalizado && fechaInicio === periodoAnterior.inicio && fechaFin === periodoAnterior.fin)}>
          Período anterior ({periodoAnterior.label})
        </button>
        <button onClick={() => irA(periodoActual.inicio, periodoActual.fin)}
          className={btnClase(!modoPersonalizado && fechaInicio === periodoActual.inicio && fechaFin === periodoActual.fin)}>
          Período actual ({periodoActual.label})
        </button>
        <button onClick={() => irA(ultimos30.inicio, ultimos30.fin)}
          className={btnClase(!modoPersonalizado && fechaInicio === ultimos30.inicio && fechaFin === ultimos30.fin)}>
          Últimos 30 días
        </button>
        <button onClick={() => setModoPersonalizado(true)} className={btnClase(modoPersonalizado)}>
          Personalizado
        </button>
      </div>

      {modoPersonalizado && (
        <form onSubmit={aplicarPersonalizado} className="card p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Desde</label>
            <input type="date" value={inicioForm} onChange={(e) => setInicioForm(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" value={finForm} onChange={(e) => setFinForm(e.target.value)} className="input" required />
          </div>
          <button type="submit" className="btn-primary">Aplicar</button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Producción total del período</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalCajones.toFixed(1)} cajones</p>
          <p className="text-xs text-slate-400 mt-0.5">{totalHuevos.toLocaleString('es-AR')} huevos</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Promedio diario del período</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{Math.round(promedioDiarioPeriodo).toLocaleString('es-AR')} huevos/día</p>
          <p className="text-xs text-slate-400 mt-0.5">{totalDiasConProduccion} días con producción</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Postura promedio ponderada</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{posturaPromedioPonderada.toFixed(1)} %</p>
          <p className="text-xs text-slate-400 mt-0.5">Sobre el plantel actual</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Producción por galpón</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Galpón</th>
                <th className="table-th">Tipo</th>
                <th className="table-th text-right">Días con producción</th>
                <th className="table-th text-right">Huevos totales</th>
                <th className="table-th text-right">Cajones</th>
                <th className="table-th text-right">Promedio diario</th>
                <th className="table-th text-right">% del total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {porGalpon.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-td text-center text-slate-400 py-10">
                    <Egg className="inline-block mb-2 text-slate-300" size={28} />
                    <br />Sin producción cargada en este período
                  </td>
                </tr>
              ) : (
                porGalpon.map((g) => (
                  <tr key={g.galponId} className="hover:bg-slate-50">
                    <td className="table-td font-medium">{g.galpon}</td>
                    <td className="table-td text-xs capitalize">{g.tipo}</td>
                    <td className="table-td text-right">{g.diasConProduccion}</td>
                    <td className="table-td text-right">{g.huevosTotales.toLocaleString('es-AR')}</td>
                    <td className="table-td text-right">{g.cajones.toFixed(1)}</td>
                    <td className="table-td text-right">{Math.round(g.promedioDiario).toLocaleString('es-AR')}</td>
                    <td className="table-td text-right">{g.porcentajeDelTotal.toFixed(1)} %</td>
                  </tr>
                ))
              )}
            </tbody>
            {porGalpon.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="table-td" colSpan={2}>TOTAL</td>
                  <td className="table-td text-right">{totalDiasConProduccion}</td>
                  <td className="table-td text-right">{totalHuevos.toLocaleString('es-AR')}</td>
                  <td className="table-td text-right">{totalCajones.toFixed(1)}</td>
                  <td className="table-td text-right">{Math.round(promedioDiarioPeriodo).toLocaleString('es-AR')}</td>
                  <td className="table-td text-right">100 %</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
