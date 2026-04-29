-- ============================================================
-- GRANJA NEIMOR - Schema inicial
-- ============================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: galpones
-- ============================================================
CREATE TABLE IF NOT EXISTS galpones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('coloradas', 'blancas')),
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: lotes
-- ============================================================
CREATE TABLE IF NOT EXISTS lotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  galpon_id UUID NOT NULL REFERENCES galpones(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  gallinas_inicial INTEGER NOT NULL,
  fecha_nacimiento DATE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: produccion_diaria
-- ============================================================
CREATE TABLE IF NOT EXISTS produccion_diaria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  huevos INTEGER NOT NULL DEFAULT 0,
  muertes INTEGER NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lote_id, fecha)
);

-- ============================================================
-- TABLA: ventas
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  cliente TEXT NOT NULL,
  tipo_venta TEXT NOT NULL CHECK (tipo_venta IN ('CAJON','CAJONB1','CAJONB2','CAJON B3','CAJITAS DOCENA','CAJITAS 1/2 DOCENA','MAPLE')),
  cantidad NUMERIC(10,2) NOT NULL,
  equivalente_huevos INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PAGO','PENDIENTE','PARCIAL')),
  metodo_pago TEXT CHECK (metodo_pago IN ('EFECTIVO','TRANSFERENCIA','EFECTIVO-TRANSF')),
  monto_cobrado NUMERIC(12,2) DEFAULT 0,
  monto_debe NUMERIC(12,2) DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: caja
-- ============================================================
CREATE TABLE IF NOT EXISTS caja (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL CHECK (tipo IN ('INGRESO','EGRESO')),
  categoria TEXT NOT NULL,
  descripcion TEXT,
  monto NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VISTA: gallinas_actuales (lotes con muertes acumuladas)
-- ============================================================
CREATE OR REPLACE VIEW gallinas_actuales AS
SELECT
  l.id,
  l.galpon_id,
  l.nombre,
  l.gallinas_inicial,
  l.fecha_nacimiento,
  l.activo,
  l.created_at,
  COALESCE(l.gallinas_inicial - SUM(pd.muertes), l.gallinas_inicial) AS gallinas_actuales,
  COALESCE(SUM(pd.muertes), 0) AS total_muertes,
  CASE
    WHEN l.fecha_nacimiento IS NOT NULL THEN
      ((CURRENT_DATE - l.fecha_nacimiento) / 7)::INTEGER
    ELSE NULL
  END AS edad_semanas
FROM lotes l
LEFT JOIN produccion_diaria pd ON pd.lote_id = l.id
GROUP BY l.id, l.galpon_id, l.nombre, l.gallinas_inicial, l.fecha_nacimiento, l.activo, l.created_at;

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_produccion_fecha ON produccion_diaria(fecha);
CREATE INDEX IF NOT EXISTS idx_produccion_lote ON produccion_diaria(lote_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente);
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);
CREATE INDEX IF NOT EXISTS idx_caja_fecha ON caja(fecha);
CREATE INDEX IF NOT EXISTS idx_lotes_galpon ON lotes(galpon_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE galpones ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produccion_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja ENABLE ROW LEVEL SECURITY;

-- Políticas: solo usuarios autenticados tienen acceso total
CREATE POLICY "Autenticados leen galpones" ON galpones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben galpones" ON galpones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen lotes" ON lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben lotes" ON lotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen produccion" ON produccion_diaria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben produccion" ON produccion_diaria FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen ventas" ON ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben ventas" ON ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen caja" ON caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben caja" ON caja FOR ALL TO authenticated USING (true) WITH CHECK (true);
