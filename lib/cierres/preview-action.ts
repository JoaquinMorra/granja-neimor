'use server'

import { createClient } from '@/lib/supabase/server'
import { calcularAgregadosCierre, type AgregadosCierre } from './calcular-agregados'

// Server action: permite que el cliente recalcule el preview del cierre
// cada vez que Joaco cambia las fechas, sin exponer el cliente de Supabase
// con cookies de sesión al navegador.
export async function previewCierre(inicio: string, fin: string): Promise<AgregadosCierre> {
  const supabase = await createClient()
  return calcularAgregadosCierre(supabase, inicio, fin)
}
