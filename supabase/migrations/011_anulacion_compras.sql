-- ============================================================
-- GRANJA NEIMOR - MÃ³dulo: Eliminar / Anular compras a proveedores
-- ============================================================

-- ============================================================
-- COLUMNAS DE ANULACIÃ“N EN compras_proveedor
-- ============================================================
ALTER TABLE compras_proveedor ADD COLUMN IF NOT EXISTS anulada_en TIMESTAMPTZ NULL;
ALTER TABLE compras_proveedor ADD COLUMN IF NOT EXISTS anulada_por UUID REFERENCES auth.users(id);
ALTER TABLE compras_proveedor ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

-- Ãndice parcial para las queries de listados/deuda que filtran activas
CREATE INDEX IF NOT EXISTS idx_compras_proveedor_activas ON compras_proveedor(id) WHERE anulada_en IS NULL;

-- ============================================================
-- ACTUALIZAR TRIGGER DE INMUTABILIDAD: proteger tambiÃ©n la anulaciÃ³n
-- ============================================================
-- Antes de este cambio, el trigger solo vigilaba las columnas "de negocio".
-- Si una compra ya pertenece a un cierre cerrado, tampoco se la debe poder
-- anular por detrÃ¡s (la regla de negocio dice que queda bloqueada del todo).
CREATE OR REPLACE FUNCTION bloquear_si_cerrado_compras()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.cierre_id IS NOT NULL THEN
      RAISE EXCEPTION 'No se puede borrar una compra que ya pertenece a un cierre de mes';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.cierre_id IS NOT NULL THEN
    IF NEW.cierre_id IS DISTINCT FROM OLD.cierre_id
       OR NEW.proveedor_id IS DISTINCT FROM OLD.proveedor_id
       OR NEW.fecha IS DISTINCT FROM OLD.fecha
       OR NEW.descripcion IS DISTINCT FROM OLD.descripcion
       OR NEW.cantidad IS DISTINCT FROM OLD.cantidad
       OR NEW.unidad IS DISTINCT FROM OLD.unidad
       OR NEW.precio_unitario IS DISTINCT FROM OLD.precio_unitario
       OR NEW.total IS DISTINCT FROM OLD.total
       OR NEW.vencimiento IS DISTINCT FROM OLD.vencimiento
       OR NEW.kg_alimento IS DISTINCT FROM OLD.kg_alimento
       OR NEW.anulada_en IS DISTINCT FROM OLD.anulada_en
       OR NEW.anulada_por IS DISTINCT FROM OLD.anulada_por
       OR NEW.motivo_anulacion IS DISTINCT FROM OLD.motivo_anulacion
    THEN
      RAISE EXCEPTION 'Esta compra pertenece a un cierre de mes: solo se puede actualizar estado, monto pagado y notas';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLA DE AUDITORÃA
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria_compras_proveedor (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id       UUID NOT NULL,
  accion          TEXT NOT NULL CHECK (accion IN ('ELIMINAR', 'ANULAR')),
  user_id         UUID,
  timestamp       TIMESTAMPTZ DEFAULT NOW(),
  valores_antes   JSONB,
  valores_despues JSONB
);

