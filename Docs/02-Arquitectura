# 02 · Arquitectura — Gyro Store

> Cómo está armado el sistema, por qué, y qué patrones son obligatorios en todo el código.

---

## 1. Vista de 10.000 pies

Gyro Store es un **monolito híbrido**: un único servicio Node/Express que expone la API REST
**y** sirve el frontend Remix ya buildeado. Se despliega como **un solo Web Service en
Render**. [CONFIRMADO — `render.yaml`, `package.json`]

```
                    ┌─────────────────────────────────────────────┐
   Navegador        │              RENDER (1 Web Service)          │
  (móvil/desktop)   │                                             │
        │           │   ┌──────────────┐   sirve build   ┌──────┐ │
        │  HTTPS     │   │   Express    │ ───────────────▶│Remix │ │
        ├───────────▶│   │  (CommonJS)  │                 │build │ │
        │            │   │              │  /api/* (REST)  └──────┘ │
        │            │   │  Admin SDK   │◀─────────────────────────┤
        │            │   └──────┬───────┘                          │
        │            └──────────┼──────────────────────────────────┘
        │                       │
        │ (solo login)          │ Admin SDK (privilegios servidor)
        ▼                       ▼
  ┌───────────┐          ┌──────────────┐   ┌───────────┐   ┌──────────┐
  │  Firebase │          │  Firestore   │   │Cloudflare │   │  SMTP    │
  │   Auth    │          │  (datos)     │   │    R2     │   │ (Gmail)  │
  └───────────┘          └──────────────┘   │(imágenes) │   └──────────┘
                                            └───────────┘
```

### Decisión arquitectónica central [CONFIRMADO — `firestore.rules`]
**El navegador nunca lee ni escribe Firestore.** Solo usa Firebase Auth para obtener un ID
token. Ese token viaja al backend Express, que valida y hace **toda** la operación de datos
con el **Admin SDK**. Las security rules de Firestore están en **deny-all total**.

**Por qué:** cualquier usuario logueado (incluido un comprador con cuenta Google) tiene un ID
token válido; sin deny-all podría abrir el SDK cliente por fuera de la app y leer costos/
utilidades o escribir stock. Deny-all cierra esa puerta; el Admin SDK ignora las rules, así
que no rompe nada. → **Toda la lógica y autorización vive en el servidor.**

---

## 2. Stack técnico [CONFIRMADO — `package.json` + `README.md`]

### Backend
| Área | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | ≥ 20.19.0 |
| Framework | Express (CommonJS) | ^4.21 |
| Datos | Firebase Admin (Firestore + Auth) | ^13.0 |
| Validación | Zod | ^3.24 |
| Imágenes | `@aws-sdk/client-s3` (→ R2) + `sharp` | ^3.10 / ^0.35 |
| Seguridad HTTP | helmet, cors, express-rate-limit | ^8 / ^2.8 / ^7.5 |
| Utilidades | compression, morgan, multer, dotenv | — |
| Email | nodemailer (SMTP Gmail) | ^6.9 |
| Cron | node-cron | ^3.0 |
| Dev | concurrently, cross-env | — |

### Frontend [CONFIRMADO — `README.md`]
Remix (React, **TypeScript**) · Tailwind CSS **v4** · Redux Toolkit + RTK Query · Framer
Motion · Lucide · TanStack Table · React Hook Form + Zod · dnd-kit · Recharts · Sonner.

> **Nota de asimetría deliberada:** backend en **JavaScript/CommonJS**, frontend en
> **TypeScript**. [CONFIRMADO] En v2 evaluá si querés TS también en el backend (ver doc 08).

### Infra
Firebase (Auth + Firestore) · Cloudflare R2 (imágenes) · Render (hosting) · Gmail SMTP.

---

## 3. Estructura de carpetas [CONFIRMADO parcial — `README.md`]

