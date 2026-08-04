// Pestaña "General" de Configuración: información del negocio (nombre, RUC,
// WhatsApp, correo, dirección). Carga y guarda contra /api/admin/config/business.
// El valor inicial se siembra desde las env vars; una vez guardado, manda la BD.
// Mismo patrón que ImagesConfig/FinanzasConfig (fetch con el token de Supabase).
import { AnimatedIcon } from "~/components/ui/animated-icons";
import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { getSupabaseClient } from "~/lib/supabase.client";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { businessInfoSchema, type BusinessInfo } from "@shared/schemas";
import { BrandLoader } from "~/components/ui/module-loader";
import { QueryState } from "~/components/ui/QueryState";
import { useAppDispatch } from "~/store/hooks";
import { configApi } from "~/store/api/sessionApi";
import { Section } from "./Section";

export function GeneralConfig() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const dispatch = useAppDispatch();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BusinessInfo>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: { brandName: "", ruc: "", whatsapp: "", contactEmail: "", address: "" },
  });

  useEffect(() => {
    const fetchBusiness = async () => {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const res = await fetch("/api/admin/config/business", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error("Error al cargar la información del negocio");
        reset(await res.json());
      } catch (err: any) {
        setLoadError(err.message || "No se pudo cargar la información del negocio.");
      } finally {
        setLoading(false);
      }
    };
    fetchBusiness();
  }, [reset]);

  const onSubmit = async (values: BusinessInfo) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión");

      const res = await fetch("/api/admin/config/business", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.issues) {
          throw new Error(`Datos inválidos: ${data.issues.map((i: any) => i.message).join(", ")}`);
        }
        throw new Error(data.error || "Error al guardar");
      }

      reset(data);
      // El storefront lee estos datos vía /api/config: invalidamos para que el
      // nombre/WhatsApp/etc. se refresquen sin recargar.
      dispatch(configApi.util.invalidateTags(["Config"]));
      toast.success("Información del negocio guardada correctamente.");
    } catch (err: any) {
      toast.error(err.message || "No se pudo guardar la información.");
    }
  };

  if (loading || loadError) {
    return (
      <QueryState
        loading={loading}
        error={!!loadError}
        errorMessage={loadError || "No se pudo cargar la información del negocio."}
        loadingFallback={<div className="flex h-40 items-center justify-center"><BrandLoader text="Cargando información..." /></div>}
      >
        {null}
      </QueryState>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Section title="Información del Negocio" description="Datos generales de contacto y operación de la tienda. Se usan en la tienda, tickets y facturas.">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.brandName}>
                <FieldLabel htmlFor="biz-brand" required>Nombre de la Tienda</FieldLabel>
                <Input id="biz-brand" aria-required aria-invalid={!!errors.brandName} {...register("brandName")} />
                <FieldError errors={[errors.brandName]} />
              </Field>
              <Field data-invalid={!!errors.ruc}>
                <FieldLabel htmlFor="biz-ruc">Número RUC</FieldLabel>
                <Input id="biz-ruc" placeholder="Opcional" aria-invalid={!!errors.ruc} {...register("ruc")} />
                <FieldError errors={[errors.ruc]} />
              </Field>
              <Field data-invalid={!!errors.whatsapp}>
                <FieldLabel htmlFor="biz-whatsapp" required>Teléfono Principal (WhatsApp)</FieldLabel>
                <Input id="biz-whatsapp" placeholder="50588887777" aria-required aria-invalid={!!errors.whatsapp} {...register("whatsapp")} />
                <FieldError errors={[errors.whatsapp]} />
              </Field>
              <Field data-invalid={!!errors.contactEmail}>
                <FieldLabel htmlFor="biz-email">Correo de Contacto</FieldLabel>
                <Input id="biz-email" type="email" placeholder="contacto@empresa.com" aria-invalid={!!errors.contactEmail} {...register("contactEmail")} />
                <FieldError errors={[errors.contactEmail]} />
              </Field>
              <div className="sm:col-span-2">
                <Field data-invalid={!!errors.address}>
                  <FieldLabel htmlFor="biz-address">Dirección Física</FieldLabel>
                  <Input id="biz-address" placeholder="Ciudad, país" aria-invalid={!!errors.address} {...register("address")} />
                  <FieldError errors={[errors.address]} />
                </Field>
              </div>
            </div>
          </div>
        </Section>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="shadow-sm">
            {isSubmitting ? <Spinner className="mr-2" /> : <AnimatedIcon icon={FloppyDiskIcon} size={16} strokeWidth={2} className="mr-2" />}
            Guardar General
          </Button>
        </div>
      </form>
    </div>
  );
}
