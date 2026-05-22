'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatearPeso } from '@/lib/utils'
import { Settings, AlertTriangle } from 'lucide-react'

type ProductoMin = { id: string; codigo: string; nombre: string; precio_mayorista: number; precio_minorista: number; unidades_por_caja: number }

type Props = {
  periodos: { inicio: string; fin: string; label: string }[]
  periodoInicio: string
  periodoLabel: string
  alimentoConsumo: number
  kgEstimados: number
  kgEstimadosBlancas: number
  kgEstimadosColoradas: number
  gallinasBlancas: number
  gallinasColoradas: number
  sueldos: number
  maples: number
  mantenimiento: number
  combustible: number
  gastosGenerales: number
  sanidad: number
  amortizacionAves: number
  huevosTotales: number
  gallinasActivas: number
  diasPeriodo: number
  productos: ProductoMin[]
  ventasPorTipo: Record<string, { monto: number; huevos: number }>
  config: { costo_recria_por_ave: number; vida_util_semanas: number; precio_kg_alimento: number }
}

// Mapeo código → tipo_venta legacy (para cruzar con ventasPorTipo)
const CODIGO_A_TIPO: Record<string, string> = {
  CAJON: 'CAJON', CAJONB1: 'CAJONB1', CAJONB2: 'CAJONB2',
  CAJON_B3: 'CAJON B3', CAJITAS_DOCENA: 'CAJITAS DOCENA',
  CAJITAS_MEDIA: 'CAJITAS 1/2 DOCENA', MAPLE: 'MAPLE',
}

