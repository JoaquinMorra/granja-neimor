import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function subirPdfCierre(
  supabase: SupabaseServerClient,
  anio: number,
  mes: number,
  buffer: Buffer
): Promise<string> {
  const path = `${anio}-${String(mes).padStart(2, '0')}.pdf`
  const { error } = await supabase.storage.from('cierres').upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (error) throw new Error(`Error subiendo el PDF a Storage: ${error.message}`)
  return path
}
