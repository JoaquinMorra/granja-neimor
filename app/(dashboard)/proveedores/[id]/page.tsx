import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProveedorDetalleClient from './ProveedorDetalleClient'

export default async function ProveedorDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: proveedor }, { data: compras }, { data: pagos }] = await Promise.all([
    supabase.from('proveedores').select('*').eq('id', id).single(),
    supabase.from('compras_proveedor').select('*').eq('proveedor_id', id).order('fecha', { ascending: false }),
    supabase.from('pagos_proveedor').select('*').eq('proveedor_id', id).order('fecha', { ascending: false }),
  ])

  if (!proveedor) notFound()

  return (
    <ProveedorDetalleClient
      proveedor={proveedor}
      compras={compras ?? []}
      pagos={pagos ?? []}
    />
  )
}
