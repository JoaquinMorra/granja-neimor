-- ============================================================
-- GRANJA NEIMOR - Módulos: Proveedores, Productos, Costos
-- ============================================================

-- ============================================================
-- TABLA: proveedores
-- ============================================================
CREATE TABLE IF NOT EXISTS proveedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('alimento', 'maples', 'sanidad', 'servicios', 'mantenimiento', 'otros')),
  contacto TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: compras_proveedor
-- ============================================================
CREATE TABLE IF NOT EXISTS compras_proveedor (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL,
  unidad TEXT NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  vencimiento DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'pagada')),
  monto_pagado NUMERIC(14,2) NOT NULL DEFAULT 0,
  kg_alimento NUMERIC(12,3),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: pagos_proveedor
-- (movimiento_caja_id FK se agrega después de alterar caja)
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos_proveedor (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  monto NUMERIC(14,2) NOT NULL,
  metodo TEXT NOT NULL CHECK (metodo IN ('efectivo', 'transferencia', 'mixto')),
  compras_asociadas UUID[] DEFAULT '{}',
  movimiento_caja_id UUID,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALTERAR caja: link bidireccional con pagos_proveedor
-- ============================================================
ALTER TABLE caja ADD COLUMN IF NOT EXISTS pago_proveedor_id UUID;

-- FK desde pagos_proveedor → caja
ALTER TABLE pagos_proveedor
  ADD CONSTRAINT fk_pagos_movimiento_caja
  FOREIGN KEY (movimiento_caja_id) REFERENCES caja(id) ON DELETE SET NULL;

-- FK desde caja → pagos_proveedor
ALTER TABLE caja
  ADD CONSTRAINT fk_caja_pago_proveedor
  FOREIGN KEY (pago_proveedor_id) REFERENCES pagos_proveedor(id) ON DELETE SET NULL;

-- ============================================================
-- TABLA: productos (catálogo de SKUs)
-- ============================================================
CREATE TABLE IF NOT EXISTS productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  color TEXT NOT NULL CHECK (color IN ('blanco', 'colorado', 'mixto')),
  categoria TEXT NOT NULL CHECK (categoria IN ('super', 'n1', 'n2', 'n3', 'sin_clasificar')),
  unidades_por_caja INTEGER NOT NULL,
  precio_mayorista NUMERIC(12,2) NOT NULL,
  precio_minorista NUMERIC(12,2) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: precios_especiales_cliente
-- ============================================================
CREATE TABLE IF NOT EXISTS precios_especiales_cliente (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente TEXT NOT NULL,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio NUMERIC(12,2) NOT NULL,
  motivo TEXT NOT NULL,
  vigente_desde DATE NOT NULL,
  vigente_hasta DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALTERAR ventas: campos de catálogo
-- ============================================================
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS producto_id UUID REFERENCES productos(id) ON DELETE SET NULL;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(12,2);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS precio_oficial NUMERIC(12,2);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS precio_modificado BOOLEAN DEFAULT FALSE;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS motivo_precio TEXT;

-- ============================================================
-- TABLA: config_costos (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS config_costos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  costo_recria_por_ave NUMERIC(12,2) NOT NULL DEFAULT 3000,
  vida_util_semanas INTEGER NOT NULL DEFAULT 75,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO config_costos (costo_recria_por_ave, vida_util_semanas)
SELECT 3000, 75
WHERE NOT EXISTS (SELECT 1 FROM config_costos);

-- ============================================================
-- TABLA: clientes_config (límite de crédito por cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes_config (
  cliente TEXT PRIMARY KEY,
  limite_credito NUMERIC(14,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_compras_proveedor_id ON compras_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor_fecha ON compras_proveedor(fecha);
CREATE INDEX IF NOT EXISTS idx_pagos_proveedor_id ON pagos_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_precios_esp_cliente ON precios_especiales_cliente(cliente);
CREATE INDEX IF NOT EXISTS idx_ventas_producto_id ON ventas(producto_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_especiales_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_costos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen proveedores" ON proveedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben proveedores" ON proveedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen compras_proveedor" ON compras_proveedor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben compras_proveedor" ON compras_proveedor FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen pagos_proveedor" ON pagos_proveedor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben pagos_proveedor" ON pagos_proveedor FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen productos" ON productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben productos" ON productos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen precios_especiales_cliente" ON precios_especiales_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben precios_especiales_cliente" ON precios_especiales_cliente FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen config_costos" ON config_costos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben config_costos" ON config_costos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen clientes_config" ON clientes_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben clientes_config" ON clientes_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- DATOS INICIALES: catálogo de productos
-- ============================================================
INSERT INTO productos (codigo, nombre, color, categoria, unidades_por_caja, precio_mayorista, precio_minorista)
SELECT codigo, nombre, color::TEXT, categoria::TEXT, unidades_por_caja, precio_mayorista, precio_minorista
FROM (VALUES
  ('CAJON',         'Cajón colorado',       'colorado', 'sin_clasificar', 360, 72000.00, 90000.00),
  ('CAJONB1',       'Cajón blanco N°1',     'blanco',   'n1',             360, 52000.00, 65000.00),
  ('CAJONB2',       'Cajón blanco N°2',     'blanco',   'n2',             360, 46000.00, 58000.00),
  ('CAJON_B3',      'Cajón blanco N°3',     'blanco',   'n3',             360, 40000.00, 50000.00),
  ('CAJITAS_DOCENA','Cajita docena',         'mixto',    'sin_clasificar',  12,  3300.00,  4000.00),
  ('CAJITAS_MEDIA', 'Cajita media docena',   'mixto',    'sin_clasificar',   6,  1650.00,  2000.00),
  ('MAPLE',         'Maple 30 unidades',    'mixto',    'sin_clasificar',  30,  7500.00, 10000.00)
) AS t(codigo, nombre, color, categoria, unidades_por_caja, precio_mayorista, precio_minorista)
WHERE NOT EXISTS (SELECT 1 FROM productos);

-- ============================================================
-- DATOS INICIALES: precios especiales
-- (Se insertan después de que existan clientes en ventas)
-- Los precios especiales iniciales los carga el usuario desde la UI
-- ============================================================
