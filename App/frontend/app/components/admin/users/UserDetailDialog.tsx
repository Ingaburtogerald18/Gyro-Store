// Diálogo de detalle del empleado con tabs Editar / Rendimiento (extraído de
// admin.usuarios.tsx). Encapsula el formulario de perfil (react-hook-form +
// updateProfileSchema), la mutation de actualización y las acciones de rol /
// baja / restauración. Controlado por `user`.
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatedIcon } from "~/components/ui/animated-icons";
import { RefreshIcon, UserRemove01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import {
  useUpdateUserProfileMutation,
  type AppRole,
  type UserProfile,
} from "~/store/api/usersApi";
import {
  PAYOUT_BANKS,
  PAYOUT_BANK_LABELS,
  PAYOUT_CURRENCIES,
  PAYOUT_CURRENCY_LABELS,
  updateProfileSchema,
  type UpdateProfileInput,
} from "@shared/schemas";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Input } from "~/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ROLE_LABELS, isProtectedUser, getInitials, EMPTY_PROFILE_FORM } from "./constants";
import { useUserActions } from "./useUserActions";
import { PerformanceTab } from "./PerformanceTab";

export function UserDetailDialog({
  user,
  initialTab,
  onClose,
}: {
  user: UserProfile | null;
  initialTab: "editar" | "rendimiento";
  onClose: () => void;
}) {
  const [updateProfile, { isLoading: isUpdatingProfile }] = useUpdateUserProfileMutation();
  const { changeRole, suspend, restore } = useUserActions();
  const [detailTab, setDetailTab] = useState<string>(initialTab);

  // ── Formulario de edición de perfil ──
  // La validación sale de `updateProfileSchema` (App/shared/schemas.ts), el
  // mismo contrato que aplica el backend: la regla de Ficohsa se evalúa acá y
  // allá, así que un request fuera del panel tampoco la puede saltar.
  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: EMPTY_PROFILE_FORM,
  });
  const {
    control: profileControl,
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    watch: watchProfile,
    setValue: setProfileValue,
    formState: { errors: profileErrors },
  } = profileForm;

  // Al abrir con un usuario nuevo, sincroniza el tab pedido y el formulario.
  useEffect(() => {
    if (user) setDetailTab(initialTab);
  }, [user, initialTab]);

  useEffect(() => {
    resetProfile(
      user
        ? {
            name: user.name ?? "",
            phone: user.phone ?? "",
            personal_email: user.personal_email ?? "",
            bank_account: user.bank_account ?? null,
          }
        : EMPTY_PROFILE_FORM,
    );
  }, [user, resetProfile]);

  // Ficohsa solo opera cuentas en dólares: al elegirlo se fuerza la moneda y se
  // deshabilita Córdobas. El schema lo respalda del lado del servidor.
  const selectedBank = watchProfile("bank_account.bank");
  const bankAccount = watchProfile("bank_account");
  const isFicohsa = selectedBank === "ficohsa";

  useEffect(() => {
    if (isFicohsa) {
      setProfileValue("bank_account.currency", "USD", { shouldValidate: true });
    }
  }, [isFicohsa, setProfileValue]);

  const handleSaveProfile = handleProfileSubmit(async (values) => {
    if (!user) return;
    try {
      await updateProfile({
        id: user.id,
        name: values.name,
        phone: values.phone,
        personal_email: values.personal_email,
        // El schema ya normalizó la cuenta; `undefined` y `null` significan lo
        // mismo acá: limpiar lo guardado.
        bank_account: values.bank_account ?? null,
      }).unwrap();
      toast.success("Perfil actualizado correctamente");
      onClose();
    } catch (error: any) {
      toast.error(error?.data?.error || "Error al actualizar el perfil");
    }
  });

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      {/* El formulario es más alto que la ventana: el diálogo scrollea SOLO
          en el cuerpo y el pie con «Guardar» queda fijo. Con el scroll en el
          contenedor entero había que bajar hasta el final para encontrarlo —
          y si la ventana era baja, no se alcanzaba nunca. */}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-14">
          <DialogTitle>Información del Empleado</DialogTitle>
          <DialogDescription>
            Consulta y edita los datos del empleado o revisa su rendimiento de ventas.
          </DialogDescription>
        </DialogHeader>

        {user && (
          <Tabs
            value={detailTab}
            onValueChange={setDetailTab}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="shrink-0 px-6 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="editar" className="flex-1">
                  Editar
                </TabsTrigger>
                <TabsTrigger value="rendimiento" className="flex-1">
                  Rendimiento
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Tab Editar ── */}
            <TabsContent value="editar" className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
                {/* Avatar centrado */}
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="size-20">
                    <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} referrerPolicy="no-referrer" />
                    <AvatarFallback className="font-heading text-2xl font-bold uppercase">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-heading text-sm font-semibold text-foreground">
                    {user.name}
                  </span>
                </div>

                {/* Campos */}
                <div className="grid gap-4">
                  <Field data-invalid={!!profileErrors.name}>
                    <FieldLabel htmlFor="edit-display-name" required>
                      Display Name
                    </FieldLabel>
                    <Input
                      id="edit-display-name"
                      aria-required
                      aria-invalid={!!profileErrors.name}
                      {...registerProfile("name")}
                    />
                    <FieldError errors={[profileErrors.name]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-correo">Correo Corporativo</FieldLabel>
                    <Input
                      id="edit-correo"
                      type="email"
                      value={user.email}
                      disabled
                      readOnly
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      El correo está vinculado a Microsoft Entra ID y no se puede modificar.
                    </p>
                  </Field>
                  <Field>
                    <FieldLabel>Rol Principal</FieldLabel>
                    <Select
                      value={user.roles[0] || "seller"}
                      onValueChange={(v) => changeRole(user, v as AppRole)}
                      disabled={isProtectedUser(user)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field data-invalid={!!profileErrors.personal_email}>
                    <FieldLabel htmlFor="edit-personal-email">Correo Personal</FieldLabel>
                    <Input
                      id="edit-personal-email"
                      type="email"
                      placeholder="usuario@gmail.com"
                      aria-invalid={!!profileErrors.personal_email}
                      {...registerProfile("personal_email")}
                    />
                    <FieldError errors={[profileErrors.personal_email]} />
                  </Field>

                  <Field data-invalid={!!profileErrors.phone}>
                    <FieldLabel htmlFor="edit-phone">Número de Teléfono</FieldLabel>
                    <Input
                      id="edit-phone"
                      placeholder="+505 0000 0000"
                      aria-invalid={!!profileErrors.phone}
                      {...registerProfile("phone")}
                    />
                    <FieldError errors={[profileErrors.phone]} />
                  </Field>

                  {/* ── Cuenta bancaria (pagos) ── */}
                  <fieldset className="grid gap-4 rounded-card border bg-muted/40 p-3">
                    <legend className="px-1 text-xs font-semibold text-foreground">
                      Cuenta bancaria (pagos)
                    </legend>

                    <Field data-invalid={!!profileErrors.bank_account?.bank}>
                      <FieldLabel htmlFor="edit-bank">Banco</FieldLabel>
                      <Controller
                        control={profileControl}
                        name="bank_account.bank"
                        render={({ field }) => (
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(v) => {
                              field.onChange(v);
                              // Primera vez que se elige banco: la cuenta pasa
                              // de null a objeto, así que hay que sembrar la
                              // moneda o quedaría `undefined` y el schema la
                              // rechazaría sin decir por qué.
                              if (!bankAccount?.currency) {
                                setProfileValue(
                                  "bank_account.currency",
                                  v === "ficohsa" ? "USD" : "NIO",
                                );
                              }
                            }}
                          >
                            <SelectTrigger id="edit-bank">
                              <SelectValue placeholder="Elegí el banco" />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYOUT_BANKS.map((b) => (
                                <SelectItem key={b} value={b}>
                                  {PAYOUT_BANK_LABELS[b]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <FieldError errors={[profileErrors.bank_account?.bank]} />
                    </Field>

                    <Field data-invalid={!!profileErrors.bank_account?.currency}>
                      <FieldLabel htmlFor="edit-currency">Moneda</FieldLabel>
                      <Controller
                        control={profileControl}
                        name="bank_account.currency"
                        render={({ field }) => (
                          <Select value={field.value ?? ""} onValueChange={field.onChange}>
                            <SelectTrigger id="edit-currency">
                              <SelectValue placeholder="Elegí la moneda" />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYOUT_CURRENCIES.map((c) => (
                                <SelectItem
                                  key={c}
                                  value={c}
                                  // Ficohsa no maneja córdobas: la opción se
                                  // deshabilita en vez de dejar elegirla y
                                  // fallar después.
                                  disabled={isFicohsa && c !== "USD"}
                                >
                                  {PAYOUT_CURRENCY_LABELS[c]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {isFicohsa && (
                        <FieldDescription>
                          Ficohsa solo maneja cuentas en dólares.
                        </FieldDescription>
                      )}
                      <FieldError errors={[profileErrors.bank_account?.currency]} />
                    </Field>

                    <Field data-invalid={!!profileErrors.bank_account?.number}>
                      <FieldLabel htmlFor="edit-account-number">Número de cuenta</FieldLabel>
                      <Input
                        id="edit-account-number"
                        inputMode="numeric"
                        placeholder="1234567890"
                        aria-invalid={!!profileErrors.bank_account?.number}
                        {...registerProfile("bank_account.number")}
                      />
                      <FieldError errors={[profileErrors.bank_account?.number]} />
                    </Field>

                    {bankAccount?.bank && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="justify-self-start text-muted-foreground"
                        onClick={() =>
                          setProfileValue("bank_account", null, { shouldValidate: true })
                        }
                      >
                        Quitar cuenta bancaria
                      </Button>
                    )}
                  </fieldset>
                </div>
              </div>

              {/* Pie FIJO: fuera del área que scrollea, para que «Guardar»
                  esté siempre a la vista sin importar cuánto crezca el form. */}
              <div className="flex shrink-0 flex-col gap-2 border-t border-border px-6 py-4">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={handleSaveProfile}
                    disabled={isUpdatingProfile}
                  >
                    <AnimatedIcon
                      icon={RefreshIcon}
                      size={16}
                      strokeWidth={2}
                      className={`mr-2 ${isUpdatingProfile ? "animate-spin" : ""}`}
                      aria-hidden
                    />
                    {isUpdatingProfile ? "Guardando..." : "Guardar Cambios"}
                  </Button>

                  {!user.deleted_at ? (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        suspend(user);
                        onClose();
                      }}
                      disabled={isProtectedUser(user)}
                    >
                      <AnimatedIcon icon={UserRemove01Icon} size={16} strokeWidth={2} className="mr-2" aria-hidden />
                      Archivar (Dar de baja)
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full border-primary/50 text-primary hover:bg-primary/10"
                      onClick={() => {
                        restore(user);
                        onClose();
                      }}
                    >
                      <AnimatedIcon icon={RefreshIcon} size={16} strokeWidth={2} className="mr-2" aria-hidden />
                      Restaurar Usuario
                    </Button>
                  )}
                </div>
            </TabsContent>

            {/* ── Tab Rendimiento ── */}
            <TabsContent
              value="rendimiento"
              className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
            >
              {detailTab === "rendimiento" && <PerformanceTab userId={user.id} />}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
