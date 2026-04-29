import { createClient } from '@/lib/supabase/server'
import VentasClient from './VentasClient'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default async function VentasPage() {
  const supabase = await createClient()
  const hoy = new Date()
  const mesInicio = format(startOfMonth(hoy), 'yyyy-MM-dd')
  const mesFin = format(endOfMonth(hoy), 'yyyy-MM-dd')

  const [{ data: ventas }, { data: ventasMes }, { data: clientes }] = await Promise.all([
    supabase
      .from('ventas')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('ventas')
      .select('cliente, equivalente_huevos, estado, monto_cobrado, monto_debe')
      .gte('fecha', mesInicio)
      .lte('fecha', mesFin),
    supabase
      .from('ventas')
      .select('cliente')
      .order('cliente'),
  ])

  const clientesUnicos = [...new Set((clientes ?? []).map((c) => c.cliente))].sort()

  return (
    <VentasClient
      ventas={ventas ?? []}
      ventasMes={ventasMes ?? []}
      clientesExistentes={clientesUnicos}
    />
  )
}
