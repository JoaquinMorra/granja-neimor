import { differenceInWeeks, parseISO } from 'date-fns'
import type { PosturaRango, TipoVenta } from '@/types'

export function calcularEdadSemanas(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null
  return differenceInWeeks(new Date(), parseISO(fechaNacimiento))
}

export function getPosturaEsperada(edadSemanas: number | null): PosturaRango {
  if (edadSemanas === null) return { min: 0, max: 0 }
  if (edadSemanas <= 18) return { min: 0, max: 0 }
  if (edadSemanas <= 20) return { min: 5, max: 10 }
  if (edadSemanas <= 22) return { min: 30, max: 50 }
  if (edadSemanas <= 24) return { min: 70, max: 85 }
  if (edadSemanas <= 30) return { min: 90, max: 95 }
  if (edadSemanas <= 50) return { min: 85, max: 90 }
  if (edadSemanas <= 70) return { min: 75, max: 85 }
  if (edadSemanas <= 90) return { min: 50, max: 70 }
  return { min: 30, max: 50 }
}

export const HUEVOS_POR_TIPO: Record<TipoVenta, number> = {
  'CAJON': 360,
  'CAJONB1': 360,
  'CAJONB2': 360,
  'CAJON B3': 360,
  'CAJITAS DOCENA': 12,
  'CAJITAS 1/2 DOCENA': 6,
  'MAPLE': 30,
}

export function calcularEquivalenteHuevos(tipo: TipoVenta, cantidad: number): number {
  return Math.round(HUEVOS_POR_TIPO[tipo] * cantidad)
}

export function huevosACajones(huevos: number): number {
  return huevos / 360
}

export function formatearPeso(monto: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto)
}

export function formatearFecha(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatearFechaCorta(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export function hoyISO(): string {
  return new Date().toISOString().split('T')[0]
}

export const TIPOS_VENTA: TipoVenta[] = [
  'CAJON',
  'CAJONB1',
  'CAJONB2',
  'CAJON B3',
  'CAJITAS DOCENA',
  'CAJITAS 1/2 DOCENA',
  'MAPLE',
]

export const CATEGORIAS_INGRESO = [
  'Venta granja',
  'Ventas mercado',
  'USD',
  'Otros',
]

export const CATEGORIAS_EGRESO = [
  'Alimento',
  'Medicación',
  'Sanidad',
  'Combustible',
  'Gastos generales',
  'Sueldos',
  'Luz',
  'Peaje',
  'Ferretería',
  'Cajitas',
  'Maples',
  'Compra-venta mercado',
  'Compra USD',
  'Pago inversión',
  'Mantenimiento',
  'Otros',
]

// Mapeo de tipo de proveedor → categoría en Caja
export const CATEGORIA_CAJA_POR_TIPO_PROVEEDOR: Record<string, string> = {
  alimento: 'Alimento',
  maples: 'Maples',
  sanidad: 'Sanidad',
  servicios: 'Gastos generales',
  mantenimiento: 'Mantenimiento',
  otros: 'Otros',
}

// Mapeo de código de producto → tipo_venta legacy
export const CODIGO_A_TIPO_VENTA: Record<string, string> = {
  'CAJON': 'CAJON',
  'CAJONB1': 'CAJONB1',
  'CAJONB2': 'CAJONB2',
  'CAJON_B3': 'CAJON B3',
  'CAJITAS_DOCENA': 'CAJITAS DOCENA',
  'CAJITAS_MEDIA': 'CAJITAS 1/2 DOCENA',
  'MAPLE': 'MAPLE',
}

export const PUNTO_EQUILIBRIO_CAJONES = 66

// El período contable de la granja va del 6 de un mes al 5 del siguiente.
function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getPeriodoActual(): { inicio: string; fin: string; label: string } {
  const hoy = new Date()
  const dia = hoy.getDate()

  const inicioDate = dia <= 5
    ? new Date(hoy.getFullYear(), hoy.getMonth() - 1, 6)
    : new Date(hoy.getFullYear(), hoy.getMonth(), 6)
  const finDate = new Date(inicioDate.getFullYear(), inicioDate.getMonth() + 1, 5)

  const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const label = `${inicioDate.toLocaleDateString('es-AR', fmt)} – ${finDate.toLocaleDateString('es-AR', fmt)}`

  return { inicio: toISO(inicioDate), fin: toISO(finDate), label }
}

export function getPeriodoInfo(): {
  inicio: string; fin: string; label: string; diaActual: number; diasTotales: number
} {
  const hoy = new Date()
  const dia = hoy.getDate()

  const inicioDate = dia <= 5
    ? new Date(hoy.getFullYear(), hoy.getMonth() - 1, 6)
    : new Date(hoy.getFullYear(), hoy.getMonth(), 6)
  const finDate = new Date(inicioDate.getFullYear(), inicioDate.getMonth() + 1, 5)

  const ms = 1000 * 60 * 60 * 24
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()
  const inicioMid = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), inicioDate.getDate()).getTime()
  const finMid = new Date(finDate.getFullYear(), finDate.getMonth(), finDate.getDate()).getTime()

  const diaActual = Math.round((hoyMid - inicioMid) / ms) + 1
  const diasTotales = Math.round((finMid - inicioMid) / ms) + 1

  const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const label = `${inicioDate.toLocaleDateString('es-AR', fmt)} – ${finDate.toLocaleDateString('es-AR', fmt)}`

  return { inicio: toISO(inicioDate), fin: toISO(finDate), label, diaActual, diasTotales }
}

export function getPeriodoAnterior(): { inicio: string; fin: string; label: string } {
  const hoy = new Date()
  const dia = hoy.getDate()
  const periodoActualInicio = dia <= 5
    ? new Date(hoy.getFullYear(), hoy.getMonth() - 1, 6)
    : new Date(hoy.getFullYear(), hoy.getMonth(), 6)

  const inicioDate = new Date(periodoActualInicio.getFullYear(), periodoActualInicio.getMonth() - 1, 6)
  const finDate = new Date(inicioDate.getFullYear(), inicioDate.getMonth() + 1, 5)

  const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const label = `${inicioDate.toLocaleDateString('es-AR', fmt)} – ${finDate.toLocaleDateString('es-AR', fmt)}`

  return { inicio: toISO(inicioDate), fin: toISO(finDate), label }
}

export function getUltimosPeriodos(n: number): { inicio: string; fin: string; label: string }[] {
  const hoy = new Date()
  const dia = hoy.getDate()
  const periodoActualInicio = dia <= 5
    ? new Date(hoy.getFullYear(), hoy.getMonth() - 1, 6)
    : new Date(hoy.getFullYear(), hoy.getMonth(), 6)

  return Array.from({ length: n }, (_, i) => {
    const inicio = new Date(periodoActualInicio.getFullYear(), periodoActualInicio.getMonth() - (n - 1 - i), 6)
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 5)
    const label = inicio.toLocaleDateString('es-AR', { month: 'short' })
    return { inicio: toISO(inicio), fin: toISO(fin), label }
  })
}
