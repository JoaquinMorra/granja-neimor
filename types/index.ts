export type Galpon = {
  id: string
  nombre: string
  tipo: 'coloradas' | 'blancas'
  orden: number
  created_at: string
}

export type Lote = {
  id: string
  galpon_id: string
  nombre: string
  gallinas_inicial: number
  fecha_nacimiento: string | null
  activo: boolean
  created_at: string
}

export type LoteConCalculos = Lote & {
  gallinas_actuales: number
  total_muertes: number
  edad_semanas: number | null
  galpon?: Galpon
}

export type ProduccionDiaria = {
  id: string
  lote_id: string
  fecha: string
  huevos: number
  muertes: number
  notas: string | null
  created_at: string
  lote?: Lote & { galpon?: Galpon }
}

export type TipoVenta =
  | 'CAJON'
  | 'CAJONB1'
  | 'CAJONB2'
  | 'CAJON B3'
  | 'CAJITAS DOCENA'
  | 'CAJITAS 1/2 DOCENA'
  | 'MAPLE'

export type EstadoVenta = 'PAGO' | 'PENDIENTE' | 'PARCIAL'

export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'EFECTIVO-TRANSF'

export type Venta = {
  id: string
  fecha: string
  cliente: string
  tipo_venta: TipoVenta
  cantidad: number
  equivalente_huevos: number
  estado: EstadoVenta
  metodo_pago: MetodoPago | null
  monto_cobrado: number
  monto_debe: number
  notas: string | null
  created_at: string
}

export type TipoCaja = 'INGRESO' | 'EGRESO'

export type MedioPagoCaja = 'EFECTIVO' | 'TRANSFERENCIA'

export type Caja = {
  id: string
  fecha: string
  tipo: TipoCaja
  categoria: string
  descripcion: string | null
  monto: number
  medio_pago: MedioPagoCaja
  created_at: string
}

export type PosturaRango = { min: number; max: number }

export type DashboardKPIs = {
  totalGallinas: number
  gallonasTotales: { galpon: string; tipo: string; gallinas: number }[]
  produccionHoy: number
  cajonesHoy: number
  ventasHoy: number
  ventasMes: number
  deudaTotal: number
  posturaPromedioGalpones: {
    galpon: string
    porcentajeReal: number
    porcentajeMin: number
    porcentajeMax: number
    alerta: boolean
  }[]
}
