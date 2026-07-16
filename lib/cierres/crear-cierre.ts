'use server'

import { createClient } from '@/lib/supabase/server'
import { calcularAgregadosCierre } from './calcular-agregados'
import { obtenerDetalleCierre, obtenerCierreAnterior } from './obtener-detalle-cierre'
import { generarPdfCierre } from './generar-pdf'
import { subirPdfCierre } from './subir-pdf'

export type ConfirmarCierreInput = {
  fechaInicio: string
  fechaFin: string
  anio: number
  mes: number
  observaciones: string
  notasVentas: string
  notasGastos: string
  notasProduccion: string
}

export type ConfirmarCierreResult = { id: string } | { error: string }

export async function confirmarCierre(input: ConfirmarCierreInput): Promise<ConfirmarCierreResult> {
  if (input.fechaFin < input.fechaInicio) {
    return { error: 'La fecha de fin no puede ser anterior a la fecha de inicio.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Recalculamos en el momento de confirmar (no confiamos en lo que ya
  // tenía el cliente en pantalla) para evitar cerrar con datos desactualizados
  // si algo cambió entre que se abrió el preview y se tocó "Confirmar".
  const agregados = await calcularAgregadosCierre(supabase, input.fechaInicio, input.fechaFin)
  const real = agregados.costoProduccionReal

  const { data, error } = await supabase.rpc('confirmar_cierre_mensual', {
    p_anio: input.anio,
    p_mes: input.mes,
    p_fecha_inicio: input.fechaInicio,
    p_fecha_fin: input.fechaFin,
    p_cerrado_por: user?.id ?? null,
    p_total_ventas: agregados.totalVentas,
    p_total_egresos_caja: agregados.totalEgresosCaja,
    p_total_ingresos_caja_otros: agregados.totalIngresosCajaOtros,
    p_total_compras_proveedor: agregados.totalComprasProveedor,
    p_costo_produccion_estandar: agregados.costoProduccionEstandar,
    p_total_huevos: agregados.totalHuevos,
    p_total_cajones_equivalentes: agregados.totalCajonesEquivalentes,
    p_ganancia_neta: agregados.gananciaNeta,
    p_detalle: {
      ventas_por_producto: agregados.ventasPorProducto,
      ventas_por_cliente: agregados.ventasPorCliente,
      egresos_por_categoria: agregados.egresosPorCategoria,
      compras_por_proveedor: agregados.comprasPorProveedor,
      produccion_por_galpon: agregados.produccionPorGalpon,
      costo_produccion_real: real,
    },
    p_observaciones: input.observaciones || null,
    p_notas_ventas: input.notasVentas || null,
    p_notas_gastos: input.notasGastos || null,
    p_notas_produccion: input.notasProduccion || null,
    p_dias_periodo: agregados.diasPeriodo,
    p_gallinas_promedio: agregados.gallinasActivas,
    p_alimento_real: real.alimento_real,
    p_sueldos_real: real.sueldos_real,
    p_maples_real: real.maples_real,
    p_otros_real: real.otros_real,
    p_amortizacion_real: real.amortizacion_real,
    p_costo_total_real: real.costo_total,
    p_cajones_reales: real.cajones_reales,
    p_costo_por_cajon: real.costo_por_cajon,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe un cierre para ${input.mes}/${input.anio}. Elegí otra etiqueta si es un período distinto.` }
    }
    return { error: error.message }
  }

  const cierreId = data as string

  // El cierre ya quedó confirmado en la DB en este punto. Si la generación
  // del PDF falla, no queremos perder el cierre por eso — se puede
  // "Regenerar PDF" después desde la página de detalle.
  try {
    const detalle = await obtenerDetalleCierre(supabase, cierreId)
    if (detalle) {
      const cierreAnterior = await obtenerCierreAnterior(supabase, detalle.cierre.fecha_inicio)
      const buffer = await generarPdfCierre(detalle, cierreAnterior)
      const path = await subirPdfCierre(supabase, input.anio, input.mes, buffer)
      await supabase
        .from('cierres_mensuales')
        .update({ pdf_path: path, pdf_generado_en: new Date().toISOString() })
        .eq('id', cierreId)
    }
  } catch (pdfError) {
    console.error('Error generando el PDF del cierre', cierreId, pdfError)
  }

  return { id: cierreId }
}
