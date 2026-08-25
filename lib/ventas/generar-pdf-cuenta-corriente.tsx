import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { formatearPeso, formatearFecha } from '@/lib/utils'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#1e293b' },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#64748b', marginBottom: 16 },
  table: { marginTop: 6, marginBottom: 12 },
  tr: { flexDirection: 'row', borderBottom: '1px solid #e2e8f0', paddingVertical: 3 },
  trHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 4, fontWeight: 700 },
  tdFecha: { flex: 1, paddingHorizontal: 3 },
  tdDetalle: { flex: 2.5, paddingHorizontal: 3 },
  tdRight: { flex: 1, paddingHorizontal: 3, textAlign: 'right' },
  kpiRow: { flexDirection: 'row', gap: 12, marginTop: 4, marginBottom: 16 },
  kpiBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 6, padding: 10, border: '1px solid #e2e8f0' },
  kpiLabel: { fontSize: 8, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  kpiValue: { fontSize: 13, fontWeight: 700 },
  totalRow: { flexDirection: 'row', borderTop: '1px solid #1e293b', paddingVertical: 4, fontWeight: 700, marginTop: 2 },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7.5, color: '#94a3b8', textAlign: 'center' },
})

export type FilaCuentaCorriente = {
  fecha: string
  detalle: string
  debe: number
  haber: number
  saldo: number
}

function CuentaCorrienteDocument({
  cliente,
  filas,
  totalFacturado,
  totalCobrado,
  saldoActual,
  generadoEn,
}: {
  cliente: string
  filas: FilaCuentaCorriente[]
  totalFacturado: number
  totalCobrado: number
  saldoActual: number
  generadoEn: string
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={{ fontSize: 10, color: '#64748b', marginBottom: 12 }}>GRANJA NEIMOR</Text>
        <Text style={styles.h1}>Cuenta corriente — {cliente}</Text>
        <Text style={styles.subtitle}>Generado el {formatearFecha(generadoEn)}</Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total facturado</Text>
            <Text style={styles.kpiValue}>{formatearPeso(totalFacturado)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total cobrado</Text>
            <Text style={styles.kpiValue}>{formatearPeso(totalCobrado)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Saldo actual</Text>
            <Text style={styles.kpiValue}>{formatearPeso(Math.abs(saldoActual))} {saldoActual > 0 ? '(debe)' : saldoActual < 0 ? '(a favor)' : ''}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.trHeader} fixed>
            <Text style={styles.tdFecha}>Fecha</Text>
            <Text style={styles.tdDetalle}>Detalle</Text>
            <Text style={styles.tdRight}>Debe</Text>
            <Text style={styles.tdRight}>Haber</Text>
            <Text style={styles.tdRight}>Saldo</Text>
          </View>
          {filas.map((f, i) => (
            <View style={styles.tr} key={i} wrap={false}>
              <Text style={styles.tdFecha}>{formatearFecha(f.fecha)}</Text>
              <Text style={styles.tdDetalle}>{f.detalle}</Text>
              <Text style={styles.tdRight}>{f.debe > 0 ? formatearPeso(f.debe) : '—'}</Text>
              <Text style={styles.tdRight}>{f.haber > 0 ? formatearPeso(f.haber) : '—'}</Text>
              <Text style={styles.tdRight}>{formatearPeso(Math.abs(f.saldo))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={{ flex: 3.5, paddingHorizontal: 3 }}>SALDO ACTUAL</Text>
          <Text style={styles.tdRight}>{formatearPeso(Math.abs(saldoActual))}</Text>
        </View>

        <Text style={styles.footer} fixed>
          Documento generado automáticamente el {formatearFecha(generadoEn)} · Granja Neimor
        </Text>
      </Page>
    </Document>
  )
}

export async function generarPdfCuentaCorriente(params: {
  cliente: string
  filas: FilaCuentaCorriente[]
  totalFacturado: number
  totalCobrado: number
  saldoActual: number
  generadoEn: string
}): Promise<Buffer> {
  return renderToBuffer(<CuentaCorrienteDocument {...params} />)
}
