import { createClient } from '@/lib/supabase/server'
import KPICard from '@/components/KPICard'
import {
  ProduccionSemanalChart,
  VentasMensualesChart,
  PosturaGalponesChart,
} from '@/components/charts/DashboardCharts'
import {
  Egg,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  CreditCard,
  Building2,
  Truck,
  Scale,
  Store,
  Package,
} from 'lucide-react'
import {
  calcularEdadSemanas,
  getPosturaEsperada,
  formatearPeso,
  huevosACajones,
  PUNTO_EQUILIBRIO_CAJONES,
  getUltimosPeriodos,
  getPeriodoActual,
} from '@/lib/utils'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

async function getDashboardData() {
  const supabase = await createClient()
  const hoy = new Date()
  const hoyISO = format(hoy, 'yyyy-MM-dd')
  const mesInicio = format(startOfMonth(hoy), 'yyyy-MM-dd')
  const mesFin = format(endOfMonth(hoy), 'yyyy-MM-dd')

  // Semana actual (últimos 7 días)
  const semanaInicio = format(subDays(hoy, 6), 'yyyy-MM-dd')

  // Últimos 6 períodos contables (6 al 5) para el gráfico de ventas
  const periodosVentas = getUltimosPeriodos(6)
  const periodoActual = getPeriodoActual()

  const [
    { data: galpones },
    { data: lotes },
    { data: produccionHoy },
    { data: produccionSemana },
    { data: ventasHoy },
    { data: ventasMes },
    { data: deudas },
    { data: ventasMensuales },
    { data: comprasProveedores },
    { data: puestoCierres },
    { data: puestoTransferencias },
  ] = await Promise.all([
    supabase.from('galpones').select('*').order('orden'),
    supabase.from('gallinas_actuales').select('*'),
    supabase.from('produccion_diaria').select('*, lote:lotes(*, galpon:galpones(*))').eq('fecha', hoyISO),
    supabase
      .from('produccion_diaria')
      .select('*, lote:lotes(*, galpon:galpones(*))')
      .gte('fecha', semanaInicio)
      .lte('fecha', hoyISO),
    supabase.from('ventas').select('monto_cobrado').eq('fecha', hoyISO),
    supabase.from('ventas').select('equivalente_huevos, tipo_venta').gte('fecha', mesInicio).lte('fecha', mesFin),
    supabase.from('ventas').select('monto_debe').neq('estado', 'PAGO'),
    supabase
      .from('ventas')
      .select('fecha, equivalente_huevos')
      .gte('fecha', periodosVentas[0].inicio)
      .order('fecha'),
    supabase.from('compras_proveedor').select('total, monto_pagado'),
    supabase
      .from('puesto_cierres')
      .select('fecha, total_efectivo, total_transferencia, items:puesto_cierre_items(cantidad, producto:productos(unidades_por_caja))')
      .is('deleted_at', null),
    supabase
      .from('puesto_transferencias')
      .select('fecha, items:puesto_transferencia_items(cantidad, producto:productos(unidades_por_caja))')
      .is('deleted_at', null),
  ])

  // Total gallinas por galpón
  const gallonasPorGalpon = (galpones ?? []).map((g) => {
    const lotesGalpon = (lotes ?? []).filter((l) => l.galpon_id === g.id)
    return {
      galpon: g.nombre,
      tipo: g.tipo,
      gallinas: lotesGalpon.reduce((s, l) => s + (l.gallinas_actuales ?? l.gallinas_inicial), 0),
    }
  })
  const totalGallinas = gallonasPorGalpon.reduce((s, g) => s + g.gallinas, 0)

  // Producción hoy
  const huevosHoy = (produccionHoy ?? []).reduce((s, p) => s + p.huevos, 0)
  const cajonesHoy = huevosHoy / 360

  // Ventas hoy y mes
  const montoVentasHoy = (ventasHoy ?? []).reduce((s, v) => s + (v.monto_cobrado ?? 0), 0)
  const montoVentasMes = (ventasMes ?? []).reduce((s, v) => s + (v.equivalente_huevos ?? 0), 0)
  const deudaTotal = (deudas ?? []).reduce((s, v) => s + (v.monto_debe ?? 0), 0)

  // Postura promedio por galpón
  const posturaGalpones = (galpones ?? []).map((g) => {
    const lotesGalpon = (lotes ?? []).filter((l) => l.galpon_id === g.id && l.activo)
    const prodHoyGalpon = (produccionHoy ?? []).filter((p) => {
      const lote = p.lote as any
      return lote?.galpon_id === g.id
    })
    const huevosGalpon = prodHoyGalpon.reduce((s, p) => s + p.huevos, 0)
    const gallinasGalpon = lotesGalpon.reduce((s, l) => s + (l.gallinas_actuales ?? l.gallinas_inicial), 0)
    const porcentajeReal = gallinasGalpon > 0 ? (huevosGalpon / gallinasGalpon) * 100 : 0

    // Postura esperada basada en edad promedio ponderada
    let edadPonderada: number | null = null
    if (lotesGalpon.length > 0) {
      const totalGal = gallinasGalpon
      const sumaEdad = lotesGalpon.reduce((s, l) => {
        const edad = calcularEdadSemanas(l.fecha_nacimiento)
        return s + (edad ?? 0) * (l.gallinas_actuales ?? l.gallinas_inicial)
      }, 0)
      edadPonderada = totalGal > 0 ? sumaEdad / totalGal : null
    }
    const { min, max } = getPosturaEsperada(edadPonderada)

    return {
      galpon: g.nombre,
      real: Math.round(porcentajeReal * 10) / 10,
      min,
      max,
      alerta: huevosGalpon > 0 && porcentajeReal < min,
    }
  })

  // Producción semanal agrupada por fecha y tipo
  const fechasSemana: string[] = []
  for (let i = 6; i >= 0; i--) {
    fechasSemana.push(format(subDays(hoy, i), 'yyyy-MM-dd'))
  }

  const prodSemanaChart = fechasSemana.map((fecha) => {
    const prodFecha = (produccionSemana ?? []).filter((p) => p.fecha === fecha)
    const coloradas = prodFecha
      .filter((p) => (p.lote as any)?.galpon?.tipo === 'coloradas')
      .reduce((s, p) => s + p.huevos, 0)
    const blancas = prodFecha
      .filter((p) => (p.lote as any)?.galpon?.tipo === 'blancas')
      .reduce((s, p) => s + p.huevos, 0)
    return { fecha, coloradas, blancas }
  })

  const cajEquiv = (cant: number, upCaja: number) => cant * upCaja / 360

  // Ventas últimos 6 períodos contables (6 al 5), en cajones
  // Combina ventas granja (histórico + mayoristas) + cierres del puesto
  const mesesVentas = periodosVentas.map(({ inicio, fin, label }) => {
    const cajonesGranja = (ventasMensuales ?? [])
      .filter((v) => v.fecha >= inicio && v.fecha <= fin)
      .reduce((s, v) => s + (v.equivalente_huevos ?? 0) / 360, 0)

    const cajonesPuesto = (puestoCierres ?? [])
      .filter((c: any) => c.fecha >= inicio && c.fecha <= fin)
      .reduce((s: number, c: any) =>
        s + (c.items as any[]).reduce((si: number, item: any) =>
          si + cajEquiv(item.cantidad, item.producto?.unidades_por_caja ?? 360), 0), 0)

    return { mes: label, cajones: Math.round((cajonesGranja + cajonesPuesto) * 10) / 10 }
  })

  const alertasCount = posturaGalpones.filter((p) => p.alerta).length

  // Deuda a proveedores
  const deudaProveedores = (comprasProveedores ?? []).reduce(
    (s: number, c: any) => s + Math.max(0, (c.total ?? 0) - (c.monto_pagado ?? 0)),
    0
  )

  // Cuentas por cobrar (deuda de clientes)
  const cuentasPorCobrar = deudaTotal

  // Caja neta = deuda clientes - deuda proveedores (simplificado)
  const cajaNeta = cuentasPorCobrar - deudaProveedores

  // KPIs del puesto mercado
  const ventasPuesto = (puestoCierres ?? [])
    .filter((c: any) => c.fecha >= periodoActual.inicio && c.fecha <= periodoActual.fin)
    .reduce((s: number, c: any) => s + c.total_efectivo + c.total_transferencia, 0)
  const stockPuestoCajones = (() => {
    let total = 0
    for (const t of puestoTransferencias ?? []) {
      for (const item of (t as any).items) {
        total += cajEquiv(item.cantidad, item.producto?.unidades_por_caja ?? 360)
      }
    }
    for (const c of puestoCierres ?? []) {
      for (const item of (c as any).items) {
        total -= cajEquiv(item.cantidad, item.producto?.unidades_por_caja ?? 360)
      }
    }
    return total
  })()
  const cajonesTransfPuesto = (puestoTransferencias ?? [])
    .filter((t: any) => t.fecha >= periodoActual.inicio && t.fecha <= periodoActual.fin)
    .reduce((s: number, t: any) =>
      s + (t.items as any[]).reduce((si: number, item: any) =>
        si + cajEquiv(item.cantidad, item.producto?.unidades_por_caja ?? 360), 0), 0)

  return {
    totalGallinas,
    gallonasPorGalpon,
    huevosHoy,
    cajonesHoy,
    montoVentasHoy,
    deudaTotal,
    deudaProveedores,
    cajaNeta,
    posturaGalpones,
    prodSemanaChart,
    mesesVentas,
    alertasCount,
    cajonesVendidosMes: montoVentasMes / 360,
    ventasPuesto,
    stockPuestoCajones,
    cajonesTransfPuesto,
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Alertas */}
      {data.alertasCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="text-red-500 shrink-0" size={20} />
          <p className="text-sm text-red-700 font-medium">
            {data.alertasCount} galpón{data.alertasCount > 1 ? 'es' : ''} con postura por debajo del nivel esperado
          </p>
        </div>
      )}

      {/* KPIs row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total gallinas"
          value={data.totalGallinas.toLocaleString('es-AR')}
          subtitle={`${data.gallonasPorGalpon.length} galpones activos`}
          icon={Building2}
          color="slate"
        />
        <KPICard
          title="Producción hoy"
          value={data.huevosHoy.toLocaleString('es-AR')}
          subtitle={`${data.cajonesHoy.toFixed(1)} cajones`}
          icon={Egg}
          color="amber"
        />
        <KPICard
          title="Ventas del día"
          value={formatearPeso(data.montoVentasHoy)}
          icon={ShoppingCart}
          color="green"
        />
        <KPICard
          title="Deuda pendiente"
          value={formatearPeso(data.deudaTotal)}
          subtitle="Total clientes"
          icon={CreditCard}
          color={data.deudaTotal > 0 ? 'red' : 'green'}
          alert={data.deudaTotal > 0}
        />
      </div>

      {/* KPIs proveedores */}
      <div className="grid grid-cols-2 gap-4">
        <KPICard
          title="Deuda a proveedores"
          value={formatearPeso(data.deudaProveedores)}
          subtitle="Compras sin pagar"
          icon={Truck}
          color={data.deudaProveedores > 0 ? 'red' : 'green'}
          alert={data.deudaProveedores > 0}
        />
        <KPICard
          title="Exposición neta"
          value={formatearPeso(Math.abs(data.cajaNeta))}
          subtitle={data.cajaNeta >= 0 ? 'A favor (cobrar > pagar)' : 'En contra (pagar > cobrar)'}
          icon={Scale}
          color={data.cajaNeta >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Puesto Mercado */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard
          title="Ventas del puesto"
          value={formatearPeso(data.ventasPuesto)}
          subtitle="Período actual"
          icon={Store}
          color="green"
        />
        <KPICard
          title="Stock en el puesto"
          value={data.stockPuestoCajones.toFixed(1)}
          subtitle="cajones equiv. disponibles"
          icon={Package}
          color="blue"
        />
        <KPICard
          title="Transferido al puesto"
          value={data.cajonesTransfPuesto.toFixed(1)}
          subtitle="cajones equiv. en el período"
          icon={Truck}
          color="slate"
        />
      </div>

      {/* KPIs row 2 - gallinas por galpón */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {data.gallonasPorGalpon.map((g) => (
          <KPICard
            key={g.galpon}
            title={g.galpon}
            value={g.gallinas.toLocaleString('es-AR')}
            subtitle={g.tipo === 'coloradas' ? 'Coloradas' : 'Blancas'}
            icon={Building2}
            color={g.tipo === 'coloradas' ? 'amber' : 'blue'}
          />
        ))}
      </div>

      {/* Postura por galpón */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {data.posturaGalpones.map((p) => (
          <KPICard
            key={p.galpon}
            title={`Postura ${p.galpon}`}
            value={`${p.real}%`}
            subtitle={`Esperado: ${p.min}-${p.max}%`}
            icon={TrendingUp}
            color={p.alerta ? 'red' : p.real >= p.min ? 'green' : 'amber'}
            alert={p.alerta}
          />
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Producción semanal */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Producción — últimos 7 días</h3>
          <ProduccionSemanalChart data={data.prodSemanaChart} />
        </div>

        {/* Ventas mensuales */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Ventas — últimos 6 meses (cajones)</h3>
          <p className="text-xs text-slate-500 mb-4">
            Punto de equilibrio: {PUNTO_EQUILIBRIO_CAJONES} cajones/semana
          </p>
          <VentasMensualesChart data={data.mesesVentas} />
        </div>

        {/* Postura vs ideal */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-4">% Postura real vs. esperado por galpón (hoy)</h3>
          <PosturaGalponesChart data={data.posturaGalpones} />
        </div>
      </div>
    </div>
  )
}
