-- ============================================================
-- GRANJA NEIMOR - Módulo: Puesto Mercado
-- ============================================================

-- Tabla de transferencias granja → puesto
CREATE TABLE IF NOT EXISTS puesto_transferencias (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha      DATE NOT NULL,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Líneas de cada transferencia
CREATE TABLE IF NOT EXISTS puesto_transferencia_items (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transferencia_id UUID NOT NULL REFERENCES puesto_transferencias(id) ON DELETE CASCADE,
  producto_id      UUID NOT NULL REFERENCES productos(id),
  cantidad         NUMERIC(10,3) NOT NULL
);

-- Cierres diarios de ventas del puesto (un cierre por día)
CREATE TABLE IF NOT EXISTS puesto_cierres (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha              DATE NOT NULL,
  notas              TEXT,
  total_efectivo     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_transferencia NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ NULL
);

-- Índice único parcial: solo un cierre activo por día
CREATE UNIQUE INDEX IF NOT EXISTS idx_puesto_cierres_fecha_unique
  ON puesto_cierres(fecha) WHERE deleted_at IS NULL;

-- Líneas del cierre (qué se vendió y a qué precio)
CREATE TABLE IF NOT EXISTS puesto_cierre_items (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cierre_id      UUID NOT NULL REFERENCES puesto_cierres(id) ON DELETE CASCADE,
  producto_id    UUID NOT NULL REFERENCES productos(id),
  cantidad       NUMERIC(10,3) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  total_linea    NUMERIC(14,2) NOT NULL
);

-- Log de auditoría del módulo puesto
CREATE TABLE IF NOT EXISTS auditoria_puesto (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tabla          TEXT NOT NULL,
  registro_id    UUID NOT NULL,
  accion         TEXT NOT NULL CHECK (accion IN ('CREATE', 'UPDATE', 'DELETE')),
  user_id        UUID,
  timestamp      TIMESTAMPTZ DEFAULT NOW(),
  valores_antes  JSONB,
  valores_despues JSONB
);

-- ============================================================
-- ALTERAR caja: columnas origen y puesto_cierre_id
-- ============================================================
ALTER TABLE caja ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'granja';
DO $$ BEGIN
  ALTER TABLE caja ADD CONSTRAINT caja_origen_check CHECK (origen IN ('granja', 'puesto'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE caja ADD COLUMN IF NOT EXISTS puesto_cierre_id UUID;
DO $$ BEGIN
  ALTER TABLE caja ADD CONSTRAINT fk_caja_puesto_cierre
    FOREIGN KEY (puesto_cierre_id) REFERENCES puesto_cierres(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE puesto_transferencias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE puesto_transferencia_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE puesto_cierres            ENABLE ROW LEVEL SECURITY;
ALTER TABLE puesto_cierre_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_puesto          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen puesto_transferencias"      ON puesto_transferencias      FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben puesto_transferencias"  ON puesto_transferencias      FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen puesto_transferencia_items"     ON puesto_transferencia_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben puesto_transferencia_items" ON puesto_transferencia_items FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen puesto_cierres"     ON puesto_cierres FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben puesto_cierres" ON puesto_cierres FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen puesto_cierre_items"     ON puesto_cierre_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben puesto_cierre_items" ON puesto_cierre_items FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen auditoria_puesto"     ON auditoria_puesto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben auditoria_puesto" ON auditoria_puesto FOR ALL    TO authenticated USING (true) WITH CHECK (true);
