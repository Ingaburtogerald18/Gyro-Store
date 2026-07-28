# Arquitectura y Stack Tecnológico - Gyro Store

## 1. Stack Tecnológico
El proyecto utiliza una arquitectura moderna separando claramente la experiencia del cliente (frontend) y la lógica de negocio (backend), apoyada en servicios en la nube.

*   **Frontend:** React implementado a través del framework Remix (Server-Side Rendering y Single Page Application).
*   **Estilos y UI:** Tailwind CSS para el sistema de diseño, complementado con componentes de interfaz consistentes.
*   **Backend:** Node.js, diseñado bajo un patrón estricto de separación entre Rutas (controladores) y Servicios (lógica de negocio).
*   **Base de Datos:** Firebase / Firestore (Base de datos NoSQL orientada a documentos).
*   **Almacenamiento:** [Pendiente especificar servicio, ej. Firebase Storage / Cloudflare R2].

## 2. Estructura del Sistema
La aplicación se divide en dos grandes bloques que se comunican internamente:

### 2.1 Frontend (`/frontend`)
*   **Componentes Públicos (`components/public/`):** Vistas del storefront, grillas de productos, carrito de compras y botones de interacción (WhatsApp).
*   **Componentes Administrativos (`components/admin/`):** Interfaces para el panel de control (inventario, logística, reportes, CRM, facturación).
*   **Domain & Hooks:** Lógica de estado en el cliente, cálculos de carritos y manejadores de interfaz.

### 2.2 Backend (`/server`)
*   **Rutas (`server/routes/`):** Controladores HTTP que reciben las peticiones del frontend (ej. `/api/catalog`, `/api/sales`).
*   **Servicios (`server/services/`):** Archivos que contienen la lógica pesada y hablan directamente con Firestore (ej. `inventory.js`, `commission.js`).
*   **Middleware:** Capas de seguridad, limitación de tasa (rate limiter) y autenticación que bloquean peticiones no autorizadas.

## 3. Modelo de Datos (Firestore)
*Nota: Este modelo refleja las colecciones principales de la base de datos NoSQL.*

*   **Productos / Catálogo:** Almacena información de ítems, SKUs, variantes y combos.
*   **Ventas (Sales / Orders):** Registra el historial de transacciones, estados de pago y cuotas.
*   **Inventario:** Registra el stock disponible y el historial de compras a proveedores.
*   **CRM (Contactos y Seguimientos):** Almacena datos de clientes e interacciones vía WhatsApp.
*   **Reportes / Finanzas:** Documentos de gastos, pérdidas y presupuestos.

## 4. Reglas de Seguridad y Acceso
*   **Cero Lectura Directa:** El frontend tiene estrictamente prohibido consultar Firestore directamente. Todas las peticiones deben viajar hacia el servidor Node.js.
*   **Autenticación en Middleware:** Toda ruta protegida (creación de ventas, modificaciones de inventario) debe verificar el token del usuario a través del `auth.js` antes de invocar un servicio.****
