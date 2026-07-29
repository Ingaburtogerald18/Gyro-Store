# 00 · Índice y guía — Gyro Store v2

> Este set de documentos es mi fuente de verdad para reconstruir Gyro Store limpio, en el repo
> nuevo. Lo escribo para mí (para acordarme por qué decidí cada cosa cuando vuelva en tres meses)
> y para cualquiera que me ayude a tocar el código más adelante. La idea es simple: **primero
> ordeno la documentación, después escribo el código siguiéndola**. El código viejo me sirve de
> esqueleto y referencia, no de molde a copiar.

---

## Cómo trabajo con estos documentos

1. **Se leen en orden (00 → 09).** Están pensados para leerse de corrido una vez y entender el
   sistema completo.
2. **Son la especificación de lo que quiero que sea v2, no un registro histórico.** Si algo del
   sistema viejo no me gusta, lo cambio acá *antes* de escribir una línea de código.
3. **Regla de oro que me impongo:** el código sigue a la documentación, no al revés. Si mientras
   construyo el código y el doc se contradicen, actualizo el doc en el mismo commit. Nada de docs
   que envejecen mientras el código avanza por su lado.

## El cambio grande de v2: me paso a Supabase

La v1 vivía sobre **Firebase (Auth + Firestore)**. Para v2 decidí migrar a **Supabase (Postgres +
Auth)**. No es solo cambiar de proveedor: paso de una base **NoSQL** a una **SQL relacional**, y
eso me arregla varias cosas que antes tenía que resolver a mano:

- **El stock y el FIFO** dejan de depender de `runTransaction` de Firestore; ahora son transacciones
  de Postgres con bloqueo de fila (`SELECT ... FOR UPDATE`). Más robusto y estándar.
- **Los reportes** los puedo sacar con SQL (vistas y *materialized views*) en vez de cachear toda
  la colección en memoria para no reventar los límites de lectura. El caché de catálogo pasa de
  obligatorio a opcional.
- **El rol del usuario** lo puedo resolver con una lectura barata a una tabla, o meterlo en el JWT
  con un hook de Supabase. Reabre en mejores términos la vieja duda de los custom claims.

La data que ya existía en Firestore **no me importa** (eran pruebas para armar reportería). Empiezo
la base de datos limpia.

## Decisiones que ya cerré para v2

Estas son las decisiones de arranque. El resto del set las respeta y las detalla:

| Tema | Decisión | Por qué |
|---|---|---|
| **Base de datos** | Supabase (Postgres) | SQL me da transacciones y agregados nativos; menos parches. |
| **Capa de seguridad** | El servidor manda: todo el dato pasa por Express con la `service_role`; RLS en **deny-all** como segunda barrera. | Es el mismo modelo del deny-all + Admin SDK que ya me funcionaba. Protege costos/utilidades. |
| **Autenticación** | Solo **Microsoft Entra ID** con cuentas `@gyrostorenic.com` (vía Supabase Azure). | Tengo el tenant; una sola fuente de identidad, altas/bajas centralizadas en Microsoft 365. |
| **Imágenes** | Sigo en **Cloudflare R2** (+ Sharp + nombre por hash). | Ya funciona bien y no tiene costo de egress; no reescribo un subsistema sano. |
| **Backend** | **TypeScript + ESM** (unificado con el front). | Supabase me genera tipos desde el schema; una sola cultura de tipos front/back. |
| **Email transaccional** | **Microsoft 365** desde `@gyrostorenic.com`. | Misma identidad que el login, mejor entregabilidad y branding. |
| **Ambientes** | **Dos proyectos Supabase**: dev y prod. | Pruebo migraciones sin ensuciar la data real de la tienda. |
| **UI** | **shadcn/ui** sobre mis tokens de `DESIGN.md`. | Componentes sin estilo impuesto: preservan el look Editorial Dark, accesibles, estándar con Tailwind v4. |
| **CRM / seguimientos** | CRM nativo + **WhatsApp Cloud API** (Meta), **sin n8n al inicio** (webhook directo a Express). | Lo más barato para arrancar (~$0/mes); detalle y plan por fases en el doc 10. |

## Convención de marcadores

Cuando armé este set no tenía todo el código fuente a la vista, así que cada afirmación no trivial
lleva una marca de confianza. La mantengo porque me sirve para saber en qué confiar:

| Marca | Significado | Qué hago |
|---|---|---|
| `[CONFIRMADO]` | Lo verifiqué contra un archivo real del proyecto viejo (rules, env, README, deps, scripts). | Confío. Solo lo cambio si quiero otra cosa. |
| `[PROPUESTO]` | Reconstrucción de intención: no tenía el código, lo inferí del dominio y de buenas prácticas. | Lo reviso con lupa y lo ajusto a como lo quiero de verdad. |
| `[MEJORA]` | No existía (o estaba flojo) en el sistema viejo; es una mejora deliberada del rebuild. | Decido si entra en v2 o queda para después. |
| `[v2]` | Cambio nuevo de esta versión (Supabase, Entra, TS, etc.) respecto a la v1. | Es lo que estoy migrando; ya está decidido arriba. |

