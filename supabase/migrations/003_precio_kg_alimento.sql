-- Agrega precio por kg de alimento a la configuración de costos
ALTER TABLE config_costos ADD COLUMN IF NOT EXISTS precio_kg_alimento NUMERIC(12,2) DEFAULT 0;

-- Consumo por tipo de gallina (constantes de referencia, documentadas aquí)
-- Blancas: 115 g/día, Coloradas: 120 g/día (estándar industria ponedoras)
