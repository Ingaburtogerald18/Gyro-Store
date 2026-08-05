// Footer del catálogo público: marca, señales de confianza, ubicación enlazada a
// Maps, contacto, y barra inferior con derechos y el acceso discreto del personal.
//
// Antes era un bloque suelto dentro de `_index.tsx`, así que solo lo veía quien
// llegaba a la home. Ahora vive en el shell y cierra todas las rutas públicas.
//
// La dirección sale de `/api/config` (editable desde el panel). Las redes
// sociales del V1 NO se portan todavía: `businessInfoSchema` no tiene
// `socialLinks`, y unos iconos que apuntan a URLs inventadas son peor que nada.
import { AnimatedIcon } from '~/components/ui/animated-icons';
import { Location01Icon, Mail01Icon, SquareLock02Icon } from '@hugeicons/core-free-icons';
import { Link } from '@remix-run/react';

import { useGetConfigQuery } from '~/store/api/sessionApi';
import { TRUST_SIGNALS } from '~/lib/trustSignals';
import { getBrandName } from '~/lib/brand';

export function PublicFooter() {
  const { data: config } = useGetConfigQuery();
  const year = new Date().getFullYear();
  const brand = config?.brandName || getBrandName();
  const address = config?.address?.trim();
  const email = config?.contactEmail?.trim();

  return (
    <footer id="public-footer" className="mt-12 border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-6 py-10 text-center">
        <p className="text-xl font-bold tracking-tight text-foreground">{brand}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">
          Tecnología con garantía real y envíos a todo el país.
        </p>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          {TRUST_SIGNALS.map(({ icon, label }) => (
            <li key={label} className="inline-flex items-center gap-2">
              <AnimatedIcon icon={icon} size={16} strokeWidth={2} aria-hidden className="text-primary" />
              {label}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          {address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <AnimatedIcon icon={Location01Icon} size={16} strokeWidth={2} aria-hidden />
              {address}
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <AnimatedIcon icon={Mail01Icon} size={16} strokeWidth={2} aria-hidden />
              {email}
            </a>
          )}
        </div>
      </div>

      <div className="border-t border-border px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p className="flex items-center gap-2">
            © {year} {brand}. Todos los derechos reservados.
            {/* Acceso del personal: deliberadamente discreto — no es una acción
                para el comprador, pero tiene que existir en todas las páginas. */}
            <Link
              to="/login"
              title="Acceso de personal"
              aria-label="Acceso de personal"
              className="grid size-8 place-items-center rounded-full opacity-30 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <AnimatedIcon icon={SquareLock02Icon} size={14} strokeWidth={2} aria-hidden />
            </Link>
          </p>
          <p>
            Diseñado por <span className="font-medium text-foreground">Ing. Gerald Aburto</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
