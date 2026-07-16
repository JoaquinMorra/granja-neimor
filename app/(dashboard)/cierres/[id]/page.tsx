import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { obtenerDetalleCierre, obtenerCierreAnterior } from '@/lib/cierres/obtener-detalle-cierre'
import DetalleCierreClient from './DetalleCierreClient'

export default async function DetalleCierrePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const detalle = await obtenerDetalleCierre(supabase, id)
  if (!detalle) notFound()

  const anteriorRaw = await obtenerCierreAnterior(supabase, detalle.cierre.fecha_inicio)

  return (
    <DetalleCierreClient
      cierre={detalle.cierre}
      ventas={detalle.ventas}
      egresosCaja={detalle.egresosCaja}
      comprasProveedor={detalle.comprasProveedor}
      produccion={detalle.produccion}
      cierreAnterior={anteriorRaw}
    />
  )
}
