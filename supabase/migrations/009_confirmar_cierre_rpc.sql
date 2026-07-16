-- ============================================================
-- GRANJA NEIMOR - Cierre de Mes: función transaccional de confirmación
-- ============================================================
-- Los totales y el desglose se calculan en la app (lib/cierres/calcular-agregados.ts,
-- reusando la misma lógica que ya usa /costos). Esta función solo hace los
-- escrituras mecánicas de forma atómica: si algo falla a mitad de camino,
-- no queda ningún cambio a medias (insert del cierre, marcado de cierre_id
-- en las 4 tablas transaccionales, y snapshot en historico_costos_periodo).

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
    WHERE fecha BETWEEN p_fecha_inicio AND p_fecha_fin AND cierre_id IS NULL;

  UPDATE produccion_diaria SET cierre_id = v_cierre_id
    WHERE fecha BETWEEN p_fecha_inicio AND p_fecha_fin AND cierre_id IS NULL;

  -- Snapshot de costos del período (mismo destino que usa /costos para el
  -- "último período cerrado"). Si ya existía uno para este periodo_inicio
  -- (por ejemplo, generado automáticamente al visitar /costos antes de
  -- cerrar), se sobreescribe con los números definitivos del cierre.
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
