// Carrito. En desktop es un panel lateral desde la derecha; en móvil baja desde
// arriba, al alcance del pulgar. Lista las líneas, deja ajustar cantidad o
// eliminar, y abre el checkout.
//
// Construido sobre <Sheet> de shadcn/ui: el foco atrapado, el cierre con Escape
// y el aria del diálogo vienen resueltos por Radix.
import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { ImageOff, Minus, Plus, ShoppingBag, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { CheckoutDialog } from './checkout-dialog';
import { useMediaQuery } from '~/hooks/useMediaQuery';
import { useGetConfigQuery } from '~/store/api/configApi';
import { useAppDispatch, useAppSelector } from '~/store/hooks';
import {
  closeCart,
  lineKey,
  removeItem,
  selectCartItems,
  selectCartOpen,
  selectCartSubtotal,
  setQuantity,
} from '~/store/slices/cartSlice';
import { formatCordobas } from '~/lib/utils';

export function CartDrawer() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isOpen = useAppSelector(selectCartOpen);
  const items = useAppSelector(selectCartItems);
  const subtotal = useAppSelector(selectCartSubtotal);
  const { data: config } = useGetConfigQuery();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // "Seguir comprando": cierra el carrito y baja a la grilla del catálogo. El
  // scroll manual cubre el caso de ya estar en la home (la ruta no remonta).
  function keepShopping() {
    dispatch(closeCart());
    navigate('/#catalogo');
    setTimeout(
      () =>
        document
          .getElementById('catalogo')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      120,
    );
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch(closeCart())}>
        <SheetContent
          side={isDesktop ? 'right' : 'top'}
          className="flex flex-col bg-surface p-0 max-md:h-[85dvh] max-md:rounded-b-3xl md:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-border p-4">
            <SheetTitle className="text-lg font-bold text-text">Tu carrito</SheetTitle>
            <SheetDescription className="flex items-center gap-1.5 text-xs text-muted">
              {items.length > 0 ? (
                <>
                  <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0 text-accent" />
                  Buena elección — revisalo y finalizalo cuando quieras.
                </>
              ) : (
                'Todavía no agregaste nada.'
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-surface-2 text-muted">
                  <ShoppingBag aria-hidden className="h-7 w-7" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-lg font-bold text-text">Tu carrito está vacío… por ahora</p>
                  <p className="mx-auto max-w-[16rem] text-sm leading-relaxed text-muted">
                    Explorá la tienda y descubrí lo que podés llevarte hoy.
                  </p>
                </div>
                <Button onClick={keepShopping}>Explorar catálogo</Button>
              </div>
            ) : (
              <>
                {items.map((item) => {
                  const key = lineKey(item);
                  return (
                    <div
                      key={key}
                      className="flex gap-3 rounded-xl border border-border bg-bg p-3"
                    >
                      <div className="product-stage h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-muted">
                            <ImageOff aria-hidden className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col">
                        <p className="text-sm leading-tight font-medium text-text">{item.name}</p>
                        {item.variantName !== 'Estándar' && (
                          <p className="text-xs text-muted">{item.variantName}</p>
                        )}
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={`Quitar una unidad de ${item.name}`}
                              onClick={() =>
                                dispatch(setQuantity({ key, quantity: item.quantity - 1 }))
                              }
                              className="h-11 w-11 rounded-md md:h-6 md:w-6"
                            >
                              <Minus aria-hidden className="h-3 w-3" />
                            </Button>
                            <span className="w-5 text-center text-sm text-text tabular-nums">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={`Agregar una unidad de ${item.name}`}
                              onClick={() =>
                                dispatch(setQuantity({ key, quantity: item.quantity + 1 }))
                              }
                              className="h-11 w-11 rounded-md md:h-6 md:w-6"
                            >
                              <Plus aria-hidden className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-sm font-semibold text-text tabular-nums">
                            {formatCordobas(item.price * item.quantity, config?.currency)}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => dispatch(removeItem(key))}
                        aria-label={`Eliminar ${item.name} del carrito`}
                        className="h-11 w-11 shrink-0 self-start text-muted hover:text-danger md:h-8 md:w-8"
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}

                <Button
                  variant="ghost"
                  onClick={keepShopping}
                  className="w-full justify-center gap-2 rounded-xl border border-dashed border-border bg-bg/40 py-3 text-sm font-medium text-muted hover:border-accent/40 hover:text-text"
                >
                  <Plus aria-hidden className="h-4 w-4" />
                  Agregar otro producto
                </Button>
              </>
            )}
          </div>

          {items.length > 0 && (
            <footer className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-muted">Total</span>
                <span className="text-xl font-bold text-text tabular-nums">
                  {formatCordobas(subtotal, config?.currency)}
                </span>
              </div>
              {/* El total definitivo lo recalcula el servidor al crear el pedido. */}
              <Button
                variant="whatsapp"
                className="w-full"
                onClick={() => setCheckoutOpen(true)}
              >
                Finalizar pedido por WhatsApp
              </Button>
            </footer>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </>
  );
}
