import type { CompraProveedor } from '@/types'
import { HORAS_PARA_ELIMINAR_COMPRA } from '@/lib/config'

export type AccionCompra = 'eliminar' | 'anular' | 'bloqueada'

export type DecisionCompra = {
  accion: AccionCompra
  motivoBloqueo?: string
}

/**
 * Decide qué acción está disponible para una compra a proveedor.
 * `tienePagosAsociados` se calcula aparte (requiere revisar
 * pagos_proveedor.compras_asociadas, que no es una FK real).
 */
export function puedeEliminarCompra(
  compra: CompraProveedor,
  tienePagosAsociados: boolean
): DecisionCompra {
  if (compra.anulada_en) {
    return { accion: 'bloqueada', motivoBloqueo: 'Esta compra ya fue anulada.' }
  }

  if (compra.cierre_id) {
    return {
      accion: 'bloqueada',
      motivoBloqueo: 'Esta compra pertenece a un cierre de mes y no se puede modificar. Si necesitás corregirla, generá un ajuste manual en el mes actual.',
    }
  }

  if (tienePagosAsociados) {
    return {
      accion: 'bloqueada',
      motivoBloqueo: 'Esta compra tiene pagos asociados. Anulá o corregí el pago primero.',
    }
  }

  const horasDesdeCreacion = (Date.now() - new Date(compra.created_at).getTime()) / (1000 * 60 * 60)

  return horasDesdeCreacion <= HORAS_PARA_ELIMINAR_COMPRA
    ? { accion: 'eliminar' }
    : { accion: 'anular' }
}
