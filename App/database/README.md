# Base de Datos y Migraciones

Este directorio contiene la estructura de la base de datos y scripts de inicialización.

## Orden de Migraciones
Las migraciones se encuentran en `App/database/migrations/` y deben aplicarse **estrictamente en orden**:

1. `0001_init.sql`: Enums globales + autenticación (profiles) + catálogo.
2. `0002_inventory.sql`: Inventario, compras, productos y reservas de stock.
3. `0003_sales.sql`: Ventas, órdenes y facturas (completa FK pendiente de reservas).
4. `0004_support.sql`: Soporte, logística, CRM y WhatsApp (completa FKs pendientes de contactos).

*Nota: Las dependencias circulares (FKs cruzadas) entre 0002, 0003 y 0004 se completan mediante `ALTER TABLE` al final de 0003 y 0004.*

Las migraciones siguientes (0005 en adelante) son aditivas e idempotentes. Las dos últimas:

- `0015_catalog_templates.sql`: nombre y descripción propios del producto, más categoría
  y ejes en las plantillas. Habilita el vínculo catálogo ↔ bodega.
- `0016_seed_templates_v1.sql`: plantillas heredadas de v1. **Quedó incompleta** —
  se armó leyendo el working tree de v1, que estaba 28 commits atrás. La corrige 0018.
- `0017_commission_payouts.sql`: pago de comisiones a vendedores (`commission_payments`)
  y cuenta corriente de ajustes. Tabla aparte de `payments`, que es de cuotas de clientes.
- `0018_templates_v1_fix.sql`: corrige 0016 contra `origin/main` de v1 — divide
  «KZ Castor» en Harman / Bass Enhanced / Pro Bass y agrega KZ AZ10.
- `0019_invoice_void.sql`: anulación de facturas (valor `void` del enum + quién y por qué).

> Al leer código del proyecto v1 (`D:\Gyro_Store_Web_Page_Version2`), usar siempre
> `git show origin/main:<ruta>`: el working tree local está muy por detrás del remoto.

## Cómo Aplicarlas
Aplicar una por una secuencialmente:
- Vía **SQL Editor** en el Dashboard de Supabase (copiar y pegar).
- Vía **Supabase CLI**.

## Seed de Desarrollo
El archivo `App/database/seed.sql` carga la configuración financiera inicial en `app_config`. 
**Solo ejecutar en desarrollo** AL FINAL de las migraciones. No correr en producción sin previa revisión de los valores.

## Seguridad (RLS)
**TODAS las tablas tienen Row Level Security (RLS) en `deny-all`** (sin políticas creadas). 
Nadie desde el cliente tiene acceso directo; solo el backend operando con la `service_role` key puede leer y escribir.