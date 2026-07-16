-- ============================================================
-- GRANJA NEIMOR - Módulo: Cierre de Mes
-- ============================================================

-- ============================================================
-- TABLA: cierres_mensuales
-- ============================================================
CREATE TABLE IF NOT EXISTS cierres_mensuales (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anio              INT NOT NULL,
  mes               INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  fecha_inicio      DATE NOT NULL,
  fecha_fin         DATE NOT NULL,
  fecha_cierre      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrado_por       UUID REFERENCES auth.users(id),

  -- Totales agregados
  total_ventas                NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_egresos_caja          NUMERIC(12,2) NOT NULL DEFAULT 0, -- caja tipo = EGRESO
  total_ingresos_caja_otros   NUMERIC(12,2) NOT NULL DEFAULT 0, -- caja tipo = INGRESO no ligado a ventas (ej. puesto)
  total_compras_proveedor     NUMERIC(12,2) NOT NULL DEFAULT 0, -- costo real de insumos
  costo_produccion_estandar   NUMERIC(12,2) NOT NULL DEFAULT 0, -- costo calculado (fórmula de config_costos)
  total_huevos                INT NOT NULL DEFAULT 0,
  total_cajones_equivalentes  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ganancia_neta                NUMERIC(12,2) NOT NULL DEFAULT 0, -- ventas - egresos_caja - compras_proveedor

  -- Desglose completo en JSONB (para no crear muchas tablas hijas)
  -- Estructura esperada:
  -- {
  --   "ventas_por_producto":   [{ producto, cantidad, monto }],
  --   "ventas_por_cliente":    [{ cliente, monto }],
  --   "egresos_por_categoria": [{ categoria, monto }],
  --   "compras_por_proveedor": [{ proveedor, monto }],
  --   "produccion_por_galpon": [{ galpon, huevos, cajones }],
  --   "comparativo_mes_anterior": { ventas_pct, egresos_pct, produccion_pct, ganancia_pct }
  -- }
  detalle JSONB NOT NULL DEFAULT '{}',

  -- Link al snapshot generado en el módulo de Costos
  historico_costos_id UUID REFERENCES historico_costos_periodo(id) ON DELETE SET NULL,

  -- Observaciones manuales (Joaco las escribe en el preview antes de confirmar)
  observaciones      TEXT,
  notas_ventas        TEXT,
  notas_gastos        TEXT,
  notas_produccion    TEXT,

  -- PDF
  pdf_path        TEXT,
  pdf_generado_en TIMESTAMPTZ,

  UNIQUE(anio, mes)
);

CREATE INDEX IF NOT EXISTS idx_cierres_mensuales_fechas ON cierres_mensuales(fecha_inicio, fecha_fin);

-- ============================================================
-- ALTERAR tablas transaccionales: cierre_id
-- ============================================================
ALTER TABLE ventas             ADD COLUMN IF NOT EXISTS cierre_id UUID REFERENCES cierres_mensuales(id);
ALTER TABLE caja               ADD COLUMN IF NOT EXISTS cierre_id UUID REFERENCES cierres_mensuales(id);
ALTER TABLE compras_proveedor  ADD COLUMN IF NOT EXISTS cierre_id UUID REFERENCES cierres_mensuales(id);
ALTER TABLE produccion_diaria  ADD COLUMN IF NOT EXISTS cierre_id UUID REFERENCES cierres_mensuales(id);

CREATE INDEX IF NOT EXISTS idx_ventas_cierre_id            ON ventas(cierre_id);
CREATE INDEX IF NOT EXISTS idx_caja_cierre_id               ON caja(cierre_id);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor_cierre_id  ON compras_proveedor(cierre_id);
CREATE INDEX IF NOT EXISTS idx_produccion_diaria_cierre_id  ON produccion_diaria(cierre_id);

-- ============================================================
-- TRIGGERS DE INMUTABILIDAD
-- ============================================================

-- caja y produccion_diaria: bloqueo total una vez asignadas a un cierre.
-- No hay flujo de negocio que justifique editarlas después (a diferencia
-- de ventas/compras, que pueden seguir cobrándose/pagándose).
CREATE OR REPLACE FUNCTION bloquear_si_cerrado_total()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.cierre_id IS NOT NULL)
     OR (TG_OP = 'DELETE' AND OLD.cierre_id IS NOT NULL) THEN
    RAISE EXCEPTION 'No se puede modificar/borrar un registro de % que ya pertenece a un cierre de mes', TG_TABLE_NAME;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloquear_caja
  BEFORE UPDATE OR DELETE ON caja
  FOR EACH ROW EXECUTE FUNCTION bloquear_si_cerrado_total();

CREATE TRIGGER trg_bloquear_produccion_diaria
  BEFORE UPDATE OR DELETE ON produccion_diaria
  FOR EACH ROW EXECUTE FUNCTION bloquear_si_cerrado_total();

-- ventas: bloqueo parcial. Una vez que pertenece a un cierre no se puede
-- tocar nada que cambie lo que ya se reportó (fecha, monto, producto,
-- cliente), pero sí se puede seguir cobrando una deuda más adelante.
CREATE OR REPLACE FUNCTION bloquear_si_cerrado_ventas()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.cierre_id IS NOT NULL THEN
      RAISE EXCEPTION 'No se puede borrar una venta que ya pertenece a un cierre de mes';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.cierre_id IS NOT NULL THEN
    IF NEW.cierre_id IS DISTINCT FROM OLD.cierre_id
       OR NEW.fecha IS DISTINCT FROM OLD.fecha
       OR NEW.cliente IS DISTINCT FROM OLD.cliente
       OR NEW.tipo_venta IS DISTINCT FROM OLD.tipo_venta
       OR NEW.cantidad IS DISTINCT FROM OLD.cantidad
       OR NEW.equivalente_huevos IS DISTINCT FROM OLD.equivalente_huevos
       OR NEW.producto_id IS DISTINCT FROM OLD.producto_id
       OR NEW.precio_unitario IS DISTINCT FROM OLD.precio_unitario
       OR NEW.precio_oficial IS DISTINCT FROM OLD.precio_oficial
       OR NEW.precio_modificado IS DISTINCT FROM OLD.precio_modificado
       OR NEW.motivo_precio IS DISTINCT FROM OLD.motivo_precio
    THEN
      RAISE EXCEPTION 'Esta venta pertenece a un cierre de mes: solo se puede actualizar estado, método de pago, monto cobrado, monto debe y notas';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloquear_ventas
  BEFORE UPDATE OR DELETE ON ventas
  FOR EACH ROW EXECUTE FUNCTION bloquear_si_cerrado_ventas();

-- compras_proveedor: mismo criterio que ventas (se puede seguir pagando
-- una compra que quedó pendiente/parcial después de cerrado el mes).
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
    THEN
      RAISE EXCEPTION 'Esta compra pertenece a un cierre de mes: solo se puede actualizar estado, monto pagado y notas';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloquear_compras_proveedor
  BEFORE UPDATE OR DELETE ON compras_proveedor
  FOR EACH ROW EXECUTE FUNCTION bloquear_si_cerrado_compras();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE cierres_mensuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen cierres_mensuales"    ON cierres_mensuales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben cierres_mensuales" ON cierres_mensuales FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- STORAGE: bucket para PDFs de cierres
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('cierres', 'cierres', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autenticados leen PDFs de cierres"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cierres');

CREATE POLICY "Autenticados suben PDFs de cierres"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cierres');

CREATE POLICY "Autenticados actualizan PDFs de cierres"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cierres')
  WITH CHECK (bucket_id = 'cierres');
