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
  // Catálogo de productos
  producto_id: string | null
  precio_unitario: number | null
  precio_oficial: number | null
  precio_modificado: boolean | null
  motivo_precio: string | null
}

export type TipoCaja = 'INGRESO' | 'EGRESO'

export type MedioPagoCaja = 'EFECTIVO' | 'TRANSFERENCIA'

export type OrigenCaja = 'granja' | 'puesto'

export type Caja = {
  id: string
  fecha: string
  tipo: TipoCaja
  categoria: string
  descripcion: string | null
  monto: number
  medio_pago: MedioPagoCaja
  origen: OrigenCaja
  puesto_cierre_id: string | null
  created_at: string
}

// ============================================================
// Proveedores
// ============================================================
export type TipoProveedor = 'alimento' | 'maples' | 'sanidad' | 'servicios' | 'mantenimiento' | 'otros'

export type Proveedor = {
  id: string
  nombre: string
  tipo: TipoProveedor
  contacto: string | null
  notas: string | null
  created_at: string
}

export type EstadoCompra = 'pendiente' | 'parcial' | 'pagada'

export type CompraProveedor = {
  id: string
  proveedor_id: string
  fecha: string
  descripcion: string
  cantidad: number
  unidad: string
  precio_unitario: number
  total: number
  vencimiento: string | null
  estado: EstadoCompra
  monto_pagado: number
  kg_alimento: number | null
  notas: string | null
  created_at: string
  cierre_id: string | null
  anulada_en: string | null
  anulada_por: string | null
  motivo_anulacion: string | null
}

export type MetodoPagoProveedor = 'efectivo' | 'transferencia' | 'mixto'

export type PagoProveedor = {
  id: string
  proveedor_id: string
  fecha: string
  monto: number
  metodo: MetodoPagoProveedor
  compras_asociadas: string[]
  movimiento_caja_id: string | null
  notas: string | null
  created_at: string
}

// ============================================================
// Catálogo de productos
// ============================================================
export type ColorProducto = 'blanco' | 'colorado' | 'mixto'
export type CategoriaProducto = 'super' | 'n1' | 'n2' | 'n3' | 'sin_clasificar'

export type Producto = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  color: ColorProducto
  categoria: CategoriaProducto
  unidades_por_caja: number
  precio_mayorista: number
  precio_minorista: number
  activo: boolean
  created_at: string
}

export type PrecioEspecialCliente = {
  id: string
  cliente: string
  producto_id: string
  precio: number
  motivo: string
  vigente_desde: string
  vigente_hasta: string | null
  created_at: string
  producto?: Producto
}

// ============================================================
// Costos
// ============================================================
export type ConfigCostos = {
  id: string
  costo_recria_por_ave: number
  vida_util_semanas: number
  precio_kg_alimento: number
  consumo_coloradas_g_dia: number
  consumo_blancas_g_dia: number
  sueldos_mensuales: number
  maples_mensuales: number
  otros_gastos_mensuales: number
  postura_esperada_pct: number
  updated_at: string
}

export type HistoricoCostoPeriodo = {
  id: string
  periodo_inicio: string
  periodo_fin: string
  dias_periodo: number
  gallinas_promedio: number
  alimento_real: number
  sueldos_real: number
  maples_real: number
  otros_real: number
  amortizacion_real: number
  costo_total: number
  cajones_reales: number
  costo_por_cajon: number
  created_at: string
}

export type ClienteConfig = {
  cliente: string
  limite_credito: number | null
  updated_at: string
}

// ============================================================
// Puesto Mercado
// ============================================================
export type PuestoTransferenciaItem = {
  id: string
  transferencia_id: string
  producto_id: string
  cantidad: number
}

export type PuestoTransferencia = {
  id: string
  fecha: string
  notas: string | null
  created_at: string
  deleted_at: string | null
}

export type PuestoCierreItem = {
  id: string
  cierre_id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  total_linea: number
}

export type PuestoCierre = {
  id: string
  fecha: string
  notas: string | null
  total_efectivo: number
  total_transferencia: number
  created_at: string
  deleted_at: string | null
}

// ============================================================
// Cierres de Mes
// ============================================================
export type CierreMensual = {
  id: string
  anio: number
  mes: number
  fecha_inicio: string
  fecha_fin: string
  fecha_cierre: string
  cerrado_por: string | null
  total_ventas: number
  total_egresos_caja: number
  total_ingresos_caja_otros: number
  total_compras_proveedor: number
  costo_produccion_estandar: number
  total_huevos: number
  total_cajones_equivalentes: number
  ganancia_neta: number
  detalle: {
    ventas_por_producto?: { producto: string; cantidad: number; monto: number }[]
    ventas_por_cliente?: { cliente: string; monto: number }[]
    egresos_por_categoria?: { categoria: string; monto: number }[]
    compras_por_proveedor?: { proveedor: string; monto: number }[]
    produccion_por_galpon?: { galpon: string; huevos: number; cajones: number }[]
    costo_produccion_real?: {
      alimento_real: number
      sueldos_real: number
      maples_real: number
      otros_real: number
      amortizacion_real: number
      costo_total: number
      cajones_reales: number
      costo_por_cajon: number
    }
    comparativo_mes_anterior?: {
      ventas_pct: number | null
      egresos_pct: number | null
      produccion_pct: number | null
      ganancia_pct: number | null
    } | null
  }
  historico_costos_id: string | null
  observaciones: string | null
  notas_ventas: string | null
  notas_gastos: string | null
  notas_produccion: string | null
  pdf_path: string | null
  pdf_generado_en: string | null
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
