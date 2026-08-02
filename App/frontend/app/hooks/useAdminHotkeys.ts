// Atajos de teclado del centro de administración.
//
// ── La regla que evita el desastre ──
// Todos los atajos se ignoran si el foco está en un campo de texto. Sin eso,
// escribir "Nueva compra de gorras" en un formulario dispararía `g` y te sacaría
// de la pantalla a mitad de la frase, perdiendo lo escrito.
//
// ── Por qué un solo hook y no `useEffect` sueltos ──
// `g` es un prefijo: hay que recordar que se apretó y esperar el número. Ese
// estado no puede vivir repartido en varios listeners, o dos de ellos se
// pisarían el turno.
import { useEffect, useRef } from 'react';
import { useNavigate } from '@remix-run/react';

/** Ventana para completar la secuencia `g` + número, en ms. */
const CHORD_TIMEOUT = 1200;

function isTyping(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el as HTMLElement | null)?.isContentEditable === true
  );
}

export function useAdminHotkeys({
  destinations,
  isAdmin,
  onOpenPalette,
  onOpenShortcuts,
}: {
  destinations: { to: string; adminOnly: boolean }[];
  isAdmin: boolean;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
}) {
  const navigate = useNavigate();
  const chordRef = useRef<{ armed: boolean; timer: ReturnType<typeof setTimeout> | null }>({
    armed: false,
    timer: null,
  });

  useEffect(() => {
    function disarm() {
      chordRef.current.armed = false;
      if (chordRef.current.timer) {
        clearTimeout(chordRef.current.timer);
        chordRef.current.timer = null;
      }
    }

    function onKey(e: KeyboardEvent) {
      // ⌘K sí funciona escribiendo: es la forma de salir de donde estás.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenPalette();
        return;
      }

      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      if (chordRef.current.armed) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= 9) {
          e.preventDefault();
          // Se numeran solo los destinos VISIBLES para este rol: si no, un
          // vendedor apretaría `g 3` y caería en un módulo que no puede ver.
          const list = destinations.filter((d) => !d.adminOnly || isAdmin);
          const target = list[n - 1];
          if (target) navigate(target.to);
        }
        disarm();
        return;
      }

      if (e.key.toLowerCase() === 'g') {
        chordRef.current.armed = true;
        // Sin este tope, una `g` suelta dejaría el atajo armado para siempre y
        // el próximo número tecleado navegaría sin que nadie lo pidiera.
        chordRef.current.timer = setTimeout(disarm, CHORD_TIMEOUT);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      disarm();
    };
  }, [destinations, isAdmin, navigate, onOpenPalette, onOpenShortcuts]);
}
