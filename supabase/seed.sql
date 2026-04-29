-- ============================================================
-- GRANJA NEIMOR - Seed de datos iniciales
-- Ejecutar DESPUÉS del migration 001_initial.sql
-- ============================================================

-- Galpones
INSERT INTO galpones (id, nombre, tipo, orden) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Galpón 1', 'coloradas', 1),
  ('22222222-2222-2222-2222-222222222222', 'Galpón 2', 'coloradas', 2),
  ('33333333-3333-3333-3333-333333333333', 'Galpón 3', 'coloradas', 3),
  ('44444444-4444-4444-4444-444444444444', 'Galpón 4', 'blancas',   4);

-- Galpón 1 - Coloradas (nacidas 16/11/2023)
INSERT INTO lotes (galpon_id, nombre, gallinas_inicial, fecha_nacimiento, activo) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Lote 1', 624, '2023-11-16', true),
  ('11111111-1111-1111-1111-111111111111', 'Lote 2', 576, '2023-11-16', true),
  ('11111111-1111-1111-1111-111111111111', 'Lote 3', 637, '2023-11-16', true);

-- Galpón 2 - Coloradas (nacidas 28/05/2024)
INSERT INTO lotes (galpon_id, nombre, gallinas_inicial, fecha_nacimiento, activo) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Lote 1', 675, '2024-05-28', true),
  ('22222222-2222-2222-2222-222222222222', 'Lote 2', 631, '2024-05-28', true),
  ('22222222-2222-2222-2222-222222222222', 'Lote 3', 758, '2024-05-28', true);

-- Galpón 3 - Coloradas (Lote 3 sin fecha, Lote 4 nacido 22/11/2024)
INSERT INTO lotes (galpon_id, nombre, gallinas_inicial, fecha_nacimiento, activo) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Lote 3', 1498, NULL,         true),
  ('33333333-3333-3333-3333-333333333333', 'Lote 4', 1200, '2024-11-22', true);

-- Galpón 4 - Blancas (sin fecha de nacimiento)
INSERT INTO lotes (galpon_id, nombre, gallinas_inicial, fecha_nacimiento, activo) VALUES
  ('44444444-4444-4444-4444-444444444444', 'Lote 1', 1459, NULL, true),
  ('44444444-4444-4444-4444-444444444444', 'Lote 2', 1485, NULL, true),
  ('44444444-4444-4444-4444-444444444444', 'Lote 3', 1496, NULL, true),
  ('44444444-4444-4444-4444-444444444444', 'Lote 4', 1860, NULL, true);
