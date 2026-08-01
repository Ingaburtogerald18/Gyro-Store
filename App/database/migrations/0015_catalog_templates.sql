-- ============================================================================
-- Gyro Store v2 · Migración 0015 · Plantillas con ejes + vínculo catálogo↔bodega
-- ============================================================================
-- Recupera el modelo de catálogo de v1 (server/routes/catalog.js + templates.js):
--
--   templates    = el molde REUTILIZABLE. Define los ejes de variante
--                  (Color, Conector, Capacidad…) y las specs base.
--   catalog_items= el producto que se vende. Elige un molde, recorta qué
--                  opciones ofrece (`axis_options`) y mapea cada combinación
--                  exacta a lo que hay en bodega (`variant_mappings`).
--
-- Las columnas jsonb del vínculo (`variant_mappings`, `axis_options`,
-- `templates.axes`) YA existían desde 0001_init.sql pero nadie las escribía:
-- `services/adminCatalog.ts` insertaba `axes: {}` y listo. Esta migración no
-- las crea, solo agrega lo que faltaba para que el modelo cierre.
--
-- ── Por qué `catalog_items.name` ──
-- Hasta ahora el nombre vivía en `templates.name` y había un template por
-- producto (relación 1:1 de hecho). Con moldes REUTILIZABLES eso se rompe: dos
-- productos que comparten plantilla compartirían el nombre. El nombre del molde
-- ("Plantilla Audífonos KZ") y el del producto ("KZ ZSN Pro X") son cosas
-- distintas, así que cada uno vive en su tabla — como en v1.
--
-- Migración aditiva e idempotente (convención de 0005/0006/0007): `if not
-- exists` en cada columna para poder re-correrla sin fallar.
-- ============================================================================

-- ── Producto: nombre y descripción propios, independientes del molde ──
alter table catalog_items
  add column if not exists name        text,
  add column if not exists description text;

-- Backfill: los productos que ya existen heredan el nombre de su template
-- (que hasta hoy era su único nombre). Sin esto quedarían con `name` nulo y el
-- panel los mostraría como "Sin nombre" tras el deploy.
update catalog_items ci
   set name = t.name
  from templates t
 where ci.template_id = t.id
   and ci.name is null;

-- ── Molde: categoría y nota interna ──
-- `category_id` filtra qué plantillas se ofrecen al editar un producto de esa
-- categoría (en v1 era un string suelto; acá es FK real a `categories`).
alter table templates
  add column if not exists category_id uuid references categories(id) on delete set null,
  add column if not exists description text;

-- `axes` nació con default '{}' (objeto), pero la forma canónica es un ARRAY
-- ordenado de ejes: [{ key, label, options[], isColor }]. El orden importa —
-- define cómo se arma el nombre de la combinación ("Negro / Con micrófono") y
-- ese string es la llave de `variant_mappings`. Un objeto jsonb no garantiza
-- orden; un array sí.
alter table templates
  alter column axes set default '[]'::jsonb;

-- Normaliza las filas viejas que quedaron con el default de objeto vacío.
-- `services/catalogPresenter.ts` tolera ambas formas al leer, pero dejar una
-- sola forma en la base evita que esa rama de compatibilidad crezca.
update templates set axes = '[]'::jsonb where axes = '{}'::jsonb;

-- Índice para el filtro por categoría del selector de plantillas.
create index if not exists templates_category_id_idx on templates (category_id);

-- ============================================================================
-- Cierre de archivo de migración 0015_catalog_templates.sql
-- ============================================================================
