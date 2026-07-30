/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />

declare global {
  // Config pública inyectada por el loader de root.tsx (ver Layout).
  interface Window {
    ENV: {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
    };
  }
}

// Tipado de single fetch (flag v3_singleFetch en vite.config.ts).
declare module '@remix-run/react' {
  interface Future {
    v3_singleFetch: true;
  }
}

// El export vacío convierte este archivo en módulo: así los bloques de arriba
// AUMENTAN los tipos existentes en vez de redeclarar el módulo completo.
export {};