## Mapa de la documentación

| # | Documento | Contenido |
|---|---|---|
| 00 | **Índice y guía** (este) | Cómo leo y edito el set. Decisiones de arranque. Convenciones. |
| 01 | **Producto** | Visión, usuarios, alcance, marca, objetivos de éxito. |
| 02 | **Arquitectura** | Sistema, stack, decisiones, estructura de carpetas, flujo de datos, patrones. |
| 03 | **Datos y seguridad** | Modelo Postgres (tablas/relaciones), auth con Entra, roles, RLS, autorización. |
| 04 | **Backend (API)** | Contratos de endpoints por dominio, middleware, validación, errores, servicios (R2, email, cron). |
| 05 | **Frontend** | Rutas Remix, estado (Redux/RTK Query), shadcn/ui, componentes clave. Diseño → `DESIGN.md`. |
| 06 | **Dominios funcionales** | Las 8 fases al detalle: catálogo, inventario, ventas, facturación, reportes, usuarios, logística, polish. |
| 07 | **Infraestructura y despliegue** | Entorno, variables, Render, Supabase, R2, build, imágenes. |
| 08 | **Deuda técnica y plan de reconstrucción** | Hallazgos del review, decisiones cerradas, orden de trabajo, estrategia de repo. |
| 09 | **Orden de construcción** | Qué archivos de código creo primero y en qué orden, uno por uno, para armar el repo. |
| 10 | **CRM y automatización WhatsApp** | Ficha 360, agenda de seguimientos, bandeja e integración con WhatsApp Cloud API (Meta). Decisiones de costo y plan por fases. |
| 11 | **Lógica financiera y operativa** | Toda la matemática del negocio: costeo, Costo F/U y pozos, PVP, comisiones, mayoreo y reportería. Sale de mi Excel real. |

## Documentos canónicos que ya existían (no los duplico acá)

- **`DESIGN.md`** — Mi sistema de diseño "Editorial Dark". Es la fuente de verdad del look del
  storefront. No hace falta reescribirlo; el doc 05 lo referencia. **En v2 lo implemento con
  shadcn/ui**, pintando cada componente con mis tokens (no uso el estilo por defecto de la librería).
- **`PRODUCT.md`** — Mi brief de producto. El doc 01 lo absorbe y expande.
- **`docs/` interno del repo viejo (11 archivos)** — documentación precisa del **sistema tal como
  estaba en v1** (arquitectura, stack, rutas API, diagramas, modelo Firestore, máquinas de estado,
  ADRs, operación, changelog, guidelines de frontend). Me sirve de referencia técnica de dónde venía,
  aunque el modelo de datos cambia con Supabase.

### Relación entre los dos sets
- El **`docs/` interno viejo** describe cómo estaba el sistema en **Firebase** (referencia histórica).
- **Este set (00–09)** es la **spec del rebuild sobre Supabase**: lo que quiero que sea v2.
- **Dónde lo guardo en el repo nuevo:** este set va en `docs/rebuild/` (o `docs/v2/`) para que
  conviva con cualquier doc técnico sin pisarlo. Cuando algo se implementa, lo reflejo también en
  la doc técnica del repo nuevo.

---

## Glosario rápido (para que todos los docs hablen el mismo idioma)

- **Storefront** — la parte pública: home, categorías, ficha de producto (PDP), carrito → WhatsApp.
- **Back-office / Admin** — el portal `/admin`: inventario, ventas, facturación, reportes, usuarios, logística.
- **PDP** — *Product Detail Page*, la ficha de producto (`producto.$id`).
- **Monolito híbrido** — un solo servicio Express que sirve la API *y* el frontend Remix buildeado.
- **`service_role`** — la llave de servidor de Supabase con privilegios totales; **ignora las RLS**
  (es el equivalente al Admin SDK de Firebase). Solo vive en el servidor, nunca en el navegador.
- **RLS** — *Row Level Security* de Postgres. En v2 la dejo en **deny-all** como segunda barrera:
  aunque se filtrara la `anon key`, nadie lee ni escribe directo la base.
- **Entra ID** — Microsoft Entra ID (antes Azure AD), mi proveedor de identidad para el staff.
- **R2** — Cloudflare R2, almacenamiento de imágenes compatible con S3.
- **Checkout WhatsApp** — el pedido se cierra fuera de la web, por chat; la web es catálogo + captación.
