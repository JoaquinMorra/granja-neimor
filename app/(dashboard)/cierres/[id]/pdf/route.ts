import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cierre } = await supabase
    .from('cierres_mensuales')
    .select('pdf_path')
    .eq('id', id)
    .maybeSingle()

  if (!cierre?.pdf_path) {
    return NextResponse.json({ error: 'Este cierre todavía no tiene un PDF generado.' }, { status: 404 })
  }

  const { data, error } = await supabase.storage.from('cierres').createSignedUrl(cierre.pdf_path, 60)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'No se pudo generar el link del PDF.' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
