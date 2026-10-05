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

export const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function nombreMes(mes: number): string {
  return NOMBRES_MES[mes - 1] ?? ''
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
  'Ventas Puesto',
  'USD',
  'Venta gallinas',
  'Aporte de Socios',
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
  'Impuestos',
  'Guanero',
  'Compra Pollas',
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

// ============================================================
// Excepciones puntuales de período
// ============================================================
// Para meses donde el cierre contable real no cayó el día 5 habitual.
// Cada entrada es un período completo que reemplaza al que tocaría según
// la regla normal. Afecta a todos los módulos que usan las funciones de
// abajo (Ventas, Mercado, Costos, Caja, Dashboard). Los períodos
// anteriores a los listados acá NO se tocan, siguen con la regla normal.
// Sacar/agregar entradas a mano cuando haga falta otra excepción.
const EXCEPCIONES_PERIODO: { inicio: string; fin: string }[] = [
  { inicio: '2026-09-06', fin: '2026-10-02' }, // septiembre 2026: cerró el 2/10 en vez del 5/10
  { inicio: '2026-10-03', fin: '2026-11-01' }, // octubre 2026: arranca el 3/10 para no dejar esos días sin período
]

// Dada una fecha y el período "normal" (regla 6 al 5) que le tocaría,
// devuelve el período real: el de la excepción que la contenga, si hay
// alguna, o si no el normal tal cual.
function resolverPeriodoQueContiene(
  fechaISO: string,
  inicioNormalISO: string,
  finNormalISO: string
): { inicio: string; fin: string } {
  const excepcion = EXCEPCIONES_PERIODO.find((e) => fechaISO >= e.inicio && fechaISO <= e.fin)
  return excepcion ?? { inicio: inicioNormalISO, fin: finNormalISO }
}

function labelPeriodo(inicioISO: string, finISO: string): string {
  const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const inicioDate = new Date(inicioISO + 'T12:00:00')
  const finDate = new Date(finISO + 'T12:00:00')
  return `${inicioDate.toLocaleDateString('es-AR', fmt)} – ${finDate.toLocaleDateString('es-AR', fmt)}`
}

function periodoNormalQueContiene(fecha: Date): { inicio: Date; fin: Date } {
  const dia = fecha.getDate()
  const inicio = dia <= 5
    ? new Date(fecha.getFullYear(), fecha.getMonth() - 1, 6)
    : new Date(fecha.getFullYear(), fecha.getMonth(), 6)
  const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 5)
  return { inicio, fin }
}

export function getPeriodoActual(): { inicio: string; fin: string; label: string } {
  const hoy = new Date()
  const { inicio: inicioNormal, fin: finNormal } = periodoNormalQueContiene(hoy)
  const { inicio, fin } = resolverPeriodoQueContiene(toISO(hoy), toISO(inicioNormal), toISO(finNormal))
  return { inicio, fin, label: labelPeriodo(inicio, fin) }
}

export function getPeriodoInfo(): {
  inicio: string; fin: string; label: string; diaActual: number; diasTotales: number
} {
  const hoy = new Date()
  const { inicio, fin } = getPeriodoActual()

  const ms = 1000 * 60 * 60 * 24
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()
  const inicioMid = new Date(inicio + 'T00:00:00').getTime()
  const finMid = new Date(fin + 'T00:00:00').getTime()

  const diaActual = Math.round((hoyMid - inicioMid) / ms) + 1
  const diasTotales = Math.round((finMid - inicioMid) / ms) + 1

  return { inicio, fin, label: labelPeriodo(inicio, fin), diaActual, diasTotales }
}

export function getPeriodoAnterior(): { inicio: string; fin: string; label: string } {
  const actual = getPeriodoActual()
  const diaAntes = new Date(actual.inicio + 'T12:00:00')
  diaAntes.setDate(diaAntes.getDate() - 1)

  const { inicio: inicioNormal, fin: finNormal } = periodoNormalQueContiene(diaAntes)
  const { inicio, fin } = resolverPeriodoQueContiene(toISO(diaAntes), toISO(inicioNormal), toISO(finNormal))
  return { inicio, fin, label: labelPeriodo(inicio, fin) }
}

export function getUltimosPeriodos(n: number): { inicio: string; fin: string; label: string }[] {
  const periodos: { inicio: string; fin: string; label: string }[] = []
  let actual: { inicio: string; fin: string } = getPeriodoActual()

  for (let i = 0; i < n; i++) {
    const inicioDate = new Date(actual.inicio + 'T12:00:00')
    const label = inicioDate.toLocaleDateString('es-AR', { month: 'short' })
    periodos.unshift({ inicio: actual.inicio, fin: actual.fin, label })

    const diaAntes = new Date(actual.inicio + 'T12:00:00')
    diaAntes.setDate(diaAntes.getDate() - 1)
    const { inicio: inicioNormal, fin: finNormal } = periodoNormalQueContiene(diaAntes)
    actual = resolverPeriodoQueContiene(toISO(diaAntes), toISO(inicioNormal), toISO(finNormal))
  }

  return periodos
}
