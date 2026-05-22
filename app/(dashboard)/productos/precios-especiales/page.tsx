import { createClient } from '@/lib/supabase/server'
import PreciosEspecialesClient from './PreciosEspecialesClient'
import { hoyISO } from '@/lib/utils'

export default async function PreciosEspecialesPage() {
  const supabase = await createClient()
  const hoy = hoyISO()

  const [{ data: precios }, { data: productos }, { data: clientes }] = await Promise.all([
    supabase
      .from('precios_especiales_cliente')
      .select('*, producto:productos(codigo, nombre)')
      .order('cliente'),
    supabase.from('productos').select('id, codigo, nombre').eq('activo', true).order('codigo'),
    supabase.from('ventas').select('cliente').order('cliente'),
  ])

  const clientesUnicos = [...new Set((clientes ?? []).map((c: any) => c.cliente))].sort()

  return (
    <PreciosEspecialesClient
      precios={precios ?? []}
      productos={productos ?? []}
      clientesExistentes={clientesUnicos}
    />
  )
}
