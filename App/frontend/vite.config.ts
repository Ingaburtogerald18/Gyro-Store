// Carga frontend/.env en process.env para que los loaders de Remix (SSR en dev)
// puedan leer SUPABASE_URL / SUPABASE_ANON_KEY sin depender de VITE_*.
import 'dotenv/config';
import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
    tailwindcss(),
  ],
  resolve: {
    // Contrato único front/back: los forms extienden shared/schemas.ts (doc 05 §6).
    alias: {
      '@shared': path.resolve(dirname, '../shared'),
      // App/shared vive fuera de esta carpeta y no tiene su propio node_modules,
      // así que la resolución normal de Node (subiendo desde shared/) no encuentra
      // 'zod'. Se fuerza a usar la copia ya instalada en frontend/node_modules.
      zod: path.resolve(dirname, 'node_modules/zod'),
    },
  },
  server: {
    port: 5173,
    // Monolito híbrido (doc 02): en dev el front corre en 5173 y proxya /api al
    // Express de :3000. En prod Express sirve el build de Remix y no hay proxy.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
