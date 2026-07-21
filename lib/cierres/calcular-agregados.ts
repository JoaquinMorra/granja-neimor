import type { createClient } from '@/lib/supabase/server'
import { calcularGallinasPorTipo, calcularCostoProyectado, calcularCostoReal, type CostoReal } from '@/lib/costos/calcular'
import { hoyISO, huevosACajones } from '@/lib/utils'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type VentaDetalle = {
  id: string
  fecha: string
  cliente: string
  tipo_venta: string
  producto: string | null
  cantidad: number
  precio_unitario: number | null
  monto: number
  estado: string
  monto_cobrado: number
  monto_debe: number
}

export type EgresoCajaDetalle = {
  id: string
  fecha: string
  categoria: string
  descripcion: string | null
  monto: number
  medio_pago: string
}

export type CompraProveedorDetalle = {
  id: string
  fecha: string
  proveedor: string
  descripcion: string
  cantidad: number
  unidad: string
  total: number
  estado: string
}

export type ProduccionDetalle = {
  id: string
  fecha: string
  galpon: string
  lote: string
  huevos: number
  muertes: number
}

export type AgregadosCierre = {
  // Totales
  totalVentas: number
  totalEgresosCaja: number
  totalIngresosCajaOtros: number
  totalComprasProveedor: number
  costoProduccionEstandar: number
  costoProduccionReal: CostoReal
  totalHuevos: number
  totalCajonesEquivalentes: number
  gananciaNeta: number
  gallinasActivas: number
  diasPeriodo: number

  // Desgloses (van al JSONB `detalle`)
  ventasPorProducto: { producto: string; cantidad: number; monto: number }[]
  ventasPorCliente: { cliente: string; monto: number }[]
  egresosPorCategoria: { categoria: string; monto: number }[]
  comprasPorProveedor: { proveedor: string; monto: number }[]
  produccionPorGalpon: { galpon: string; huevos: number; cajones: number }[]

  // Filas completas (para el preview y el PDF, no se guardan enteras en el JSONB)
  ventas: VentaDetalle[]
  egresosCaja: EgresoCajaDetalle[]
  comprasProveedor: CompraProveedorDetalle[]
  produccion: ProduccionDetalle[]

  // Avisos
  hayFechasFuturas: boolean
}

function sumBy<T>(items: T[], key: (item: T) => string, value: (item: T) => number): { key: string; monto: number }[] {
  const acc = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    acc.set(k, (acc.get(k) ?? 0) + value(item))
  }
  return Array.from(acc.entries())
    .map(([k, monto]) => ({ key: k, monto }))
    .sort((a, b) => b.monto - a.monto)
}

/**
 * Trae y agrega todos los datos del período [inicio, fin] necesarios para
 * el preview y la confirmación de un cierre de mes. Solo considera
 * registros con cierre_id IS NULL (evita doble conteo si algún rango se
 * superpone con un cierre ya existente).
 */