```
gyro-store/
├── frontend/                 # App Remix (TypeScript)
│   ├── app/
│   │   ├── routes/           # rutas (storefront + /admin)
│   │   ├── components/       # UI (ProductCard, Hero, etc. — ver DESIGN.md)
│   │   ├── store/            # Redux Toolkit + RTK Query
│   │   ├── lib/              # firebase.client.ts, helpers
│   │   └── hooks/            # useTheme, etc.
│   ├── public/               # estáticos (brands/, mascota)
│   └── package.json          # deps del frontend (propio)
│
├── server/                   # API Express (JavaScript / CommonJS)
│   ├── index.js              # entry: monta Express + sirve Remix build
│   ├── firebase.js           # init Admin SDK, exporta { db, auth } [CONFIRMADO por check-az09.js]
│   ├── routes/               # auth, config, catalog, inventory, sales, ... (por dominio)
│   ├── middleware/           # auth (requireRole), rate limiting
│   ├── services/             # email, r2/storage, ...
│   └── utils/                # asyncHandler, sanitize, validators (Zod)
│
├── scripts/                  # seedAdmin.js, seedTemplate.js [CONFIRMADO — package.json]
├── firestore.rules           # deny-all [CONFIRMADO]
├── firestore.indexes.json    # sin índices compuestos hoy [CONFIRMADO]
├── firebase.json             # apunta a rules + indexes [CONFIRMADO]
├── .firebaserc               # proyecto default: gyro-store [CONFIRMADO]
├── render.yaml               # infra as code [CONFIRMADO]
├── .env.example              # plantilla de entorno [CONFIRMADO]
└── package.json              # backend (root) [CONFIRMADO]
```

> `server/firebase.js` exporta `{ db }` (y probablemente `auth`) — confirmado porque
> `check-az09.js` hace `const { db } = require('./server/firebase')`. [CONFIRMADO]

---

## 4. Flujo de datos (request lifecycle)

### 4.1 Lectura pública del catálogo (storefront)
```
Navegador ──GET /api/catalog──▶ Express
                                  │  (sin auth: catálogo es público)
                                  ├─ valida query (Zod)
                                  ├─ db.collection('catalog')...  (Admin SDK)
                                  └─ responde JSON  ──▶ Remix loader / RTK Query ──▶ UI
```

### 4.2 Operación autenticada (back-office)
```
Login (Firebase Auth en el navegador) ──▶ ID token
        │
Navegador ──Authorization: Bearer <ID token>──▶ Express
                                                  ├─ verifyIdToken (Admin SDK)
                                                  ├─ resuelve rol (custom claim / Firestore / ADMIN_EMAILS)
                                                  ├─ requireRole('admin'|'seller'|...)
                                                  ├─ valida body (Zod)
                                                  ├─ ejecuta (transacción si toca stock)
                                                  └─ responde JSON
```

### 4.3 Subida de imagen de producto
```
Admin ──multipart──▶ Express (multer) ──▶ sharp (optimiza/redimensiona)
                                            └─▶ PutObject a R2 (S3 SDK)
                                                 └─▶ guarda URL pública (R2_PUBLIC_URL) en Firestore
```

---

## 5. Patrones transversales (obligatorios en todo el código)

### 5.1 Todo dato pasa por el servidor [CONFIRMADO]
Ningún componente del frontend habla con Firestore directo. El frontend solo conoce
**endpoints REST** y **Firebase Auth**. Regla dura.

### 5.2 Validación en el borde con Zod [CONFIRMADO parcial — `utils/validators`]
Todo input que entra al backend (body, params, query) se valida con un **schema Zod** antes
de tocar la base. Si no valida → `400` con detalle. **[MEJORA]** En v2 esto debe ser
*universal* (el review SR marcó "no input validation layer" como gap del sistema viejo).

### 5.3 Manejo de errores estándar [MEJORA]
Un único `asyncHandler` envuelve cada handler async y un **error handler central** traduce
errores a respuestas consistentes:
```
{ "error": { "code": "STRING_MACHINE", "message": "humano", "details": {...} } }
```
Nada de `try/catch` copiado en cada ruta ni respuestas ad-hoc. (El review SR marcó
"missing error handling standards".)

