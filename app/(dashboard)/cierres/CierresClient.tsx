'use client'

import Link from 'next/link'
import { formatearPeso, formatearFecha, nombreMes } from '@/lib/utils'
import { Archive, Download, Eye } from 'lucide-react'

type CierreFila = {
  id: string
  anio: number
  mes: number
  fecha_inicio: string
  fecha_fin: string
  fecha_cierre: string
  total_ventas: number
  total_egresos_caja: number
  ganancia_neta: number
  pdf_path: string | null
}

type Props = { cierres: CierreFila[] }

export default function CierresClient({ cierres }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cierres de Mes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Historial de meses cerrados</p>
        </div>
        <Link href="/cierres/nuevo" className="btn-primary flex items-center gap-2">
          <Archive size={16} /> Cerrar un mes
        </Link>
      </div>

      {cierres.length === 0 ? (
        <div className="card p-10 text-center">
          <Archive className="mx-auto text-slate-300 mb-3" size={40} />
          <p className="text-lg font-semibold text-slate-700 mb-2">Todavía no hay ningún mes cerrado</p>
          <p className="text-sm text-slate-500 mb-5">
            Cuando cierres un mes, va a quedar guardado acá con su PDF para consulta futura.
          </p>
          <Link href="/cierres/nuevo" className="btn-primary inline-flex items-center gap-2">
            <Archive size={16} /> Cerrar un mes
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-th">Período</th>
                  <th className="table-th">Cerrado el</th>
                  <th className="table-th text-right">Ventas</th>
                  <th className="table-th text-right">Gastos</th>
                  <th className="table-th text-right">Ganancia neta</th>
                  <th className="table-th text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cierres.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="table-td">
                      <p className="font-semibold text-slate-800">{nombreMes(c.mes)} {c.anio}</p>
                      <p className="text-xs text-slate-400">{formatearFecha(c.fecha_inicio)} – {formatearFecha(c.fecha_fin)}</p>
                    </td>
                    <td className="table-td text-slate-600">{formatearFecha(c.fecha_cierre)}</td>
                    <td className="table-td text-right font-medium">{formatearPeso(c.total_ventas)}</td>
                    <td className="table-td text-right font-medium">{formatearPeso(c.total_egresos_caja)}</td>
                    <td className={`table-td text-right font-bold ${c.ganancia_neta < 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {formatearPeso(c.ganancia_neta)}
                    </td>
                    <td className="table-td text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/cierres/${c.id}`} className="btn-secondary flex items-center gap-1.5 text-xs px-2.5 py-1.5">
                          <Eye size={14} /> Ver detalle
                        </Link>
                        {c.pdf_path && (
                          <a
                            href={`/cierres/${c.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary flex items-center gap-1.5 text-xs px-2.5 py-1.5"
                          >
                            <Download size={14} /> PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
