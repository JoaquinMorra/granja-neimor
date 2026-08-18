-- ============================================================
-- GRANJA NEIMOR - Venta parcial de gallinas por lote
-- ============================================================
-- Permite sacar gallinas de a poco de un lote (ej. venta al camal) sin
-- pasarlas como muerte y sin usar "Retirar" (que da de baja el lote entero).

-- ============================================================
-- TABLA: ventas_gallinas
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas_gallinas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id           UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  cantidad          INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario   NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  monto_total       NUMERIC(14,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  observaciones     TEXT,
  caja_id           UUID REFERENCES caja(id) ON DELETE SET NULL,
  cierre_id         UUID REFERENCES cierres_mensuales(id), -- sin usar todavía: Cierre de Mes no la toca aún
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ventas_gallinas_lote  ON ventas_gallinas(lote_id);
CREATE INDEX IF NOT EXISTS idx_ventas_gallinas_fecha ON ventas_gallinas(fecha);

ALTER TABLE ventas_gallinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leen ventas_gallinas"    ON ventas_gallinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben ventas_gallinas" ON ventas_gallinas FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- VISTA gallinas_actuales: ahora también resta ventas de gallinas
-- ============================================================
-- total_muertes queda igual (solo produccion_diaria) para no ensuciar
-- ningún cálculo de mortalidad. Cada fuente se agrega en un subquery
-- propio antes del JOIN para evitar fan-out (doble conteo) al combinar
-- dos relaciones uno-a-muchos sobre el mismo lote.
-- total_vendidas va al final de la lista de columnas: CREATE OR REPLACE
-- VIEW no permite insertar una columna en el medio de las existentes,
-- solo agregar al final (si no, Postgres lo interpreta como un rename
-- posicional de la columna que quedó corrida y tira error 42P16).
CREATE OR REPLACE VIEW gallinas_actuales AS
SELECT
  l.id,
  l.galpon_id,
  l.nombre,
  l.gallinas_inicial,
  l.fecha_nacimiento,
  l.activo,
  l.created_at,
  l.gallinas_inicial - COALESCE(pd.total_muertes, 0) - COALESCE(vg.total_vendidas, 0) AS gallinas_actuales,
  COALESCE(pd.total_muertes, 0) AS total_muertes,
  CASE
    WHEN l.fecha_nacimiento IS NOT NULL THEN
      ((CURRENT_DATE - l.fecha_nacimiento) / 7)::INTEGER
    ELSE NULL
  END AS edad_semanas,
  COALESCE(vg.total_vendidas, 0) AS total_vendidas
FROM lotes l
LEFT JOIN (
  SELECT lote_id, SUM(muertes) AS total_muertes
  FROM produccion_diaria
  GROUP BY lote_id
) pd ON pd.lote_id = l.id
LEFT JOIN (
  SELECT lote_id, SUM(cantidad) AS total_vendidas
  FROM ventas_gallinas
  GROUP BY lote_id
) vg ON vg.lote_id = l.id;
