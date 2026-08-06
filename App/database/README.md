# Base de Datos

Esquema de Gyro Store v2 sobre Supabase/Postgres.

> ⚠️ **Este baseline es para instalaciones NUEVAS.**
> La base de producción **ya está migrada** y `0001_schema.sql` **no debe
> re-aplicarse sobre ella**: los `create table` pelados fallan contra objetos que
> ya existen, y si alguno llegara a pasar, recrearía tablas vacías sobre datos
> reales.
>
> **Todo cambio futuro va en un archivo incremental nuevo** (`0004_…`), nunca
> editando estos tres.

## Los tres archivos

Están organizados por **concern**, no por historia. Cada tabla se define una sola
vez, ya en su forma final.

| Archivo | Contiene |
|---|---|
| `migrations/0001_schema.sql` | `set_updated_at()`, los 16 enums, las 2 secuencias, las 37 tablas con todas sus columnas e índices, el bucket de Storage con sus políticas, RLS deny-all y los 14 triggers de `updated_at`. |
| `migrations/0002_functions.sql` | Los 10 RPCs de reportería y canje, la vista `sales_export_view`, y el `notify pgrst` final. |
| `migrations/0003_seed.sql` | Datos de arranque: categorías, las 8 plantillas heredadas de v1, cuentas de caja/banco y la configuración financiera. |

### Migraciones incrementales

| Archivo | Contiene |
|---|---|
| `migrations/0004_sales_export_view_security_invoker.sql` | Fija `security_invoker = on` en `sales_export_view` (fix del Advisor de Supabase "Security Definer View"). Idempotente. |
| `migrations/0005_analytics.sql` | Extiende `analytics_events` (embudo del storefront: page_view · product_view · search · checkout_start · order_created) con `session_id`, `path` y su CHECK de tipos válidos. Idempotente. |
| `migrations/0006_caja_extended.sql` | Extiende Caja: `accounts.saldo_inicial`, traspasos entre cuentas (`transfer_id`) y `cash_closures` (arqueo persistido). Idempotente. |
| `migrations/0007_security_definer_search_path.sql` | Fija `search_path = public, pg_temp` en todas las funciones `security definer` de `public` (fix del Advisor de Supabase "Function Search Path Mutable"). Idempotente, por bucle sobre `pg_proc`. |

**El orden importa.** `0002` usa tablas de `0001`; `0003` inserta en tablas de
`0001`; `0004` altera la vista creada en `0002`.

`0001` no es idempotente (usa `create table` / `create type` pelados) y eso es lo
correcto para un baseline: si falla, es porque la base no estaba limpia, y es
mejor enterarse ahí que a mitad de camino. `0002` sí lo es (`create or replace`)
y `0003` también (`on conflict` / `where not exists`).

## Cómo aplicarlas

Una por una, en orden:

- Vía **SQL Editor** en el Dashboard de Supabase (copiar y pegar).
- Vía **Supabase CLI**.

## Seed de Desarrollo

`0003_seed.sql` es parte del esquema base y carga lo que el negocio necesita para
operar. **Revisar los valores financieros antes de aplicarlo en producción.**

Para ver el storefront con contenido hay además un seed **solo de desarrollo**
que inserta productos de prueba y los slides del hero:

```bash
cd App && npx tsx database/seed-catalog.dev.mts
```

Usa UUIDs fijos + upsert, así que es re-ejecutable sin duplicar. **Nunca correrlo
contra producción.** Sus imágenes quedaron vacías a propósito: hay que subir los
assets a Supabase Storage y poner ahí la URL pública.

## Seguridad (RLS)

**TODAS las tablas de `public` tienen Row Level Security en `deny-all`** (sin
políticas creadas). Nadie desde el cliente tiene acceso directo; solo el backend
operando con la `service_role` key puede leer y escribir.

`0001_schema.sql` lo aplica en un bucle sobre `pg_tables`, así que una tabla
nueva que se olvide de activarlo queda igualmente protegida al re-correr el
baseline en una instalación limpia.

La única excepción son las políticas sobre `storage.objects`: el bucket
`public-assets` sirve las fotos del catálogo público, así que su lectura es
abierta y la escritura queda restringida a usuarios autenticados.

## Dos correlativos legales

Ambos se generan con secuencias de Postgres y **ninguno se reinicia ni se reusa**:

- `invoices.invoice_code` → `GS-PR-1`, `GS-PR-2`, … (columna generada sobre
  `invoice_number`)
- `discount_codes.code` → `GS-DC-1`, `GS-DC-2`, …

Un número descartado queda quemado. Es lo correcto para algo que ya pudo haberse
impreso o repartido, y es la razón por la que anular una factura la deja en
estado `void` en vez de borrarla.
