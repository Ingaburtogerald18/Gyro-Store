# 08 · Deuda técnica y plan de reconstrucción — Gyro Store v2

> **CORREGIDO tras leer el código real.** La versión anterior (basada solo en archivos de
> config) sobreestimó la deuda: **casi todos los "gaps" que había marcado ya están resueltos
> y documentados en ADRs.** Este documento ahora refleja la realidad.

---

## 1. Estado real de los "gaps" que había marcado

| # | Ítem | Estado REAL | Evidencia |
|---|---|---|---|
| D1 | Reglas Firestore | ✅ **Resuelto** | deny-all versionado (ADR-008) |
| D2 | Custom claims | ⚠️ **Abierto por decisión** | ADR-006: roles por request para efecto inmediato |
| D3 | Race conditions de stock | ✅ **Resuelto** | reservar→consumir en `runTransaction`, FIFO atómico (ADR-007) |
| D4 | Validación de input | ✅ **Resuelto** | Zod compartido + `fileFilter` (ADR-010) |
| D5 | Manejo de errores | ✅ **Resuelto** | handler central (ZodError/Multer/status/500) |
| D9 | Fuga de costos en DTO | ✅ **Resuelto** | `publicItems` filtra costo/comisión a no-admin |

**Conclusión:** el sistema actual es **de nivel SR** en su núcleo. El rebuild NO es para
arreglar arquitectura rota — es para **pulir, unificar y quitar acumulación**, con la
documentación como fuente de verdad.

## 2. Deuda REAL que queda (de los ADRs y docs internos del repo)

| # | Ítem | Origen | Prioridad |
|---|---|---|---|
| R1 | **Custom claims** (elimina lectura de `users` por request) | ADR-006 | Baja (decisión) |
| R2 | **Paginación por cursor** en listados que aún hacen `.get()` completo (inventory, sales) | doc 05 | Media (al crecer) |
| R3 | **Caché backend** extender a `templates`/`app_config` (hoy solo catálogo) | doc 05 | Baja |
| R4 | **Edición de venta no es una sola transacción** (liberar→reservar); ventana pequeña, mitigada por log | ADR-007 | Baja (1 admin) |
| R5 | **Borrado R2 no transaccional** con Firestore (huérfano posible, queda en log) | ADR-009 | Baja |
| R6 | **Límites de Spark** — el modelo depende de cachear y vigilar `.get()` completos | ADR-002 | Media (vigilar) |
| R7 | **`createdAt` real en productos** para "Lo Más Nuevo" | DESIGN.md §10 | Baja |
| R8 | **Marcas/logos reales** en `/public/brands` (hoy placeholder) | DESIGN.md §10 | Baja |
| R9 | **Sombras deprecadas** (`shadow-accent-*`) fuera del storefront | DESIGN.md §10 | Baja |

## 3. Deuda de "acumulación" (lo que motivó el rebuild) [PROPUESTO]

Lo que hace que el proyecto se sienta pesado y candidato a reconstruir limpio:
- **`followups` + `contacts` coexisten** (hubo migración a medias). → Unificar en `contacts`.
- **Muchos seeds sueltos** (`seedTemplate*` por producto) — 8+ scripts. → Un seeder parametrizable.
- **Backend JS/CommonJS vs Frontend TS.** → Decidir unificar en TS.
- **`.obsidian/` y `.claude/`** viven en el repo — ruido. → Al nuevo repo solo lo esencial.
- **Config web de Firebase hardcodeada como fallback** en `config.js` (la web API key no es
  secreta, pero conviene que venga solo de env en v2). [CONFIRMADO — verificar]

---

## 4. Decisiones abiertas a cerrar antes de codear (actualizadas)

Marcá tu elección:

- [ ] **Backend:** ¿seguir JS/CommonJS o migrar a **TypeScript + ESM**? *(Rec.: TS unificado —
      ya compartís schemas Zod; sería una sola cultura de tipos.)*