export default function CostosClient({
  periodos, periodoInicio, periodoLabel,
  alimentoConsumo, kgEstimados, kgEstimadosBlancas, kgEstimadosColoradas,
  gallinasBlancas, gallinasColoradas,
  sueldos, maples, mantenimiento, combustible, gastosGenerales, sanidad, amortizacionAves,
  huevosTotales, gallinasActivas, diasPeriodo,
  productos, ventasPorTipo, config,
}: Props) {
  const router = useRouter()

  const sinPrecioKg = config.precio_kg_alimento === 0

  const totalCostos =
    alimentoConsumo + sueldos + maples + mantenimiento +
    combustible + gastosGenerales + sanidad + amortizacionAves

  const docenas = huevosTotales / 12
  const cajones = huevosTotales / 360

  const costoPorHuevo = huevosTotales > 0 ? totalCostos / huevosTotales : 0
  const costoPorDocena = docenas > 0 ? totalCostos / docenas : 0
  const costoPorCajon = cajones > 0 ? totalCostos / cajones : 0

  const fuenteAlimento = config.precio_kg_alimento > 0
    ? `${kgEstimados.toFixed(0)} kg estimados × $${config.precio_kg_alimento.toLocaleString('es-AR')}/kg (${gallinasBlancas > 0 ? `${gallinasBlancas.toLocaleString('es-AR')} blancas × 115g` : ''}${gallinasBlancas > 0 && gallinasColoradas > 0 ? ' + ' : ''}${gallinasColoradas > 0 ? `${gallinasColoradas.toLocaleString('es-AR')} coloradas × 120g` : ''})`
    : 'Sin precio/kg configurado — ir a Configuración'

  const filasCostos = [
    { label: 'Alimento (consumo)', monto: alimentoConsumo, fuente: fuenteAlimento },
    { label: 'Sueldos', monto: sueldos, fuente: 'Egresos caja categoría "Sueldos"' },
    { label: 'Maples', monto: maples, fuente: 'Egresos caja categoría "Maples"' },
    { label: 'Mantenimiento', monto: mantenimiento, fuente: 'Egresos caja categoría "Mantenimiento"' },
    { label: 'Combustible', monto: combustible, fuente: 'Egresos caja categoría "Combustible"' },
    { label: 'Gastos generales', monto: gastosGenerales, fuente: 'Egresos caja categoría "Gastos generales"' },
    { label: 'Sanidad', monto: sanidad, fuente: 'Egresos caja categoría "Sanidad" y "Medicación"' },
    { label: 'Amortización aves', monto: amortizacionAves, fuente: `${gallinasActivas.toLocaleString('es-AR')} gallinas × ($${config.costo_recria_por_ave.toLocaleString('es-AR')} / ${config.vida_util_semanas} sem) × ${(diasPeriodo / 7).toFixed(1)} sem` },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Costo del huevo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Período: {periodoLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodoInicio}
            onChange={(e) => router.push(`/costos?periodo=${e.target.value}`)}
            className="input w-auto text-sm"
          >
            {[...periodos].reverse().map((p) => (
              <option key={p.inicio} value={p.inicio}>{p.label}</option>
            ))}
          </select>
          <Link href="/costos/configuracion" className="btn-secondary flex items-center gap-1.5 text-sm">
            <Settings size={15} /> Configuración
          </Link>
        </div>
      </div>

      {/* Alerta precio kg sin configurar */}
      {sinPrecioKg && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-amber-800">
            El <strong>precio por kg de alimento</strong> no está configurado. El costo de alimento figura en $0.{' '}
            <Link href="/costos/configuracion" className="underline font-medium">Configurar ahora →</Link>
          </p>
        </div>
      )}

      {/* Sección 1: Inputs de costos */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Costos del período</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Categoría</th>
                <th className="table-th text-right">Monto</th>
                <th className="table-th">Fuente / Cálculo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filasCostos.map(({ label, monto, fuente }) => (
                <tr key={label} className="hover:bg-slate-50">
                  <td className="table-td font-medium">{label}</td>
                  <td className="table-td text-right font-semibold text-slate-800">{formatearPeso(monto)}</td>
                  <td className="table-td text-xs text-slate-500">{fuente}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 border-t border-slate-200">
                <td className="table-td font-bold text-slate-900">Total costos</td>
                <td className="table-td text-right font-bold text-slate-900 text-lg">{formatearPeso(totalCostos)}</td>
                <td className="table-td"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Sección 2: Consumo de alimento */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Consumo estimado de alimento</h3>
        <div className="grid grid-cols-3 gap-4">
          {gallinasBlancas > 0 && (
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Blancas ({gallinasBlancas.toLocaleString('es-AR')} gallinas)</p>
              <p className="text-xl font-bold text-slate-800">{kgEstimadosBlancas.toFixed(0)} kg</p>
              <p className="text-xs text-slate-400 mt-0.5">115 g/día × {diasPeriodo} días</p>
            </div>
          )}
          {gallinasColoradas > 0 && (
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Coloradas ({gallinasColoradas.toLocaleString('es-AR')} gallinas)</p>
              <p className="text-xl font-bold text-slate-800">{kgEstimadosColoradas.toFixed(0)} kg</p>
              <p className="text-xs text-slate-400 mt-0.5">120 g/día × {diasPeriodo} días</p>
            </div>
          )}
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-xs text-slate-500 mb-1">Total consumo</p>
            <p className="text-xl font-bold text-blue-800">{kgEstimados.toFixed(0)} kg</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {config.precio_kg_alimento > 0
                ? `× $${config.precio_kg_alimento.toLocaleString('es-AR')}/kg`
                : 'Sin precio configurado'}
            </p>
          </div>
        </div>
      </div>

      {/* Sección 3: Producción */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Producción del período</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500 mb-1">Huevos totales</p>
            <p className="text-2xl font-bold text-slate-800">{huevosTotales.toLocaleString('es-AR')}</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500 mb-1">Docenas</p>
            <p className="text-2xl font-bold text-slate-800">{Math.floor(docenas).toLocaleString('es-AR')}</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500 mb-1">Cajones</p>
            <p className="text-2xl font-bold text-slate-800">{cajones.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Sección 4: Resultado */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-3">Costo de producción</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5 text-center border-l-4 border-l-blue-400">
            <p className="text-xs text-slate-500 mb-1">Costo por huevo</p>
            <p className="text-3xl font-bold text-blue-800">{formatearPeso(costoPorHuevo)}</p>
          </div>
          <div className="card p-5 text-center border-l-4 border-l-purple-400">
            <p className="text-xs text-slate-500 mb-1">Costo por docena</p>
            <p className="text-3xl font-bold text-purple-800">{formatearPeso(costoPorDocena)}</p>
          </div>
          <div className="card p-5 text-center border-l-4 border-l-amber-400">
            <p className="text-xs text-slate-500 mb-1">Costo por cajón</p>
            <p className="text-3xl font-bold text-amber-800">{formatearPeso(costoPorCajon)}</p>
          </div>
        </div>
      </div>

      {/* Sección 5: Comparación con precios de venta */}
      {productos.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Margen por SKU</h3>
            <p className="text-xs text-slate-500 mt-0.5">Precio venta promedio vs costo unitario calculado</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-th">SKU</th>
                  <th className="table-th text-right">Unidades</th>
                  <th className="table-th text-right">Costo unitario</th>
                  <th className="table-th text-right">P. venta promedio</th>
                  <th className="table-th text-right">Margen $</th>
                  <th className="table-th text-right">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {productos.map((prod) => {
                  const tipoLegacy = CODIGO_A_TIPO[prod.codigo]
                  const vt = tipoLegacy ? ventasPorTipo[tipoLegacy] : undefined
                  const ventasHuevos = vt?.huevos ?? 0
                  const ventasMonto = vt?.monto ?? 0
                  const precioPromedioHuevo = ventasHuevos > 0 ? ventasMonto / ventasHuevos : prod.precio_mayorista / prod.unidades_por_caja
                  const precioVentaUnitario = precioPromedioHuevo * prod.unidades_por_caja
                  const costoUnitario = costoPorHuevo * prod.unidades_por_caja
                  const margenMonto = precioVentaUnitario - costoUnitario
                  const margenPct = precioVentaUnitario > 0 ? (margenMonto / precioVentaUnitario) * 100 : 0
                  const negativo = margenMonto < 0

                  return (
                    <tr key={prod.id} className={`hover:bg-slate-50 ${negativo ? 'bg-red-50' : ''}`}>
                      <td className="table-td">
                        <p className="font-mono text-xs font-semibold">{prod.codigo}</p>
                        <p className="text-xs text-slate-500">{prod.nombre}</p>
                      </td>
                      <td className="table-td text-right text-sm">{prod.unidades_por_caja}</td>
                      <td className="table-td text-right font-semibold">{formatearPeso(costoUnitario)}</td>
                      <td className="table-td text-right">
                        {ventasHuevos > 0
                          ? <span className="font-semibold">{formatearPeso(precioVentaUnitario)}</span>
                          : <span className="text-slate-400 text-xs">Sin ventas — {formatearPeso(prod.precio_mayorista)}</span>
                        }
                      </td>
                      <td className={`table-td text-right font-bold ${negativo ? 'text-red-700' : 'text-green-700'}`}>
                        {formatearPeso(margenMonto)}
                      </td>
                      <td className={`table-td text-right font-bold ${negativo ? 'text-red-700' : 'text-green-700'}`}>
                        {margenPct.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