ALTER TABLE auditoria_compras_proveedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leen auditoria_compras_proveedor"    ON auditoria_compras_proveedor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben auditoria_compras_proveedor" ON auditoria_compras_proveedor FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- confirmar_cierre_mensual: no asignar cierre_id a compras anuladas
-- ============================================================
-- Si no se excluyen, una compra anulada dentro del rango de fechas del
-- cierre quedaria con cierre_id asignado (aunque no aporte al total, porque
-- calcular-agregados.ts ya la excluye), bloqueandola para siempre sin motivo.
CREATE OR REPLACE FUNCTION confirmar_cierre_mensual(
  p_anio INT,
  p_mes INT,
  p_fecha_inicio DATE,
  p_fecha_fin DATE,
  p_cerrado_por UUID,
  p_total_ventas NUMERIC,
  p_total_egresos_caja NUMERIC,
  p_total_ingresos_caja_otros NUMERIC,
  p_total_compras_proveedor NUMERIC,
  p_costo_produccion_estandar NUMERIC,
  p_total_huevos INT,
  p_total_cajones_equivalentes NUMERIC,
  p_ganancia_neta NUMERIC,
  p_detalle JSONB,
  p_observaciones TEXT,
  p_notas_ventas TEXT,
  p_notas_gastos TEXT,
  p_notas_produccion TEXT,
  p_dias_periodo INT,
  p_gallinas_promedio INT,
  p_alimento_real NUMERIC,
  p_sueldos_real NUMERIC,
  p_maples_real NUMERIC,
  p_otros_real NUMERIC,
  p_amortizacion_real NUMERIC,
  p_costo_total_real NUMERIC,
  p_cajones_reales NUMERIC,
  p_costo_por_cajon NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_cierre_id UUID;
  v_historico_id UUID;
BEGIN
  INSERT INTO cierres_mensuales (
    anio, mes, fecha_inicio, fecha_fin, cerrado_por,
    total_ventas, total_egresos_caja, total_ingresos_caja_otros, total_compras_proveedor,
    costo_produccion_estandar, total_huevos, total_cajones_equivalentes, ganancia_neta,
    detalle, observaciones, notas_ventas, notas_gastos, notas_produccion
  ) VALUES (
    p_anio, p_mes, p_fecha_inicio, p_fecha_fin, p_cerrado_por,
    p_total_ventas, p_total_egresos_caja, p_total_ingresos_caja_otros, p_total_compras_proveedor,
    p_costo_produccion_estandar, p_total_huevos, p_total_cajones_equivalentes, p_ganancia_neta,
    p_detalle, p_observaciones, p_notas_ventas, p_notas_gastos, p_notas_produccion
  )
  RETURNING id INTO v_cierre_id;

  UPDATE ventas SET cierre_id = v_cierre_id
    WHERE fecha BETWEEN p_fecha_inicio AND p_fecha_fin AND cierre_id IS NULL;

  UPDATE caja SET cierre_id = v_cierre_id
    WHERE fecha BETWEEN p_fecha_inicio AND p_fecha_fin AND cierre_id IS NULL;

  UPDATE compras_proveedor SET cierre_id = v_cierre_id
    WHERE fecha BETWEEN p_fecha_inicio AND p_fecha_fin AND cierre_id IS NULL AND anulada_en IS NULL;

  UPDATE produccion_diaria SET cierre_id = v_cierre_id
    WHERE fecha BETWEEN p_fecha_inicio AND p_fecha_fin AND cierre_id IS NULL;

  INSERT INTO historico_costos_periodo (
    periodo_inicio, periodo_fin, dias_periodo, gallinas_promedio,
    alimento_real, sueldos_real, maples_real, otros_real, amortizacion_real,
    costo_total, cajones_reales, costo_por_cajon
  ) VALUES (
    p_fecha_inicio, p_fecha_fin, p_dias_periodo, p_gallinas_promedio,
    p_alimento_real, p_sueldos_real, p_maples_real, p_otros_real, p_amortizacion_real,
    p_costo_total_real, p_cajones_reales, p_costo_por_cajon
  )
  ON CONFLICT (periodo_inicio) DO UPDATE SET
    periodo_fin = EXCLUDED.periodo_fin,
    dias_periodo = EXCLUDED.dias_periodo,
    gallinas_promedio = EXCLUDED.gallinas_promedio,
    alimento_real = EXCLUDED.alimento_real,
    sueldos_real = EXCLUDED.sueldos_real,
    maples_real = EXCLUDED.maples_real,
    otros_real = EXCLUDED.otros_real,
    amortizacion_real = EXCLUDED.amortizacion_real,
    costo_total = EXCLUDED.costo_total,
    cajones_reales = EXCLUDED.cajones_reales,
    costo_por_cajon = EXCLUDED.costo_por_cajon
  RETURNING id INTO v_historico_id;

  UPDATE cierres_mensuales SET historico_costos_id = v_historico_id WHERE id = v_cierre_id;

  RETURN v_cierre_id;
END;
$$;