### 5.4 Autorización solo del lado servidor [CONFIRMADO]
`requireRole(...)` en el backend es la verdad. El `<RequireRole>` del frontend es solo UX
(ocultar botones); nunca es la barrera de seguridad. [CONFIRMADO — `README.md`]

### 5.5 Concurrencia de inventario con transacciones [MEJORA]
Todo decremento/incremento de stock corre dentro de una **transacción Firestore**
(`runTransaction`) o `FieldValue.increment` atómico. El review SR marcó "race conditions on
inventory decrements" — en v2 no puede haber lectura-modificación-escritura sin transacción.

### 5.6 Idempotencia y estados explícitos
Los flujos con máquina de estados (inventario `china→pending→received`, ventas, logística)
guardan el estado como campo enumerado y **solo permiten transiciones válidas** validadas en
el servidor. [CONFIRMADO — flujos existen; validación estricta es MEJORA]

---

## 6. Límites del sistema y dependencias externas

| Dependencia | Rol | Falla si… | Mitigación v2 [MEJORA] |
|---|---|---|---|
| Firebase Auth | login del personal | cae → nadie entra a `/admin` | el storefront público sigue vivo (no requiere auth) |
| Firestore | toda la data | cae → API 5xx | health check + página de estado; catálogo cacheable |
| Cloudflare R2 | imágenes | cae → sin fotos | fotos son URLs; usar placeholder/`onError` |
| Render | hosting | cold start / caída | health check `/api/health` [CONFIRMADO] |
| Gmail SMTP | emails de logística/invitación | cae → sin email | encolar/reintentar; no bloquear la operación |

---

## 7. Decisiones de arquitectura (ADRs)

> **El repo ya tiene `docs/07_adr.md` con 10 ADRs formales y precisos.** Esta es la versión
> resumida para el rebuild; ante cualquier duda, ese archivo es la fuente canónica. Editá el
> "Estado" si en v2 decidís otra cosa.

| ADR (repo) | Decisión | Estado v2 |
|---|---|---|
| 001 | Monolito Express que sirve API + Remix en Render | **MANTENER** |
| 002 | Firestore (Spark) + Admin SDK | MANTENER (⚠️ vigilar límites Spark → decidir Blaze) |
| 003 | Cliente nunca toca Firestore; todo por el backend | **MANTENER (base de todo)** |
| 004 | Checkout manual por WhatsApp (sin pasarela) | MANTENER (reversible) |
| 005 | Cloudflare R2 + Sharp (WebP) + nombre por hash | **MANTENER** |
| 006 | Roles resueltos por request (sin custom claims) | MANTENER o migrar → **decisión abierta** (doc 03 §A.5) |
| 007 | Reservar→consumir stock con transacciones (FIFO atómico) | **MANTENER (excelente)** |
| 008 | Reglas Firestore deny-all versionadas | **MANTENER** |
| 009 | Limpieza de imágenes huérfanas en R2 al borrar | MANTENER |
| 010 | Zod + `fileFilter` en subidas | **MANTENER** |

**Único punto histórico no cubierto por ADR:** backend en JS/CommonJS vs frontend en TS →
**A DECIDIR** en v2 (doc 08 §4).

### Detalles de arquitectura confirmados que conviene no perder en el rebuild
- **Caché de catálogo en memoria** (`catalogCache`): `GET /api/catalog` trae todo + templates
  una vez, filtra en memoria, invalida al escribir. Clave por límites de Spark.
- **COOP relajado** (`same-origin-allow-popups`) en helmet — si no, rompe `signInWithPopup`.
- **`trust proxy = 1`** — imprescindible tras el proxy de Render (rate-limit e IPs correctas).
- **Checkout público** recalcula el total en servidor (`public_orders`), nunca confía en el cliente.
