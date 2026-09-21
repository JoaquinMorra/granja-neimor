-- ============================================================
-- GRANJA NEIMOR - Fuente única de verdad del saldo por cliente
-- ============================================================
-- "cliente" sigue siendo TEXT libre (no hay tabla clientes en el sistema).
-- ventas.monto_cobrado / monto_debe ya son mantenidos por el RPC
-- registrar_pago (013_pagos_cuenta_corriente.sql), así que son la fuente
-- correcta por venta — el bug de fondo no era la fórmula, era que algunas
-- pantallas agregaban sobre una lista de ventas recortada a las 500 más
-- recientes de TODOS los clientes, en vez del historial completo de cada uno.

-- ============================================================
-- VISTA: vista_saldos_clientes
-- ============================================================
CREATE OR REPLACE VIEW vista_saldos_clientes AS
SELECT
  cliente,
  MAX(fecha) AS ultima_venta,
  COUNT(*) AS cantidad_ventas,
  COUNT(*) FILTER (WHERE monto_debe > 0) AS cantidad_ventas_pendientes,
  MIN(fecha) FILTER (WHERE monto_debe > 0) AS fecha_venta_pendiente_mas_vieja,
  SUM(monto_cobrado + monto_debe) AS total_facturado,
  SUM(monto_cobrado) AS total_cobrado,
  SUM(monto_debe) AS saldo
FROM ventas
GROUP BY cliente;

-- ============================================================
-- TABLA DE AUDITORÍA del recálculo puntual
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria_recalculo_saldos_clientes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id                UUID NOT NULL,
  cliente                 TEXT NOT NULL,
  monto_cobrado_anterior  NUMERIC(12,2) NOT NULL,
  monto_cobrado_nuevo     NUMERIC(12,2) NOT NULL,
  monto_debe_anterior     NUMERIC(12,2) NOT NULL,
  monto_debe_nuevo        NUMERIC(12,2) NOT NULL,
  estado_anterior         TEXT NOT NULL,
  estado_nuevo            TEXT NOT NULL,
  corregido_en            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE auditoria_recalculo_saldos_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leen auditoria_recalculo_saldos_clientes"    ON auditoria_recalculo_saldos_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben auditoria_recalculo_saldos_clientes" ON auditoria_recalculo_saldos_clientes FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- RECÁLCULO PUNTUAL: comparar cada venta contra la suma real de
-- pagos_ventas (el registro inmutable de lo efectivamente aplicado) y
-- corregir donde no coincida. El total facturado de la venta
-- (monto_cobrado + monto_debe) nunca lo toca este bloque: se recalcula
-- solo cómo se reparte entre cobrado/debe.
-- ============================================================
DO $$
DECLARE
  v RECORD;
  v_cobrado_real NUMERIC;
  v_total NUMERIC;
  v_debe_real NUMERIC;
  v_estado_real TEXT;
BEGIN
  FOR v IN SELECT * FROM ventas LOOP
    SELECT COALESCE(SUM(monto_asignado), 0) INTO v_cobrado_real
    FROM pagos_ventas WHERE venta_id = v.id;

    v_total := v.monto_cobrado + v.monto_debe;
    v_debe_real := v_total - v_cobrado_real;
    v_estado_real := CASE
      WHEN v_debe_real <= 0 THEN 'PAGO'
      WHEN v_cobrado_real > 0 THEN 'PARCIAL'
      ELSE 'PENDIENTE'
    END;

    IF v_cobrado_real <> v.monto_cobrado OR v_debe_real <> v.monto_debe OR v_estado_real <> v.estado THEN
      INSERT INTO auditoria_recalculo_saldos_clientes (
        venta_id, cliente, monto_cobrado_anterior, monto_cobrado_nuevo,
        monto_debe_anterior, monto_debe_nuevo, estado_anterior, estado_nuevo
      ) VALUES (
        v.id, v.cliente, v.monto_cobrado, v_cobrado_real,
        v.monto_debe, v_debe_real, v.estado, v_estado_real
      );

      UPDATE ventas SET
        monto_cobrado = v_cobrado_real,
        monto_debe = v_debe_real,
        estado = v_estado_real
      WHERE id = v.id;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- Para revisar qué clientes cambiaron (correr aparte, después de aplicar
-- todo lo de arriba):
--
-- SELECT cliente,
--        COUNT(*) AS ventas_corregidas,
--        SUM(monto_debe_nuevo - monto_debe_anterior) AS diferencia_en_deuda
-- FROM auditoria_recalculo_saldos_clientes
-- GROUP BY cliente
-- ORDER BY ABS(SUM(monto_debe_nuevo - monto_debe_anterior)) DESC;
-- ============================================================
