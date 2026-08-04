// Pestaña "Categorías" de Configuración: los chips de filtro del landing (id,
// nombre e ícono emoji). Carga y guarda contra /api/admin/config/categories.
// Mismo patrón que ImagesConfig/FinanzasConfig (fetch con el token de Supabase).
import { AnimatedIcon } from "~/components/ui/animated-icons";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { getSupabaseClient } from "~/lib/supabase.client";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { storeCategoriesSchema } from "@shared/schemas";
import { BrandLoader } from "~/components/ui/module-loader";
import { QueryState } from "~/components/ui/QueryState";
import { useAppDispatch } from "~/store/hooks";
import { configApi } from "~/store/api/sessionApi";
import { Section } from "./Section";

// El formulario envuelve el array en un objeto para poder usar useFieldArray.
const formSchema = z.object({ categories: storeCategoriesSchema });
type FormValues = z.infer<typeof formSchema>;

export function CategoriesConfig() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const dispatch = useAppDispatch();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { categories: [] },
  });

  const categories = useFieldArray({ control, name: "categories" });

  useEffect(() => {
    const fetchCategories = async () => {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const res = await fetch("/api/admin/config/categories", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error("Error al cargar las categorías");
        reset({ categories: await res.json() });
      } catch (err: any) {
        setLoadError(err.message || "No se pudieron cargar las categorías.");
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, [reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión");

      const res = await fetch("/api/admin/config/categories", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(values.categories),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.issues) {
          throw new Error(`Datos inválidos: ${data.issues.map((i: any) => i.message).join(", ")}`);
        }
        throw new Error(data.error || "Error al guardar");
      }

      reset({ categories: data });
      // El storefront lee las categorías vía /api/config: invalidamos para que los
      // chips del landing se refresquen sin recargar.
      dispatch(configApi.util.invalidateTags(["Config"]));
      toast.success("Categorías guardadas correctamente.");
    } catch (err: any) {
      toast.error(err.message || "No se pudieron guardar las categorías.");
    }
  };

  if (loading || loadError) {
    return (
      <QueryState
        loading={loading}
        error={!!loadError}
        errorMessage={loadError || "No se pudieron cargar las categorías."}
        loadingFallback={<div className="flex h-40 items-center justify-center"><BrandLoader text="Cargando categorías..." /></div>}
      >
        {null}
      </QueryState>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Section
          title="Categorías del Catálogo"
          description="Los chips de filtro que aparecen en la tienda. El id es interno (sin espacios) y no debería cambiar una vez publicado."
        >
          <div className="space-y-3">
            <FieldError errors={[errors.categories as any]} />
            {categories.fields.map((row, i) => (
              <div key={row.id} className="flex items-end gap-3">
                <Field className="w-16 shrink-0" data-invalid={!!errors.categories?.[i]?.icon}>
                  <FieldLabel htmlFor={`cat-icon-${row.id}`} className="text-xs">Ícono</FieldLabel>
                  <Input
                    id={`cat-icon-${row.id}`}
                    className="text-center"
                    placeholder="🎧"
                    aria-invalid={!!errors.categories?.[i]?.icon}
                    {...register(`categories.${i}.icon`)}
                  />
                  <FieldError errors={[errors.categories?.[i]?.icon]} />
                </Field>
                <Field className="w-40 shrink-0" data-invalid={!!errors.categories?.[i]?.id}>
                  <FieldLabel htmlFor={`cat-id-${row.id}`} className="text-xs" required>Id interno</FieldLabel>
                  <Input
                    id={`cat-id-${row.id}`}
                    placeholder="audifonos-kz"
                    aria-required
                    aria-invalid={!!errors.categories?.[i]?.id}
                    {...register(`categories.${i}.id`)}
                  />
                  <FieldError errors={[errors.categories?.[i]?.id]} />
                </Field>
                <Field className="flex-1" data-invalid={!!errors.categories?.[i]?.name}>
                  <FieldLabel htmlFor={`cat-name-${row.id}`} className="text-xs" required>Nombre visible</FieldLabel>
                  <Input
                    id={`cat-name-${row.id}`}
                    placeholder="Audífonos KZ in-ear"
                    aria-required
                    aria-invalid={!!errors.categories?.[i]?.name}
                    {...register(`categories.${i}.name`)}
                  />
                  <FieldError errors={[errors.categories?.[i]?.name]} />
                </Field>
                <Button
                  type="button" variant="outline" size="icon"
                  aria-label="Eliminar categoría"
                  className="text-destructive"
                  onClick={() => categories.remove(i)}
                >
                  <AnimatedIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                </Button>
              </div>
            ))}
            <Button
              type="button" variant="outline" size="sm" className="mt-4"
              onClick={() => categories.append({ id: "", name: "", icon: "" })}
            >
              Agregar categoría
            </Button>
          </div>
        </Section>

        <div className="sticky bottom-4 mt-8 flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="shadow-lg">
            {isSubmitting && <Spinner className="mr-2" />}
            Guardar Categorías
          </Button>
        </div>
      </form>
    </div>
  );
}