- [ ] **Custom claims (R1):** ¿migrar o mantener roles por request? *(Rec.: mantener; ADR-006 es sólido.)*
- [ ] **Plan Firebase:** ¿seguir en **Spark** (obliga a cachear) o pasar a **Blaze**? *(Afecta R2/R3/R6.)*
- [ ] **CRM:** unificar `followups`→`contacts`. ¿Nativo o integrar n8n/Notion?
- [ ] **Comisiones:** documentar los **tramos reales** de la escala progresiva.
- [ ] **Config negocio:** ¿en env o editable desde `app_config`? (hoy mezcla ambos).
- [ ] **Pasarela de pago:** confirmar que sigue **fuera** (checkout WhatsApp, ADR-004).
- [ ] **Ambiente de pruebas:** ¿proyecto Firebase separado?

---

## 5. Principios de la reconstrucción (no negociables)
1. **La documentación manda.** Se codea contra estos docs; divergencia → se actualiza el doc en el mismo commit.
2. **Conservar lo que ya está bien** (es la mayoría): deny-all, Admin SDK, FIFO transaccional,
   Zod compartido, handler central, R2+Sharp+hash, caché de catálogo, máquinas de estado.
3. **Quitar acumulación**, no reescribir arquitectura probada.
4. **Commits pequeños, un dominio a la vez.**

## 6. Estrategia de repo y migración
1. **Repo nuevo, historia limpia** (`git init` fresco). No arrastrar `.git` viejo, ni `.obsidian/`.
2. **Traer y depurar:** `firestore.rules`, `render.yaml`, `.env.example`, `DESIGN.md`,
   `PRODUCT.md`, la carpeta `docs/` interna, `shared/schemas.mjs`, `server/` (revisado),
   `frontend/app/` (revisado). El código viejo es **referencia y esqueleto**, se reescribe lo justo.
3. **Higiene de secretos:** confirmar que `.env` real nunca entró a git; rotar keys de
   Firebase Admin / R2 / SMTP si hubo cualquier duda antes de agosto. (La web config de
   Firebase no es secreta, pero movela a env.)

---

## 7. Roadmap del rebuild (hacia lanzamiento en agosto)

Como el núcleo ya funciona, el rebuild es más **portar + pulir** que **construir**:

### Hito 0 — Fundación limpia
Repo + `docs/` + `.env.example` + `render.yaml` + `firestore.rules`. Portar `server/config.js`,
`firebase.js`, middleware (`auth`, `rateLimiter`), utils, `shared/schemas.mjs`. Verde `/api/health`.

### Hito 1 — Storefront (lo crítico para abrir)
Catálogo (con caché), templates, combos, PDP, checkout WhatsApp (`public_orders` con recálculo),
contacto → `contacts`. Diseño Editorial Dark (DESIGN.md), tema claro/oscuro. Cerrar R7/R8/R9.

### Hito 2 — Inventario y catálogo admin
`purchases` (FIFO), `products`, `migrated_inventory`, modo edición del catálogo (dnd-kit, CRUD,
imágenes vía Sharp+R2, promo). Máquina de estados del lote.

### Hito 3 — Ventas y facturación
`orders` (reservar→consumir), comisiones (escala progresiva — documentá tramos), pagos por
semana, `invoices` (POS 80mm, 1 ticket=1 uso), `installments`, `audit_logs`.

### Hito 4 — Reportes, gastos, logística, CRM
`reports` (KPIs, `losses`, gastos con pozos, export), `logistics_shipments` (timeline+email),
`contacts`/`followups` unificado, `feedback`, telemetría. Cron de limpieza.

### Hito 5 — Polish y QA de lanzamiento
Unificar TS (si decidís), un seeder parametrizable, auditoría a11y/perf móvil, checklist Render,
rotación de secretos.

---

## 8. Definición de "listo para lanzar" (agosto)
- [ ] Storefront completo, rápido en móvil, catálogo real con fotos WebP optimizadas.
- [ ] Checkout WhatsApp con recálculo de total en servidor.
- [ ] Núcleo seguro portado intacto (deny-all, FIFO transaccional, Zod, handler central).
- [ ] Admin con **catálogo editable + inventario + ventas** para operar el día a día.
- [ ] Sin fuga de costos (verificado `publicItems`).
- [ ] Secretos fuera de git y rotados; `/api/health` verde en Render.

Reportes finos, logística y cuotas pueden iterarse post-lanzamiento sin bloquear la apertura.
