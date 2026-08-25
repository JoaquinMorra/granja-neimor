-- ============================================================
-- GRANJA NEIMOR - Pagos de clientes con método/referencia + cuenta corriente
-- ============================================================
-- "cliente" es TEXT libre en todo el sistema (ventas.cliente, clientes_config.cliente,
-- precios_especiales_cliente.cliente) porque no existe una tabla clientes con id
-- propio. pagos sigue el mismo criterio para no introducir una identidad paralela.

-- ============================================================
-- TABLA: pagos
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente     TEXT NOT NULL,
  fecha_pago  DATE NOT NULL DEFAULT CURRENT_DATE,
  monto       NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  metodo      TEXT NOT NULL CHECK (metodo IN ('Efectivo', 'Transferencia', 'Cheque', 'Mercado Pago', 'Otro')),
  referencia  TEXT,
  notas       TEXT,
  cierre_id   UUID REFERENCES cierres_mensuales(id), -- sin usar todavía: Cierre de Mes no la toca aún
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_pagos_cliente ON pagos(cliente);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha   ON pagos(fecha_pago);

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leen pagos"    ON pagos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben pagos" ON pagos FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABLA PUENTE: pagos_ventas (N pagos <-> M ventas)
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos_ventas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id         UUID REFERENCES pagos(id) ON DELETE CASCADE NOT NULL,
  venta_id        UUID REFERENCES ventas(id) NOT NULL,
  monto_asignado  NUMERIC(12,2) NOT NULL CHECK (monto_asignado > 0),
  UNIQUE(pago_id, venta_id)
);

CREATE INDEX IF NOT EXISTS idx_pv_pago  ON pagos_ventas(pago_id);
CREATE INDEX IF NOT EXISTS idx_pv_venta ON pagos_ventas(venta_id);

ALTER TABLE pagos_ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leen pagos_ventas"    ON pagos_ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben pagos_ventas" ON pagos_ventas FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- RPC: registrar_pago
-- ============================================================
-- Crea el pago y sus asignaciones a ventas de forma atómica, y mantiene
-- ventas.monto_cobrado / monto_debe / estado en sincronía (siguen siendo
-- la fuente de verdad que ya usa Cierres de Mes, el dashboard y el PDF de
-- cierre — no se reemplazan por una vista para no tener que tocar todo eso).
-- p_asignaciones: JSONB tipo [{"venta_id": "...", "monto_asignado": 1000}, ...]
CREATE OR REPLACE FUNCTION registrar_pago(
  p_cliente     TEXT,
  p_fecha_pago  DATE,
  p_monto       NUMERIC,
  p_metodo      TEXT,
  p_referencia  TEXT,
  p_notas       TEXT,
  p_created_by  UUID,
  p_asignaciones JSONB
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_pago_id UUID;
  v_asignacion RECORD;
  v_venta ventas%ROWTYPE;
  v_nuevo_debe NUMERIC;
  v_nuevo_cobrado NUMERIC;
  v_suma_asignada NUMERIC := 0;
BEGIN
  INSERT INTO pagos (cliente, fecha_pago, monto, metodo, referencia, notas, created_by)
  VALUES (p_cliente, p_fecha_pago, p_monto, p_metodo, p_referencia, p_notas, p_created_by)
  RETURNING id INTO v_pago_id;

  FOR v_asignacion IN SELECT * FROM jsonb_to_recordset(p_asignaciones) AS x(venta_id UUID, monto_asignado NUMERIC)
  LOOP
    SELECT * INTO v_venta FROM ventas WHERE id = v_asignacion.venta_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La venta % no existe', v_asignacion.venta_id;
    END IF;
    IF v_venta.cliente <> p_cliente THEN
      RAISE EXCEPTION 'La venta % no pertenece a %', v_asignacion.venta_id, p_cliente;
    END IF;
    IF v_asignacion.monto_asignado > v_venta.monto_debe THEN
      RAISE EXCEPTION 'El monto asignado a la venta % (%) supera lo que debe (%)', v_asignacion.venta_id, v_asignacion.monto_asignado, v_venta.monto_debe;
    END IF;

    INSERT INTO pagos_ventas (pago_id, venta_id, monto_asignado)
    VALUES (v_pago_id, v_asignacion.venta_id, v_asignacion.monto_asignado);

    v_nuevo_debe := v_venta.monto_debe - v_asignacion.monto_asignado;
    v_nuevo_cobrado := v_venta.monto_cobrado + v_asignacion.monto_asignado;

    UPDATE ventas SET
      monto_debe = v_nuevo_debe,
      monto_cobrado = v_nuevo_cobrado,
      estado = CASE
        WHEN v_nuevo_debe <= 0 THEN 'PAGO'
        WHEN v_nuevo_cobrado > 0 THEN 'PARCIAL'
        ELSE 'PENDIENTE'
      END
    WHERE id = v_asignacion.venta_id;

    v_suma_asignada := v_suma_asignada + v_asignacion.monto_asignado;
  END LOOP;

  IF v_suma_asignada > p_monto THEN
    RAISE EXCEPTION 'La suma asignada (%) supera el monto del pago (%)', v_suma_asignada, p_monto;
  END IF;

  RETURN v_pago_id;
END;
$$;

-- ============================================================
-- MIGRACIÓN DE DATOS: ventas ya cobradas total o parcialmente
-- ============================================================
-- Por cada venta con monto_cobrado > 0, se crea un pago histórico 1:1
-- (las ventas viejas no tenían el concepto de "un pago cubre varias
-- ventas", así que se reconstruye lo más fiel posible a lo que había).
-- Se hace fila por fila (no INSERT...SELECT con JOIN) porque dos ventas
-- del mismo cliente pueden compartir fecha y monto_cobrado: un JOIN por
-- esas columnas podría matchear una venta con el pago de otra.
DO $$
DECLARE
  v RECORD;
  v_pago_id UUID;
BEGIN
  FOR v IN SELECT * FROM ventas WHERE monto_cobrado > 0 LOOP
    INSERT INTO pagos (cliente, fecha_pago, monto, metodo, referencia, created_at)
    VALUES (
      v.cliente,
      v.fecha,
      v.monto_cobrado,
      CASE v.metodo_pago
        WHEN 'EFECTIVO' THEN 'Efectivo'
        WHEN 'TRANSFERENCIA' THEN 'Transferencia'
        WHEN 'EFECTIVO-TRANSF' THEN 'Otro'
        ELSE 'Efectivo'
      END,
      'Migración automática',
      v.created_at
    )
    RETURNING id INTO v_pago_id;

    INSERT INTO pagos_ventas (pago_id, venta_id, monto_asignado)
    VALUES (v_pago_id, v.id, v.monto_cobrado);
  END LOOP;
END $$;
