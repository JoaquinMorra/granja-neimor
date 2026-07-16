'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { obtenerDetalleCierre, obtenerCierreAnterior } from './obtener-detalle-cierre'
import { generarPdfCierre } from './generar-pdf'
import { subirPdfCierre } from './subir-pdf'

export async function regenerarPdfCierre(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const detalle = await obtenerDetalleCierre(supabase, id)
  if (!detalle) return { error: 'No se encontró el cierre.' }

  try {
    const cierreAnterior = await obtenerCierreAnterior(supabase, detalle.cierre.fecha_inicio)
    const buffer = await generarPdfCierre(detalle, cierreAnterior)
    const path = await subirPdfCierre(supabase, detalle.cierre.anio, detalle.cierre.mes, buffer)

    const { error } = await supabase
      .from('cierres_mensuales')
      .update({ pdf_path: path, pdf_generado_en: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }

    revalidatePath(`/cierres/${id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error generando el PDF.' }
  }
}
