import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, CloudUploadIcon, Delete02Icon, FloppyDiskIcon, ImageAdd01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState, useRef } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldPath,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { getSupabaseClient } from '~/lib/supabase.client';
import { Card, CardContent } from '~/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import { AnimatedTabs } from '~/components/ui/AnimatedTabs';

import {
  financialConfigSchema,
  imageResourcesSchema,
  type FinancialConfig,
  type ImageResources,
} from '@shared/schemas';
import { BrandLoader } from '~/components/ui/module-loader';
import { QueryState } from '~/components/ui/QueryState';
import { useAppDispatch } from '~/store/hooks';
import { configApi } from '~/store/api/configApi';

function Section({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col bg-card border shadow-sm overflow-hidden ${className || ''}`}>
      <div className="p-6 pb-4">
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <CardContent className="flex-1 p-6 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

const EMPTY_IMAGES: ImageResources = {
  logoStatic: '',
  logoAnimated: '',
  favicon: '',
  posLogo: '',
};

function ImagesConfig() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  // Track images uploaded in this session to clean them up if discarded
  const uploadedInSession = useRef<Set<string>>(new Set());
  const dispatch = useAppDispatch();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ImageResources>({
    resolver: zodResolver(imageResourcesSchema),
    defaultValues: EMPTY_IMAGES,
  });

  const config = watch();

  useEffect(() => {
    const fetchConfig = async () => {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const res = await fetch('/api/admin/config/images', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        if (!res.ok) throw new Error('Error al cargar imágenes');
        const data = await res.json();
        reset({
          logoStatic: data.logoStatic || '',
          logoAnimated: data.logoAnimated || '',
          favicon: data.favicon || '',
          posLogo: data.posLogo || ''
        });
      } catch (err: any) {
        toast.error(err.message || 'No se pudieron cargar los recursos.');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [reset]);

  const onSubmit = async (values: ImageResources) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión');

      const res = await fetch('/api/admin/config/images', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(values)
      });

      if (!res.ok) throw new Error('Error al guardar imágenes');
      const data = await res.json();
      reset(data);
      uploadedInSession.current.clear(); // All saved, nothing to clean up
      dispatch(configApi.util.invalidateTags(['Config']));
      toast.success('Recursos guardados correctamente.');
    } catch (err: any) {
      toast.error(err.message || 'No se pudieron guardar los recursos.');
    }
  };

  const uploadFile = async (file: File, key: keyof ImageResources) => {
    try {
      setUploading(true);

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'config'); // Folder in Cloudflare R2

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir la imagen');

      // If replacing an image that was uploaded *in this session* (not yet saved),
      // delete it from R2 to avoid orphans.
      const prevUrl = getValues(key);
      if (prevUrl && uploadedInSession.current.has(prevUrl)) {
        fetch('/api/upload', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
          },
          body: JSON.stringify({ url: prevUrl })
        }).catch(console.error);
        uploadedInSession.current.delete(prevUrl);
      }

      uploadedInSession.current.add(data.url);
      setValue(key, data.url, { shouldDirty: true });
    } catch (err: any) {
      toast.error(err.message || 'Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const renderUploadBox = (title: string, desc: string, key: keyof ImageResources) => {
    const isAnimated = key === 'logoAnimated';
    const acceptAttr = isAnimated ? "image/*,video/*" : "image/*";

    return (
      <div className="flex flex-col gap-3 rounded-lg border bg-muted p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        {config[key] ? (
          <div className="relative group rounded-lg border bg-card p-2">
            <div className="aspect-video w-full flex items-center justify-center overflow-hidden rounded-md bg-black/20">
              {config[key]?.match(/\.(webm|mp4|mov)$/i) ? (
                <video src={config[key]} autoPlay loop muted playsInline className="max-h-32 max-w-full object-contain" />
              ) : (
                <img src={config[key]} alt={title} className="max-h-32 max-w-full object-contain" />
              )}
            </div>
            <button
              type="button"
              onClick={async () => {
                const url = config[key];
                if (url && uploadedInSession.current.has(url)) {
                  const supabase = getSupabaseClient();
                  const { data: { session } } = await supabase.auth.getSession();
                  fetch('/api/upload', {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
                    },
                    body: JSON.stringify({ url })
                  }).catch(console.error);
                  uploadedInSession.current.delete(url);
                }
                setValue(key, '', { shouldDirty: true });
              }}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Eliminar ${title}`}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-card transition-colors hover:border-primary hover:bg-primary/5">
            <HugeiconsIcon icon={CloudUploadIcon} size={32} strokeWidth={2} className="text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Subir imagen</span>
            <input 
              type="file" 
              className="hidden" 
              accept={acceptAttr}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file, key);
              }}
            />
          </label>
        )}
        <Field data-invalid={!!errors[key]}>
          <FieldLabel htmlFor={`img-url-${key}`} className="sr-only">
            URL de {title}
          </FieldLabel>
          <Input
            id={`img-url-${key}`}
            placeholder="O ingresa la URL de la imagen"
            aria-invalid={!!errors[key]}
            {...register(key)}
          />
          <FieldError errors={[errors[key]]} />
        </Field>
      </div>
    );
  };

  return (
    <Section
      title="Recursos de Imágenes"
      description="Sube los logos y favicons que se utilizarán en la interfaz y en los tickets generados."
    >
      <QueryState
        loading={loading}
        loadingFallback={<div className="flex py-12 justify-center"><BrandLoader text="Cargando recursos..." /></div>}
      >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {renderUploadBox("Logo estático", "Cabeceras y web. Recomendado: 512x512px (PNG transparente)", "logoStatic")}
          {renderUploadBox("Logo animado", "Animación principal. Recomendado: 512x512px (WebM/GIF)", "logoAnimated")}
          {renderUploadBox("Favicon", "Ícono de la pestaña. Recomendado: 32x32px o 64x64px (PNG/ICO)", "favicon")}
          {renderUploadBox("Logo del ticket", "Impresoras térmicas. Recomendado: 300x300px o similar (Blanco y Negro puro)", "posLogo")}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isSubmitting || uploading}>
            {isSubmitting ? (
              <Spinner className="mr-2" />
            ) : (
              <HugeiconsIcon icon={FloppyDiskIcon} size={16} strokeWidth={2} className="mr-2" />
            )}
            Guardar Imágenes
          </Button>
        </div>
      </form>
      </QueryState>
    </Section>
  );
}

