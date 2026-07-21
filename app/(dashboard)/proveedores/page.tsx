import { createClient } from '@/lib/supabase/server'
import ProveedoresClient from './ProveedoresClient'
import type { Proveedor, CompraProveedor, PagoProveedor } from '@/types'

export default async function ProveedoresPage() {
  const supabase = await createClient()

  const [{ data: proveedores }, { data: compras }, { data: pagos }] = await Promise.all([
    supabase.from('proveedores').select('*').order('nombre'),
    supabase.from('compras_proveedor').select('proveedor_id, total, monto_pagado, fecha, estado').is('anulada_en', null),
    supabase.from('pagos_proveedor').select('proveedor_id, fecha').order('fecha', { ascending: false }),
  ])

  const resumen = (proveedores ?? []).map((p: Proveedor) => {
    const comprasP = (compras ?? []).filter((c: any) => c.proveedor_id === p.id)
    const pagosP = (pagos ?? []).filter((pg: any) => pg.proveedor_id === p.id)
    const saldoPendiente = comprasP.reduce((s: number, c: any) => s + (c.total - c.monto_pagado), 0)
    const ultimaCompra = comprasP.sort((a: any, b: any) => b.fecha.localeCompare(a.fecha))[0]?.fecha ?? null
    const ultimoPago = pagosP[0]?.fecha ?? null
    return { proveedor: p, saldoPendiente, ultimaCompra, ultimoPago }
  })

  return <ProveedoresClient resumen={resumen} />
}
