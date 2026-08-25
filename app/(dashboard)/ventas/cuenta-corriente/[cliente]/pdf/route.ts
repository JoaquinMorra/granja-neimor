import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarPdfCuentaCorriente, type FilaCuentaCorriente } from '@/lib/ventas/generar-pdf-cuenta-corriente'
import { hoyISO } from '@/lib/utils'

export async function GET(_request: Request, { params }: { params: Promise<{ cliente: string }> }) {
  const { cliente: clienteParam } = await params
  const cliente = decodeURIComponent(clienteParam)
  const supabase = await createClient()

  const [{ data: ventas }, { data: pagos }] = await Promise.all([
    supabase.from('ventas').select('fecha, tipo_venta, cantidad, monto_cobrado, monto_debe').eq('cliente', cliente),
    supabase.from('pagos').select('fecha_pago, metodo, referencia, monto').eq('cliente', cliente),
  ])

  type Movimiento = { fecha: string; detalle: string; debe: number; haber: number }
  const movimientos: Movimiento[] = [
    ...(ventas ?? []).map((v) => ({
      fecha: v.fecha,
      detalle: `Venta ${v.tipo_venta} x${v.cantidad}`,
      debe: v.monto_cobrado + v.monto_debe,
      haber: 0,
    })),
    ...(pagos ?? []).map((p) => ({
      fecha: p.fecha_pago,
      detalle: `Pago ${p.metodo}${p.referencia ? ' — ' + p.referencia : ''}`,
      debe: 0,
      haber: p.monto,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  let saldo = 0
  const filas: FilaCuentaCorriente[] = movimientos.map((m) => {
    saldo += m.debe - m.haber
    return { ...m, saldo }
  })

  const totalFacturado = filas.reduce((s, f) => s + f.debe, 0)
  const totalCobrado = filas.reduce((s, f) => s + f.haber, 0)

  const buffer = await generarPdfCuentaCorriente({
    cliente,
    filas,
    totalFacturado,
    totalCobrado,
    saldoActual: saldo,
    generadoEn: hoyISO(),
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cuenta-corriente-${cliente.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
    },
  })
}
