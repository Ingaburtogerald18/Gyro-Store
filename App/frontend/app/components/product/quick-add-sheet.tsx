// QuickAddSheet (patrón del V1): con >1 combinación de variantes, la tarjeta
// abre este sheet para elegir ANTES de agregar, en vez de mandar "Estándar" al
// carrito. Los ejes no viajan en el listado (solo variantCount/axesSummary),
// así que se piden al detalle recién al abrir — RTK Query los cachea por id.
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { Skeleton } from '~/components/ui/skeleton';
import {
  VariantPicker,
  variantLabel,
  type VariantSelection,
} from '~/components/product/variant-picker';
import { useGetCatalogDetailQuery } from '~/store/api/storefrontApi';
import { useGetConfigQuery } from '~/store/api/sessionApi';
import { useAppDispatch } from '~/store/hooks';
import { addItem, openCart } from '~/store/slices/cartSlice';
import { formatCordobas } from '~/lib/formatters';
import type { CatalogProduct } from '@shared/schemas';

export function QuickAddSheet({
  product,
  open,
  onOpenChange,
}: {
  product: CatalogProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const { data: config } = useGetConfigQuery();
  // skip mientras está cerrado: no gastar el fetch en tarjetas que nadie tocó.
  const { data: detail, isLoading } = useGetCatalogDetailQuery(product.id, { skip: !open });
  const [selection, setSelection] = useState<VariantSelection>({});

  const axes = detail?.axes ?? [];
  const pickableAxes = axes.filter((a) => a.options.length > 0);
  const missingAxis = pickableAxes.find((a) => !selection[a.key]);

  function handleAdd() {
    if (missingAxis) {
      toast.error(`Elegí ${missingAxis.key} antes de agregar.`);
      return;
    }
    dispatch(
      addItem({
        catalogId: product.id,
        name: product.name,
        variantName: variantLabel(axes, selection),
        price: product.price,
        image: product.images[0] ?? '',
        quantity: 1,
      }),
    );
    setSelection({});
    onOpenChange(false);
    dispatch(openCart());
    toast.success('Agregado al carrito');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">{product.name}</SheetTitle>
          <SheetDescription className="text-left">
            Elegí tu variante —{' '}
            <span className="font-bold text-primary-2 tabular-nums">
              {formatCordobas(product.price, config?.currency)}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-pill" />
                <Skeleton className="h-8 w-20 rounded-pill" />
                <Skeleton className="h-8 w-20 rounded-pill" />
              </div>
            </div>
          ) : (
            <VariantPicker axes={axes} selection={selection} onChange={setSelection} />
          )}

          <Button onClick={handleAdd} disabled={isLoading} className="h-12 w-full">
            Agregar al carrito
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