// Las llaves de `pozos` son fijas (`pozosSchema`): se listan acá para que el
// formulario tipe cada campo en vez de recorrer el objeto con `any`.
const POZO_KEYS = [
  'publicidad',
  'mantenimiento',
  'utiles',
  'garantias',
  'prestamos',
  'suscripciones',
  'servicios',
] as const;

function FinanzasConfig() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FinancialConfig>({
    resolver: zodResolver(financialConfigSchema) as any,
  });

  const costoFUScale = useFieldArray({ control, name: 'costoFUScale' });
  const marginScale = useFieldArray({ control, name: 'marginScale' });
  const commissionScale = useFieldArray({ control, name: 'commissionScale' });
  const wholesaleDiscounts = useFieldArray({ control, name: 'wholesaleDiscounts' });

  useEffect(() => {
    const fetchConfig = async () => {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        // Obtenemos la configuración financiera actualizada
        const res = await fetch('/api/admin/config/financial', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        if (!res.ok) {
          // Fallback para no romper la app de inmediato, intentando con / si falló /financial (por si el backend no reinició)
          const res2 = await fetch('/api/admin/config', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });
          if (!res2.ok) {
            const text = await res2.text();
            throw new Error(`Error al cargar: ${res2.status} - ${text}`);
          }
          reset(await res2.json());
          return;
        }
        reset(await res.json());
      } catch (err: any) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [reset]);

  // La suma de los pozos ya la exige `financialConfigSchema.refine` con
  // `path: ['pozos']`: el error sale en la sección de Pozos, no como excepción.
  const onSubmit = async (values: FinancialConfig) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión');

      let res = await fetch('/api/admin/config/financial', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(values)
      });

      if (res.status === 404) {
         res = await fetch('/api/admin/config', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(values)
         });
      }

      const data = await res.json();
      if (!res.ok) {
        if (data.issues) {
          throw new Error(`Datos inválidos: ${data.issues.map((i: any) => i.message).join(', ')}`);
        }
        throw new Error(data.error || 'Error al guardar');
      }

      reset(data);
      toast.success('Configuración guardada correctamente.');
    } catch (err: any) {
      toast.error(err.message || 'No se pudo guardar la configuración.');
    }
  };

  // Mientras no llegue la config no hay formulario que mostrar: la sección
  // entera se resuelve por QueryState.
  if (loading || loadError) {
    return (
      <QueryState
        loading={loading}
        error={!!loadError}
        errorMessage={loadError || 'No se pudo cargar la configuración financiera.'}
        loadingFallback={<div className="flex h-40 items-center justify-center"><BrandLoader text="Cargando configuración..." /></div>}
      >
        {null}
      </QueryState>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-8">

        <Section title="Configuración General" description="Parámetros base que aplican a todos los módulos.">
          <div className="space-y-4">
            <Field data-invalid={!!errors.exchangeRate}>
              <FieldLabel htmlFor="cfg-exchange-rate" required>Tasa de Cambio (C$ por USD)</FieldLabel>
              <Input
                id="cfg-exchange-rate"
                type="number" step="0.01"
                className="max-w-xs"
                aria-required
                aria-invalid={!!errors.exchangeRate}
                {...register('exchangeRate', { valueAsNumber: true })}
              />
              <FieldError errors={[errors.exchangeRate]} />
            </Field>
            <Field data-invalid={!!errors.salaryPercentage}>
              <FieldLabel htmlFor="cfg-salary" required>Fondo de la Empresa (Salary %)</FieldLabel>
              <Input
                id="cfg-salary"
                type="number" step="0.01"
                className="max-w-xs"
                aria-required
                aria-invalid={!!errors.salaryPercentage}
                {...register('salaryPercentage', { valueAsNumber: true })}
              />
              <FieldDescription>Ejemplo: 0.20 para 20%</FieldDescription>
              <FieldError errors={[errors.salaryPercentage]} />
            </Field>
            <Field data-invalid={!!errors.minMarginMultiplier}>
              <FieldLabel htmlFor="cfg-min-margin" required>Margen de Precio Mínimo (Múltiplo)</FieldLabel>
              <Input
                id="cfg-min-margin"
                type="number" step="0.01"
                className="max-w-xs"
                aria-required
                aria-invalid={!!errors.minMarginMultiplier}
                {...register('minMarginMultiplier', { valueAsNumber: true })}
              />
              <FieldDescription>Ejemplo: 1.15 significa que no se puede vender a menos del 15% sobre el costo</FieldDescription>
              <FieldError errors={[errors.minMarginMultiplier]} />
            </Field>
          </div>
        </Section>

        <Section title="Distribución de Pozos" description="Los porcentajes asignados a cada fondo (deben sumar exactamente 1.00).">
          <div className="grid gap-4 md:grid-cols-3">
            {POZO_KEYS.map(key => (
              <Field key={key} data-invalid={!!errors.pozos?.[key]}>
                <FieldLabel htmlFor={`cfg-pozo-${key}`} className="capitalize" required>{key}</FieldLabel>
                <Input
                  id={`cfg-pozo-${key}`}
                  type="number" step="0.01"
                  aria-required
                  aria-invalid={!!errors.pozos?.[key]}
                  {...register(`pozos.${key}`, { valueAsNumber: true })}
                />
                <FieldError errors={[errors.pozos?.[key]]} />
              </Field>
            ))}
          </div>
          {/* La regla de "deben sumar 1.00" es del objeto entero, no de un pozo:
              su error vive en la raíz de `pozos`. */}
          <FieldError className="mt-3" errors={[errors.pozos]} />
        </Section>

        <Section title="Escala de Costo F/U" description="Escala escalonada por costo real (C$).">
          <div className="space-y-2">
            <FieldError errors={[errors.costoFUScale]} />
            {costoFUScale.fields.map((row, i) => (
              <div key={row.id} className="flex items-end gap-4">
                <CeilingField
                  control={control as any}
                  name={`costoFUScale.${i}.maxCost`}
                  id={`cfu-max-${row.id}`}
                  label="Costo Máximo (C$)"
                  error={errors.costoFUScale?.[i]?.maxCost}
                />
                <Field className="flex-1" data-invalid={!!errors.costoFUScale?.[i]?.amount}>
                  <FieldLabel htmlFor={`cfu-amount-${row.id}`} className="text-xs" required>Costo F/U (C$)</FieldLabel>
                  <Input
                    id={`cfu-amount-${row.id}`}
                    type="number"
                    aria-required
                    aria-invalid={!!errors.costoFUScale?.[i]?.amount}
                    {...register(`costoFUScale.${i}.amount`, { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.costoFUScale?.[i]?.amount]} />
                </Field>
                <Button
                  type="button" variant="outline" size="icon"
                  aria-label="Eliminar tramo"
                  className="text-destructive"
                  onClick={() => costoFUScale.remove(i)}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                </Button>
              </div>
            ))}
            <Button
              type="button" variant="outline" size="sm" className="mt-4"
              onClick={() => costoFUScale.append({ maxCost: null, amount: 0 })}
            >
              Agregar tramo
            </Button>
          </div>
        </Section>

        <Section title="Escala de Márgenes (PVP)" description="Márgenes de venta sugeridos basados en Coste Final (C$).">
          <div className="space-y-2">
            <FieldError errors={[errors.marginScale]} />
            {marginScale.fields.map((row, i) => (
              <div key={row.id} className="flex items-end gap-4">
                <CeilingField
                  control={control as any}
                  name={`marginScale.${i}.maxCost`}
                  id={`mar-max-${row.id}`}
                  label="Coste Máximo (C$)"
                  error={errors.marginScale?.[i]?.maxCost}
                />
                <Field className="flex-1" data-invalid={!!errors.marginScale?.[i]?.margin}>
                  <FieldLabel htmlFor={`mar-margin-${row.id}`} className="text-xs" required>Margen (ej. 0.43)</FieldLabel>
                  <Input
                    id={`mar-margin-${row.id}`}
                    type="number" step="0.01"
                    aria-required
                    aria-invalid={!!errors.marginScale?.[i]?.margin}
                    {...register(`marginScale.${i}.margin`, { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.marginScale?.[i]?.margin]} />
                </Field>
                <Button
                  type="button" variant="outline" size="icon"
                  aria-label="Eliminar tramo"
                  className="text-destructive"
                  onClick={() => marginScale.remove(i)}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                </Button>
              </div>
            ))}
            <Button
              type="button" variant="outline" size="sm" className="mt-4"
              onClick={() => marginScale.append({ maxCost: null, margin: 0 })}
            >
              Agregar tramo
            </Button>
          </div>
        </Section>

        <Section title="Escala de Comisiones" description="Comisión del vendedor basada en Utilidad Neta (C$).">
          <div className="space-y-2">
            <FieldError errors={[errors.commissionScale]} />
            {commissionScale.fields.map((row, i) => (
              <div key={row.id} className="flex items-end gap-4">
                <CeilingField
                  control={control as any}
                  name={`commissionScale.${i}.maxProfit`}
                  id={`com-max-${row.id}`}
                  label="Utilidad Neta Máxima (C$)"
                  error={errors.commissionScale?.[i]?.maxProfit}
                />
                <Field className="flex-1" data-invalid={!!errors.commissionScale?.[i]?.margin}>
                  <FieldLabel htmlFor={`com-margin-${row.id}`} className="text-xs" required>Comisión (ej. 0.40)</FieldLabel>
                  <Input
                    id={`com-margin-${row.id}`}
                    type="number" step="0.01"
                    aria-required
                    aria-invalid={!!errors.commissionScale?.[i]?.margin}
                    {...register(`commissionScale.${i}.margin`, { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.commissionScale?.[i]?.margin]} />
                </Field>
                <Button
                  type="button" variant="outline" size="icon"
                  aria-label="Eliminar tramo"
                  className="text-destructive"
                  onClick={() => commissionScale.remove(i)}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                </Button>
              </div>
            ))}
            <Button
              type="button" variant="outline" size="sm" className="mt-4"
              onClick={() => commissionScale.append({ maxProfit: null, margin: 0 })}
            >
              Agregar tramo
            </Button>
          </div>
        </Section>

        <Section title="Descuentos por Mayoreo" description="Descuentos automáticos en el cotizador por volumen.">
          <div className="space-y-2">
            <FieldError errors={[errors.wholesaleDiscounts]} />
            {wholesaleDiscounts.fields.map((row, i) => (
              <div key={row.id} className="flex items-end gap-4">
                <Field className="flex-1" data-invalid={!!errors.wholesaleDiscounts?.[i]?.minQty}>
                  <FieldLabel htmlFor={`whs-qty-${row.id}`} className="text-xs" required>Cantidad Mínima</FieldLabel>
                  <Input
                    id={`whs-qty-${row.id}`}
                    type="number"
                    aria-required
                    aria-invalid={!!errors.wholesaleDiscounts?.[i]?.minQty}
                    {...register(`wholesaleDiscounts.${i}.minQty`, { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.wholesaleDiscounts?.[i]?.minQty]} />
                </Field>
                <Field className="flex-1" data-invalid={!!errors.wholesaleDiscounts?.[i]?.discount}>
                  <FieldLabel htmlFor={`whs-disc-${row.id}`} className="text-xs" required>Descuento (ej. 0.15 para 15%)</FieldLabel>
                  <Input
                    id={`whs-disc-${row.id}`}
                    type="number" step="0.001"
                    aria-required
                    aria-invalid={!!errors.wholesaleDiscounts?.[i]?.discount}
                    {...register(`wholesaleDiscounts.${i}.discount`, { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.wholesaleDiscounts?.[i]?.discount]} />
                </Field>
                <Button
                  type="button" variant="outline" size="icon"
                  aria-label="Eliminar tramo"
                  className="text-destructive"
                  onClick={() => wholesaleDiscounts.remove(i)}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                </Button>
              </div>
            ))}
            <Button
              type="button" variant="outline" size="sm" className="mt-4"
              onClick={() => wholesaleDiscounts.append({ minQty: 2, discount: 0 })}
            >
              Agregar tramo
            </Button>
          </div>
        </Section>

        <div className="sticky bottom-4 mt-8 flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="shadow-lg">
            {isSubmitting && <Spinner className="mr-2" />}
            Guardar Configuración Financiera
          </Button>
        </div>
      </form>
    </div>
  );
}

// El techo de un tramo admite "sin techo" (null → placeholder «Infinito»), así
// que no puede ir por `register` con `valueAsNumber` (un campo vacío daría NaN,
// no null). Es el único campo de las escalas que necesita Controller.
function CeilingField({
  control,
  name,
  id,
  label,
  error,
}: {
  control: Control<FinancialConfig>;
  name: FieldPath<FinancialConfig>;
  id: string;
  label: string;
  error?: { message?: string };
}) {
  return (
    <Field className="flex-1" data-invalid={!!error}>
      <FieldLabel htmlFor={id} className="text-xs">{label}</FieldLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={id}
            type="number"
            placeholder="Infinito"
            aria-invalid={!!error}
            value={field.value === null || field.value === undefined ? '' : String(field.value)}
            onBlur={field.onBlur}
            onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          />
        )}
      />
      <FieldError errors={[error]} />
    </Field>
  );
}

function GeneralConfig() {
  return (
    <div className="space-y-6">
      <Section title="Información del Negocio" description="Datos generales de contacto y operación de la tienda.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre de la Tienda</Label>
              <Input defaultValue="Gyro Store" />
            </div>
            <div className="space-y-2">
              <Label>Número RUC</Label>
              <Input placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono Principal (WhatsApp)</Label>
              <Input defaultValue="+505 " />
            </div>
            <div className="space-y-2">
              <Label>Correo de Contacto</Label>
              <Input type="email" placeholder="contacto@gyrostore.com" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección Física</Label>
              <Input defaultValue="Managua, Nicaragua" />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button className="shadow-sm">
              <HugeiconsIcon icon={FloppyDiskIcon} size={16} strokeWidth={2} className="mr-2" />
              Guardar General
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

export default function AdminConfiguracion() {
  const [currentTab, setCurrentTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'variables', label: 'Variables' },
    { id: 'recursos', label: 'Recursos' },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-20 pt-4 animate-in fade-in zoom-in-95 duration-200">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Parámetros del negocio editables desde la UI.</p>
      </div>

      <AnimatedTabs
        items={tabs}
        value={currentTab}
        onChange={setCurrentTab}
        layoutId="config-tabs"
      />
      
      <div className="mt-6">
        {currentTab === 'general' && <GeneralConfig />}
        {currentTab === 'variables' && <FinanzasConfig />}
        {currentTab === 'recursos' && <ImagesConfig />}
      </div>
    </div>
  );
}
