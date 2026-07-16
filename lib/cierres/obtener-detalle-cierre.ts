import type { createClient } from '@/lib/supabase/server'
import type { CierreMensual } from '@/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type VentaCerradaRow = {
  id: string
  fecha: string
  cliente: string
  tipo_venta: string
  cantidad: number
  monto_cobrado: number
  monto_debe: number
  estado: string
  producto: { nombre: string } | { nombre: string }[] | null
}

export type EgresoCajaCerradoRow = { id: string; fecha: string; categoria: string; descripcion: string | null; monto: number }

export type CompraProveedorCerradaRow = {
  id: string
  fecha: string
  descripcion: string
  cantidad: number
  unidad: string
  total: number
  estado: string
  proveedor: { nombre: string } | { nombre: string }[] | null
}

export type ProduccionCerradaRow = {
  id: string
  fecha: string
  huevos: number
  muertes: number
  lote:
    | { nombre: string; galpon: { nombre: string } | { nombre: string }[] | null }
    | { nombre: string; galpon: { nombre: string } | { nombre: string }[] | null }[]
    | null
}

export type DetalleCierreCompleto = {
  cierre: CierreMensual
  ventas: VentaCerradaRow[]
  egresosCaja: EgresoCajaCerradoRow[]
  comprasProveedor: CompraProveedorCerradaRow[]
  produccion: ProduccionCerradaRow[]
}

/**
 * Trae un cierre ya confirmado junto con todas las filas que quedaron
 * marcadas con su cierre_id. Se usa tanto para la página de detalle
 * como para (re)generar el PDF.
 */
export async function obtenerDetalleCierre(supabase: SupabaseServerClient, id: string): Promise<DetalleCierreCompleto | null> {
  const [{ data: cierre }, { data: ventas }, { data: egresosCaja }, { data: comprasProveedor }, { data: produccion }] =
    await Promise.all([
      supabase.from('cierres_mensuales').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('ventas')
        .select('id, fecha, cliente, tipo_venta, cantidad, monto_cobrado, monto_debe, estado, producto:productos(nombre)')
        .eq('cierre_id', id)
        .order('fecha'),
      supabase
        .from('caja')
        .select('id, fecha, categoria, descripcion, monto')
        .eq('cierre_id', id)
        .eq('tipo', 'EGRESO')
        .order('fecha'),
      supabase
        .from('compras_proveedor')
        .select('id, fecha, descripcion, cantidad, unidad, total, estado, proveedor:proveedores(nombre)')
        .eq('cierre_id', id)
        .order('fecha'),
      supabase
        .from('produccion_diaria')
        .select('id, fecha, huevos, muertes, lote:lotes(nombre, galpon:galpones(nombre))')
        .eq('cierre_id', id)
        .order('fecha'),
    ])

  if (!cierre) return null

  return {
    cierre: cierre as CierreMensual,
    ventas: ventas ?? [],
    egresosCaja: egresosCaja ?? [],
    comprasProveedor: comprasProveedor ?? [],
    produccion: produccion ?? [],
  }
}

export type CierreAnteriorResumen = {
  anio: number
  mes: number
  total_ventas: number
  total_egresos_caja: number
  total_huevos: number
  ganancia_neta: number
}

/** El cierre más reciente cuyo fecha_fin es anterior al inicio del período dado, para el comparativo. */
export async function obtenerCierreAnterior(
  supabase: SupabaseServerClient,
  fechaInicio: string
): Promise<CierreAnteriorResumen | null> {
  const { data } = await supabase
    .from('cierres_mensuales')
    .select('anio, mes, total_ventas, total_egresos_caja, total_huevos, ganancia_neta')
    .lt('fecha_fin', fechaInicio)
    .order('fecha_fin', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}
