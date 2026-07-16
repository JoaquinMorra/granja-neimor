import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { formatearPeso, formatearFecha, nombreMes } from '@/lib/utils'
import type { DetalleCierreCompleto } from './obtener-detalle-cierre'
import type { CierreAnteriorResumen } from './obtener-detalle-cierre'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#1e293b' },
  h1: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  h2: { fontSize: 14, fontWeight: 700, marginBottom: 10, borderBottom: '1px solid #cbd5e1', paddingBottom: 4 },
  subtitle: { fontSize: 10, color: '#64748b', marginBottom: 20 },
  kpiRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  kpiBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 6, padding: 10, border: '1px solid #e2e8f0' },
  kpiLabel: { fontSize: 8, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  kpiValue: { fontSize: 14, fontWeight: 700 },
  sectionSpacing: { marginBottom: 16 },
  table: { marginTop: 6, marginBottom: 12 },
  tr: { flexDirection: 'row', borderBottom: '1px solid #e2e8f0', paddingVertical: 3 },
  trHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 4, fontWeight: 700 },
  td: { flex: 1, paddingHorizontal: 3 },
  tdRight: { flex: 1, paddingHorizontal: 3, textAlign: 'right' },
  totalRow: { flexDirection: 'row', borderTop: '1px solid #1e293b', paddingVertical: 4, fontWeight: 700, marginTop: 2 },
  notas: { marginTop: 10, padding: 8, backgroundColor: '#fffbeb', borderRadius: 4, fontSize: 8.5 },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7.5, color: '#94a3b8', textAlign: 'center' },
})

function nombreRel(r: { nombre: string } | { nombre: string }[] | null): string {
  return (Array.isArray(r) ? r[0]?.nombre : r?.nombre) ?? '—'
}

function Footer({ fechaCierre }: { fechaCierre: string }) {
  return <Text style={styles.footer}>Generado automáticamente el {formatearFecha(fechaCierre.slice(0, 10))} · Granja Neimor</Text>
}

