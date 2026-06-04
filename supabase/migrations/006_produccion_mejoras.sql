-- Soft delete para produccion_diaria
ALTER TABLE produccion_diaria ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Tabla de auditoría para ediciones y eliminaciones de cargas
CREATE TABLE IF NOT EXISTS auditoria_produccion (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produccion_id UUID NOT NULL,
  accion        TEXT NOT NULL CHECK (accion IN ('UPDATE', 'DELETE')),
  user_id       UUID,
  timestamp     TIMESTAMPTZ DEFAULT NOW(),
  valores_antes JSONB,
  valores_despues JSONB
);

ALTER TABLE auditoria_produccion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leen auditoria_produccion"    ON auditoria_produccion FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben auditoria_produccion" ON auditoria_produccion FOR ALL    TO authenticated USING (true) WITH CHECK (true);
