-- ============================================================================
-- Gyro Store v2 · Seed de Desarrollo
-- ============================================================================
-- NOTA: Este script de seed es SOLO para entornos de desarrollo locales y pruebas.
-- Inserta la configuración inicial base requerida por el backend para el costeo,
-- utilidades y escalafones de comisiones. NO incluye datos de catálogo de ejemplo.
-- ============================================================================

-- ── Configuración global (app_config) ──
insert into app_config (key, value) values
  ('exchange_rate', '37'::jsonb),
  ('salary_pct', '20'::jsonb),
  (
    'pozos', 
    '{"publicidad": 25, "mantenimiento": 7, "utiles": 5, "garantias": 8, "prestamos": 40, "suscripciones": 5, "servicios": 10}'::jsonb
  ),
  (
    'costo_fu_tiers', 
    '[
      {"max": 100, "fu": 15},
      {"max": 200, "fu": 25},
      {"max": 300, "fu": 35},
      {"max": 500, "fu": 55},
      {"max": 800, "fu": 75},
      {"max": 1300, "fu": 95},
      {"max": 2000, "fu": 120},
      {"max": null, "fu": 150}
    ]'::jsonb
  ),
  (
    'margenes', 
    '[
      {"max": 300, "pct": 43},
      {"max": 500, "pct": 41},
      {"max": 900, "pct": 37},
      {"max": 1500, "pct": 33},
      {"max": 2500, "pct": 30},
      {"max": null, "pct": 25}
    ]'::jsonb
  ),
  (
    'comision_scale', 
    '[
      {"max": 100, "pct": 45},
      {"max": 200, "pct": 40},
      {"max": 400, "pct": 37},
      {"max": 500, "pct": 35},
      {"max": 600, "pct": 31},
      {"max": null, "pct": 27}
    ]'::jsonb
  ),
  (
    'mayoreo', 
    '[
      {"min_qty": 2, "pct": 2.5},
      {"min_qty": 3, "pct": 5},
      {"min_qty": 6, "pct": 10},
      {"min_qty": 12, "pct": 15, "warning": true}
    ]'::jsonb
  )
on conflict (key) do update 
set value = excluded.value;

-- ============================================================================
-- Cierre de archivo seed.sql
-- ============================================================================