// Pestaña "Recursos" de Configuración: subida de logos/favicon a R2 (extraída de
// admin.configuracion.tsx). Maneja su propia carga/guardado contra
// /api/admin/config/images y limpia los uploads huérfanos de la sesión.
import { AnimatedIcon } from "~/components/ui/animated-icons";
import { Cancel01Icon, CloudUploadIcon, FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { getSupabaseClient } from "~/lib/supabase.client";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { imageResourcesSchema, type ImageResources } from "@shared/schemas";
import { BrandLoader } from "~/components/ui/module-loader";
import { QueryState } from "~/components/ui/QueryState";
import { useAppDispatch } from "~/store/hooks";
import { configApi } from "~/store/api/sessionApi";
import { Section } from "./Section";

const EMPTY_IMAGES: ImageResources = {
  logoStatic: '',
  logoAnimated: '',
  favicon: '',
  posLogo: '',
};

export function ImagesConfig() {
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
              <AnimatedIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-card transition-colors hover:border-primary hover:bg-primary/5">
            <AnimatedIcon icon={CloudUploadIcon} size={32} strokeWidth={2} className="text-muted-foreground" />
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
              <AnimatedIcon icon={FloppyDiskIcon} size={16} strokeWidth={2} className="mr-2" />
            )}
            Guardar Imágenes
          </Button>
        </div>
      </form>
      </QueryState>
    </Section>
  );
}
