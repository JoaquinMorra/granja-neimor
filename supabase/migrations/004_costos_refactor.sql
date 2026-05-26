-- Nuevas columnas en config_costos para el modelo de 3 modos de costo
ALTER TABLE config_costos
  ADD COLUMN IF NOT EXISTS consumo_coloradas_g_dia NUMERIC(6,1) DEFAULT 120,
  ADD COLUMN IF NOT EXISTS consumo_blancas_g_dia   NUMERIC(6,1) DEFAULT 113,
  ADD COLUMN IF NOT EXISTS sueldos_mensuales        NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maples_mensuales         NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otros_gastos_mensuales   NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS postura_esperada_pct     NUMERIC(5,2)  DEFAULT 70;

-- Tabla histórica de costos cerrados por período contable
CREATE TABLE IF NOT EXISTS historico_costos_periodo (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo_inicio    DATE NOT NULL,
  periodo_fin       DATE NOT NULL,
  dias_periodo      INTEGER NOT NULL,
  gallinas_promedio INTEGER NOT NULL DEFAULT 0,
  alimento_real     NUMERIC(14,2) NOT NULL DEFAULT 0,
  sueldos_real      NUMERIC(14,2) NOT NULL DEFAULT 0,
  maples_real       NUMERIC(14,2) NOT NULL DEFAULT 0,
  otros_real        NUMERIC(14,2) NOT NULL DEFAULT 0,
  amortizacion_real NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  cajones_reales    NUMERIC(10,2) NOT NULL DEFAULT 0,
  costo_por_cajon   NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(periodo_inicio)
);

ALTER TABLE historico_costos_periodo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leen historico_costos"    ON historico_costos_periodo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben historico_costos" ON historico_costos_periodo FOR ALL    TO authenticated USING (true) WITH CHECK (true);