function CierreDocument({
  data,
  cierreAnterior,
}: {
  data: DetalleCierreCompleto
  cierreAnterior: CierreAnteriorResumen | null
}) {
  const { cierre, ventas, egresosCaja, comprasProveedor, produccion } = data
  const d = cierre.detalle ?? {}
  const costoReal = d.costo_produccion_real
  const margenPct = cierre.total_ventas > 0 ? (cierre.ganancia_neta / cierre.total_ventas) * 100 : 0

  const pct = (actual: number, anterior: number | null | undefined) => {
    if (!anterior) return '—'
    const v = ((actual - anterior) / anterior) * 100
    return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
  }

  return (
    <Document>
      {/* Página 1: Portada y resumen ejecutivo */}
      <Page size="A4" style={styles.page}>
        <Text style={{ fontSize: 10, color: '#64748b', marginBottom: 24 }}>GRANJA NEIMOR</Text>
        <Text style={styles.h1}>Cierre de Mes — {nombreMes(cierre.mes)} {cierre.anio}</Text>
        <Text style={styles.subtitle}>
          Período: {formatearFecha(cierre.fecha_inicio)} al {formatearFecha(cierre.fecha_fin)} · Cerrado el {formatearFecha(cierre.fecha_cierre.slice(0, 10))}
        </Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total ventas</Text>
            <Text style={styles.kpiValue}>{formatearPeso(cierre.total_ventas)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total gastos</Text>
            <Text style={styles.kpiValue}>{formatearPeso(cierre.total_egresos_caja)}</Text>
          </View>
        </View>
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Producción total</Text>
            <Text style={styles.kpiValue}>{cierre.total_cajones_equivalentes.toFixed(1)} cajones</Text>
            <Text style={{ fontSize: 8, color: '#64748b' }}>{cierre.total_huevos.toLocaleString('es-AR')} huevos</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Ganancia neta</Text>
            <Text style={styles.kpiValue}>{formatearPeso(cierre.ganancia_neta)}</Text>
          </View>
        </View>

        <Footer fechaCierre={cierre.fecha_cierre} />
      </Page>

      {/* Página 2: Ventas */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Ventas</Text>
        <Text style={{ marginBottom: 10 }}>Total del período: {formatearPeso(cierre.total_ventas)}</Text>

        <View style={styles.table}>
          <View style={styles.trHeader}>
            <Text style={styles.td}>Fecha</Text>
            <Text style={styles.td}>Cliente</Text>
            <Text style={styles.td}>Producto</Text>
            <Text style={styles.tdRight}>Cant.</Text>
            <Text style={styles.tdRight}>Monto</Text>
          </View>
          {ventas.map((v) => (
            <View style={styles.tr} key={v.id}>
              <Text style={styles.td}>{formatearFecha(v.fecha)}</Text>
              <Text style={styles.td}>{v.cliente}</Text>
              <Text style={styles.td}>{v.producto ? nombreRel(v.producto) : v.tipo_venta}</Text>
              <Text style={styles.tdRight}>{v.cantidad}</Text>
              <Text style={styles.tdRight}>{formatearPeso(v.monto_cobrado + v.monto_debe)}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontWeight: 700, marginBottom: 4 }}>Desglose por producto</Text>
        <View style={styles.table}>
          {(d.ventas_por_producto ?? []).map((v) => (
            <View style={styles.tr} key={v.producto}>
              <Text style={styles.td}>{v.producto}</Text>
              <Text style={styles.tdRight}>{v.cantidad.toFixed(1)}</Text>
              <Text style={styles.tdRight}>{formatearPeso(v.monto)}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontWeight: 700, marginBottom: 4 }}>Desglose por cliente</Text>
        <View style={styles.table}>
          {(d.ventas_por_cliente ?? []).map((v) => (
            <View style={styles.tr} key={v.cliente}>
              <Text style={styles.td}>{v.cliente}</Text>
              <Text style={styles.tdRight}>{formatearPeso(v.monto)}</Text>
            </View>
          ))}
        </View>

        {cierre.notas_ventas && <Text style={styles.notas}>Notas de ventas: {cierre.notas_ventas}</Text>}
        <Footer fechaCierre={cierre.fecha_cierre} />
      </Page>

      {/* Página 3: Producción */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Producción</Text>
        <Text style={{ marginBottom: 10 }}>
          Total: {cierre.total_huevos.toLocaleString('es-AR')} huevos ({cierre.total_cajones_equivalentes.toFixed(1)} cajones equivalentes)
        </Text>

        <Text style={{ fontWeight: 700, marginBottom: 4 }}>Desglose por galpón</Text>
        <View style={styles.table}>
          {(d.produccion_por_galpon ?? []).map((p) => (
            <View style={styles.tr} key={p.galpon}>
              <Text style={styles.td}>{p.galpon}</Text>
              <Text style={styles.tdRight}>{p.huevos.toLocaleString('es-AR')} huevos</Text>
              <Text style={styles.tdRight}>{p.cajones.toFixed(1)} cj</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontWeight: 700, marginBottom: 4 }}>Cargas del período</Text>
        <View style={styles.table}>
          <View style={styles.trHeader}>
            <Text style={styles.td}>Fecha</Text>
            <Text style={styles.td}>Galpón</Text>
            <Text style={styles.tdRight}>Huevos</Text>
            <Text style={styles.tdRight}>Muertes</Text>
          </View>
          {produccion.map((p) => {
            const lote = Array.isArray(p.lote) ? p.lote[0] : p.lote
            return (
              <View style={styles.tr} key={p.id}>
                <Text style={styles.td}>{formatearFecha(p.fecha)}</Text>
                <Text style={styles.td}>{nombreRel(lote?.galpon ?? null)}</Text>
                <Text style={styles.tdRight}>{p.huevos}</Text>
                <Text style={styles.tdRight}>{p.muertes}</Text>
              </View>
            )
          })}
        </View>

        {cierre.notas_produccion && <Text style={styles.notas}>Notas de producción: {cierre.notas_produccion}</Text>}
        <Footer fechaCierre={cierre.fecha_cierre} />
      </Page>

      {/* Página 4: Gastos y costos */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Gastos y costos</Text>
        <Text style={{ marginBottom: 10 }}>Total gastos operativos: {formatearPeso(cierre.total_egresos_caja)}</Text>

        <View style={styles.table}>
          <View style={styles.trHeader}>
            <Text style={styles.td}>Fecha</Text>
            <Text style={styles.td}>Categoría</Text>
            <Text style={styles.td}>Descripción</Text>
            <Text style={styles.tdRight}>Monto</Text>
          </View>
          {egresosCaja.map((e) => (
            <View style={styles.tr} key={e.id}>
              <Text style={styles.td}>{formatearFecha(e.fecha)}</Text>
              <Text style={styles.td}>{e.categoria}</Text>
              <Text style={styles.td}>{e.descripcion ?? '—'}</Text>
              <Text style={styles.tdRight}>{formatearPeso(e.monto)}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontWeight: 700, marginBottom: 4 }}>Desglose por categoría</Text>
        <View style={styles.table}>
          {(d.egresos_por_categoria ?? []).map((e) => (
            <View style={styles.tr} key={e.categoria}>
              <Text style={styles.td}>{e.categoria}</Text>
              <Text style={styles.tdRight}>{formatearPeso(e.monto)}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontWeight: 700, marginBottom: 4 }}>Compras a proveedores (por proveedor)</Text>
        <View style={styles.table}>
          {(d.compras_por_proveedor ?? []).map((c) => (
            <View style={styles.tr} key={c.proveedor}>
              <Text style={styles.td}>{c.proveedor}</Text>
              <Text style={styles.tdRight}>{formatearPeso(c.monto)}</Text>
            </View>
          ))}
        </View>

        <Text style={{ marginTop: 4 }}>Total compras a proveedores: {formatearPeso(cierre.total_compras_proveedor)}</Text>
        {costoReal && (
          <Text style={{ marginTop: 2 }}>
            Costo de producción real: {formatearPeso(costoReal.costo_total)} · estándar (fórmula): {formatearPeso(cierre.costo_produccion_estandar)}
          </Text>
        )}

        {cierre.notas_gastos && <Text style={styles.notas}>Notas de gastos: {cierre.notas_gastos}</Text>}
        <Footer fechaCierre={cierre.fecha_cierre} />
      </Page>

      {/* Página 5: Resultado y observaciones */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Resultado del período</Text>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.td}>Ventas</Text>
            <Text style={styles.tdRight}>{formatearPeso(cierre.total_ventas)}</Text>
          </View>
          <View style={styles.tr}>
            <Text style={styles.td}>Gastos operativos</Text>
            <Text style={styles.tdRight}>- {formatearPeso(cierre.total_egresos_caja)}</Text>
          </View>
          <View style={styles.tr}>
            <Text style={styles.td}>Compras a proveedores</Text>
            <Text style={styles.tdRight}>- {formatearPeso(cierre.total_compras_proveedor)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.td}>Ganancia neta</Text>
            <Text style={styles.tdRight}>{formatearPeso(cierre.ganancia_neta)}</Text>
          </View>
        </View>
        <Text style={{ marginBottom: 16 }}>Margen sobre ventas: {margenPct.toFixed(1)}%</Text>

        <Text style={{ fontWeight: 700, marginBottom: 4 }}>Comparativo con el cierre anterior</Text>
        {cierreAnterior ? (
          <View style={styles.table}>
            <View style={styles.trHeader}>
              <Text style={styles.td}>Métrica</Text>
              <Text style={styles.tdRight}>{nombreMes(cierreAnterior.mes)} {cierreAnterior.anio}</Text>
              <Text style={styles.tdRight}>Este cierre</Text>
              <Text style={styles.tdRight}>Var.</Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.td}>Ventas</Text>
              <Text style={styles.tdRight}>{formatearPeso(cierreAnterior.total_ventas)}</Text>
              <Text style={styles.tdRight}>{formatearPeso(cierre.total_ventas)}</Text>
              <Text style={styles.tdRight}>{pct(cierre.total_ventas, cierreAnterior.total_ventas)}</Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.td}>Gastos</Text>
              <Text style={styles.tdRight}>{formatearPeso(cierreAnterior.total_egresos_caja)}</Text>
              <Text style={styles.tdRight}>{formatearPeso(cierre.total_egresos_caja)}</Text>
              <Text style={styles.tdRight}>{pct(cierre.total_egresos_caja, cierreAnterior.total_egresos_caja)}</Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.td}>Producción (huevos)</Text>
              <Text style={styles.tdRight}>{cierreAnterior.total_huevos.toLocaleString('es-AR')}</Text>
              <Text style={styles.tdRight}>{cierre.total_huevos.toLocaleString('es-AR')}</Text>
              <Text style={styles.tdRight}>{pct(cierre.total_huevos, cierreAnterior.total_huevos)}</Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.td}>Ganancia neta</Text>
              <Text style={styles.tdRight}>{formatearPeso(cierreAnterior.ganancia_neta)}</Text>
              <Text style={styles.tdRight}>{formatearPeso(cierre.ganancia_neta)}</Text>
              <Text style={styles.tdRight}>{pct(cierre.ganancia_neta, cierreAnterior.ganancia_neta)}</Text>
            </View>
          </View>
        ) : (
          <Text style={{ marginBottom: 16, color: '#64748b' }}>No hay un cierre anterior para comparar.</Text>
        )}

        <Text style={{ fontWeight: 700, marginTop: 16, marginBottom: 4 }}>Observaciones generales del mes</Text>
        <Text>{cierre.observaciones || 'Sin observaciones cargadas.'}</Text>

        <Footer fechaCierre={cierre.fecha_cierre} />
      </Page>
    </Document>
  )
}

export async function generarPdfCierre(
  data: DetalleCierreCompleto,
  cierreAnterior: CierreAnteriorResumen | null
): Promise<Buffer> {
  return renderToBuffer(<CierreDocument data={data} cierreAnterior={cierreAnterior} />)
}
