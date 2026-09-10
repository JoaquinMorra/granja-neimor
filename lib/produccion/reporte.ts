import type { createClient } from '@/lib/supabase/server'
import { huevosACajones } from '@/lib/utils'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type ProduccionGalponPeriodo = {
  galponId: string
  galpon: string
  tipo: 'coloradas' | 'blancas'
  diasConProduccion: number
  huevosTotales: number
  cajones: number
  promedioDiario: number
  porcentajeDelTotal: number
}

export type ReporteProduccionPeriodo = {
  porGalpon: ProduccionGalponPeriodo[]
  totalHuevos: number
  totalCajones: number
  totalDiasConProduccion: number
  promedioDiarioPeriodo: number
  posturaPromedioPonderada: number
  serieDiaria: { fecha: string; huevos: number }[]
}

// No hay tabla de "producción" por galpón: se carga por lote (produccion_diaria.lote_id)
// y cada galpón puede tener varios lotes, así que hay que agrupar pasando por lotes.galpon_id
// (mismo patrón que ya usa lib/cierres/calcular-agregados.ts).
export async function getProduccionPorPeriodo(
  supabase: SupabaseServerClient,
  fechaInicio: string,
  fechaFin: string
): Promise<ReporteProduccionPeriodo> {
  const [{ data: galpones }, { data: produccionRaw }, { data: gallinasRaw }] = await Promise.all([
    supabase.from('galpones').select('id, nombre, tipo').order('orden'),
    supabase
      .from('produccion_diaria')
      .select('fecha, huevos, lote:lotes(galpon_id)')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .is('deleted_at', null),
    supabase.from('gallinas_actuales').select('galpon_id, gallinas_actuales'),
  ])

  type ProdRow = { fecha: string; huevos: number; lote: { galpon_id: string } | { galpon_id: string }[] | null }
  const produccion = (produccionRaw ?? []) as ProdRow[]

  const galponIdDe = (row: ProdRow): string | null => {
    const lote = Array.isArray(row.lote) ? row.lote[0] : row.lote
    return lote?.galpon_id ?? null
  }

  const gallinasPorGalpon = new Map<string, number>()
  for (const g of gallinasRaw ?? []) {
    gallinasPorGalpon.set(g.galpon_id, (gallinasPorGalpon.get(g.galpon_id) ?? 0) + (g.gallinas_actuales ?? 0))
  }

  const porGalpon: ProduccionGalponPeriodo[] = (galpones ?? []).map((g) => {
    const filas = produccion.filter((p) => galponIdDe(p) === g.id)
    const huevosTotales = filas.reduce((s, p) => s + p.huevos, 0)
    const diasConProduccion = new Set(filas.map((p) => p.fecha)).size
    return {
      galponId: g.id,
      galpon: g.nombre,
      tipo: g.tipo,
      diasConProduccion,
      huevosTotales,
      cajones: huevosACajones(huevosTotales),
      promedioDiario: diasConProduccion > 0 ? huevosTotales / diasConProduccion : 0,
      porcentajeDelTotal: 0, // se completa abajo, una vez que se conoce el total
    }
  })

  const totalHuevos = porGalpon.reduce((s, g) => s + g.huevosTotales, 0)
  for (const g of porGalpon) {
    g.porcentajeDelTotal = totalHuevos > 0 ? (g.huevosTotales / totalHuevos) * 100 : 0
  }

  // "Días con producción" a nivel total: un día cuenta una sola vez aunque
  // varios galpones hayan cargado ese mismo día (no es la suma de cada fila).
  const totalDiasConProduccion = new Set(produccion.map((p) => p.fecha)).size

  // Postura real ponderada del plantel: por galpón, huevos / (gallinas actuales
  // × días con producción), ponderado por la cantidad de gallinas de cada galpón.
  // Usa el plantel ACTUAL como aproximación (no se guarda un historial de
  // cabezas día por día), mismo criterio que ya usa el dashboard para "hoy".
  let sumaPosturaPonderada = 0
  let sumaGallinas = 0
  for (const g of porGalpon) {
    const gallinas = gallinasPorGalpon.get(g.galponId) ?? 0
    if (gallinas <= 0 || g.diasConProduccion === 0) continue
    const posturaGalpon = (g.huevosTotales / (gallinas * g.diasConProduccion)) * 100
    sumaPosturaPonderada += posturaGalpon * gallinas
    sumaGallinas += gallinas
  }
  const posturaPromedioPonderada = sumaGallinas > 0 ? sumaPosturaPonderada / sumaGallinas : 0

  const serieDiariaMap = new Map<string, number>()
  for (const p of produccion) {
    serieDiariaMap.set(p.fecha, (serieDiariaMap.get(p.fecha) ?? 0) + p.huevos)
  }
  const serieDiaria = Array.from(serieDiariaMap.entries())
    .map(([fecha, huevos]) => ({ fecha, huevos }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  return {
    porGalpon,
    totalHuevos,
    totalCajones: huevosACajones(totalHuevos),
    totalDiasConProduccion,
    promedioDiarioPeriodo: totalDiasConProduccion > 0 ? totalHuevos / totalDiasConProduccion : 0,
    posturaPromedioPonderada,
    serieDiaria,
  }
}