export async function calcularAgregadosCierre(
  supabase: SupabaseServerClient,
  inicio: string,
  fin: string
): Promise<AgregadosCierre> {
  const [
    { data: ventasRaw },
    { data: cajaRaw },
    { data: comprasRaw },
    { data: produccionRaw },
    { data: configRaw },
    { data: galponesRaw },
    { data: gallinasRaw },
  ] = await Promise.all([
    supabase
      .from('ventas')
      .select('id, fecha, cliente, tipo_venta, cantidad, precio_unitario, estado, monto_cobrado, monto_debe, cierre_id, producto:productos(nombre)')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .is('cierre_id', null),
    supabase
      .from('caja')
      .select('id, fecha, tipo, categoria, descripcion, monto, medio_pago, cierre_id')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .is('cierre_id', null),
    supabase
      .from('compras_proveedor')
      .select('id, fecha, descripcion, cantidad, unidad, total, estado, cierre_id, proveedor:proveedores(nombre, tipo)')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .is('cierre_id', null)
      .is('anulada_en', null),
    supabase
      .from('produccion_diaria')
      .select('id, fecha, huevos, muertes, cierre_id, lote:lotes(nombre, galpon:galpones(nombre))')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .is('cierre_id', null),
    supabase.from('config_costos').select('*').limit(1).single(),
    supabase.from('galpones').select('id, tipo'),
    supabase.from('gallinas_actuales').select('galpon_id, gallinas_actuales'),
  ])

  const nombreProveedor = (p: any): string => (Array.isArray(p) ? p[0]?.nombre : p?.nombre) ?? 'Sin proveedor'
  const tipoProveedor = (p: any): string | undefined => (Array.isArray(p) ? p[0]?.tipo : p?.tipo)
  const nombreProducto = (p: any): string => (Array.isArray(p) ? p[0]?.nombre : p?.nombre) ?? 'Sin producto'
  const loteInfo = (l: any): { lote: string; galpon: string } => {
    const lote = Array.isArray(l) ? l[0] : l
    const galpon = Array.isArray(lote?.galpon) ? lote.galpon[0] : lote?.galpon
    return { lote: lote?.nombre ?? 'Sin lote', galpon: galpon?.nombre ?? 'Sin galpón' }
  }

  const hoy = hoyISO()

  // ── Ventas ─────────────────────────────────────────────────────────────
  const ventas: VentaDetalle[] = (ventasRaw ?? []).map((v: any) => ({
    id: v.id,
    fecha: v.fecha,
    cliente: v.cliente,
    tipo_venta: v.tipo_venta,
    producto: v.producto ? nombreProducto(v.producto) : null,
    cantidad: v.cantidad,
    precio_unitario: v.precio_unitario,
    // Total real de la venta: monto_cobrado y monto_debe se cargan a mano
    // en el formulario y no siempre coinciden con precio_unitario * cantidad
    // (descuentos, precios especiales, etc.) — este es el valor autoritativo
    // que ya usa el resto de la app (ver VentasClient.tsx, dashboard).
    monto: (v.monto_cobrado ?? 0) + (v.monto_debe ?? 0),
    estado: v.estado,
    monto_cobrado: v.monto_cobrado ?? 0,
    monto_debe: v.monto_debe ?? 0,
  }))
  const totalVentas = ventas.reduce((s, v) => s + v.monto, 0)
  const ventasPorProducto = sumBy(
    ventas,
    (v) => v.producto ?? v.tipo_venta,
    (v) => v.monto
  ).map((r) => ({
    producto: r.key,
    cantidad: ventas.filter((v) => (v.producto ?? v.tipo_venta) === r.key).reduce((s, v) => s + v.cantidad, 0),
    monto: r.monto,
  }))
  const ventasPorCliente = sumBy(
    ventas,
    (v) => v.cliente,
    (v) => v.monto
  ).map((r) => ({ cliente: r.key, monto: r.monto }))

  // ── Caja (egresos = "gastos", ingresos = otros ingresos como puesto) ────
  const cajaRows = cajaRaw ?? []
  const egresosCaja: EgresoCajaDetalle[] = cajaRows
    .filter((c: any) => c.tipo === 'EGRESO')
    .map((c: any) => ({
      id: c.id,
      fecha: c.fecha,
      categoria: c.categoria,
      descripcion: c.descripcion,
      monto: c.monto,
      medio_pago: c.medio_pago,
    }))
  const totalEgresosCaja = egresosCaja.reduce((s, e) => s + e.monto, 0)
  const egresosPorCategoria = sumBy(
    egresosCaja,
    (e) => e.categoria,
    (e) => e.monto
  ).map((r) => ({ categoria: r.key, monto: r.monto }))
  const totalIngresosCajaOtros = cajaRows
    .filter((c: any) => c.tipo === 'INGRESO')
    .reduce((s: number, c: any) => s + (c.monto ?? 0), 0)

  // ── Compras a proveedores (costo real de insumos) ────────────────────────
  const comprasProveedor: CompraProveedorDetalle[] = (comprasRaw ?? []).map((c: any) => ({
    id: c.id,
    fecha: c.fecha,
    proveedor: nombreProveedor(c.proveedor),
    descripcion: c.descripcion,
    cantidad: c.cantidad,
    unidad: c.unidad,
    total: c.total,
    estado: c.estado,
  }))
  const totalComprasProveedor = comprasProveedor.reduce((s, c) => s + c.total, 0)
  const comprasPorProveedor = sumBy(
    comprasProveedor,
    (c) => c.proveedor,
    (c) => c.total
  ).map((r) => ({ proveedor: r.key, monto: r.monto }))

  // ── Producción ────────────────────────────────────────────────────────
  const produccion: ProduccionDetalle[] = (produccionRaw ?? []).map((p: any) => {
    const { lote, galpon } = loteInfo(p.lote)
    return { id: p.id, fecha: p.fecha, galpon, lote, huevos: p.huevos, muertes: p.muertes }
  })
  const totalHuevos = produccion.reduce((s, p) => s + p.huevos, 0)
  const totalCajonesEquivalentes = huevosACajones(totalHuevos)
  const produccionPorGalpon = sumBy(
    produccion,
    (p) => p.galpon,
    (p) => p.huevos
  ).map((r) => ({ galpon: r.key, huevos: r.monto, cajones: huevosACajones(r.monto) }))

  // ── Costos ────────────────────────────────────────────────────────────
  const config = { ...configRaw }
  const { blancas, coloradas } = calcularGallinasPorTipo(galponesRaw ?? [], gallinasRaw ?? [])
  const gallinasActivas = blancas + coloradas
  const diasPeriodo =
    Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / (1000 * 60 * 60 * 24)) + 1

  const costoProduccionEstandar = config.precio_kg_alimento
    ? calcularCostoProyectado(config, blancas, coloradas, diasPeriodo, diasPeriodo).costoTotal
    : 0

  const costoProduccionReal = calcularCostoReal({
    egresosCaja: egresosCaja.map((e) => ({ categoria: e.categoria, monto: e.monto })),
    comprasProveedor: (comprasRaw ?? []).map((c: any) => ({ total: c.total, proveedor: c.proveedor })),
    huevosProducidos: totalHuevos,
    gallinasActivas,
    config,
    diasPeriodo,
  })

  const gananciaNeta = totalVentas - totalEgresosCaja - totalComprasProveedor

  // ── Aviso de fechas futuras ───────────────────────────────────────────
  const hayFechasFuturas =
    ventas.some((v) => v.fecha > hoy) ||
    egresosCaja.some((e) => e.fecha > hoy) ||
    comprasProveedor.some((c) => c.fecha > hoy) ||
    produccion.some((p) => p.fecha > hoy)

  return {
    totalVentas,
    totalEgresosCaja,
    totalIngresosCajaOtros,
    totalComprasProveedor,
    costoProduccionEstandar,
    costoProduccionReal,
    totalHuevos,
    totalCajonesEquivalentes,
    gananciaNeta,
    gallinasActivas,
    diasPeriodo,
    ventasPorProducto,
    ventasPorCliente,
    egresosPorCategoria,
    comprasPorProveedor,
    produccionPorGalpon,
    ventas,
    egresosCaja,
    comprasProveedor,
    produccion,
    hayFechasFuturas,
  }
}
