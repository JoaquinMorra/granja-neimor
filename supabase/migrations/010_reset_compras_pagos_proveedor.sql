-- Reset de datos de prueba: borra todas las compras y pagos a proveedores
-- para arrancar de cero antes de implementar la anulaciÃ³n/eliminaciÃ³n de compras.
-- Los movimientos de caja generados por esos pagos NO se borran: quedan en el
-- historial de caja tal cual (la FK caja.pago_proveedor_id es ON DELETE SET NULL,
-- asi que Postgres desvincula la referencia automaticamente).

DELETE FROM pagos_proveedor;
DELETE FROM compras_proveedor;
