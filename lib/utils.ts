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

export const PUNTO_EQUILIBRIO_CAJONES = 66
