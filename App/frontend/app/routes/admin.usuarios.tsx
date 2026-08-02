import { AnimatedIcon } from "~/components/ui/animated-icons";
import {
  Delete02Icon,
  MoreVerticalIcon,
  PieChartIcon,
  RefreshIcon,
  Shield01Icon,
  UserAdd01Icon,
  UserRemove01Icon,
  UserSettings01Icon,
} from "@hugeicons/core-free-icons";
import { useState, useMemo, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { MetaFunction } from "@remix-run/node";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import {
  useGetUsersQuery,
  useUpdateUserRolesMutation,
  useCreateUserMutation,
  useDeleteUserMutation,
  useSuspendUserMutation,
  useRestoreUserMutation,
  useUpdateUserProfileMutation,
  useGetUserPerformanceQuery,
  type AppRole,
  type UserProfile,
} from "~/store/api/usersApi";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";
import {
  PAYOUT_BANKS,
  PAYOUT_BANK_LABELS,
  PAYOUT_CURRENCIES,
  PAYOUT_CURRENCY_LABELS,
  updateProfileSchema,
  type UpdateProfileInput,
} from "@shared/schemas";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { StatusBadge } from "~/components/ui/StatusBadge";
import { PageHeader } from "~/components/layout/PageHeader";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { StatCard } from "~/components/ui/stat-card";
import { QueryState } from "~/components/ui/QueryState";
import { BrandLoader } from "~/components/ui/module-loader";
import { formatCordobas } from "~/lib/formatters";

export const meta: MetaFunction = () => {
  return [{ title: "Personal | Gyro Store Admin" }];
};

const ROLE_LABELS: Record<AppRole, string> = {
  global_admin: "Global Admin",
  admin: "Admin",
  seller: "Vendedor",
  cashier: "Cajero",
  logistics_admin: "Logística (Admin)",
  logistics_customer: "Logística (Lectura)",
};

const isProtectedUser = (user: UserProfile) => user.isProtected === true;

// Formulario vacío del modal de edición. `bank_account` arranca en null: un
// empleado sin cuenta cargada no debe mostrar un banco elegido por defecto.
const EMPTY_PROFILE_FORM: UpdateProfileInput = {
  name: "",
  phone: "",
  personal_email: "",
  bank_account: null,
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Card del usuario ──
function UserCard({
  user,
  isAdmin,
  onEdit,
  onPerformance,
  onSuspend,
  onRestore,
  onDelete,
  onChangeRole,
}: {
  user: UserProfile;
  isAdmin: boolean;
  onEdit: () => void;
  onPerformance: () => void;
  onSuspend: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onChangeRole: (role: AppRole) => void;
}) {
  const isDeleted = !!user.deleted_at;
  const isProtected = isProtectedUser(user);
  const role = user.roles[0] || "seller";

  return (
    <div className="flex flex-col gap-4 rounded-card border bg-card p-4 shadow-sm">
      {/* Cabecera: avatar + info */}
      <div className="flex items-start gap-3">
        <Avatar size="lg">
          <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} referrerPolicy="no-referrer" />
          <AvatarFallback className="font-heading text-sm font-bold uppercase">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-heading text-sm font-semibold text-foreground">
              {user.name}
            </span>
            {isProtected && (
              <AnimatedIcon
                icon={Shield01Icon}
                size={14}
                strokeWidth={2}
                className="shrink-0 text-warning"
                aria-label="Protegido por el sistema"
              />
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* Badges: rol + estado */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {ROLE_LABELS[role as AppRole] || role}
        </Badge>
        {isDeleted ? (
          <StatusBadge status="error" label="De Baja" />
        ) : (
          <StatusBadge status="success" label="Activo" pulse />
        )}
      </div>

      {/* Acciones */}
      {isAdmin && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1 gap-1.5"
          >
            <AnimatedIcon icon={UserSettings01Icon} size={16} strokeWidth={2} aria-hidden />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onPerformance}
            className="flex-1 gap-1.5"
          >
            <AnimatedIcon icon={PieChartIcon} size={16} strokeWidth={2} aria-hidden />
            Rendimiento
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <AnimatedIcon icon={MoreVerticalIcon} size={16} strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rol
              </div>
              {Object.entries(ROLE_LABELS).map(([roleKey, label]) => (
                <DropdownMenuItem
                  key={roleKey}
                  onClick={() => onChangeRole(roleKey as AppRole)}
                  className="cursor-pointer"
                >
                  {label}
                </DropdownMenuItem>
              ))}
              {!isDeleted ? (
                <>
                  {!isProtected && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <DropdownMenuItem
                        onClick={onSuspend}
                        className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <AnimatedIcon icon={UserRemove01Icon} size={16} strokeWidth={2} className="mr-2" />
                        Dar de baja
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="my-1 h-px bg-border" />
                  <DropdownMenuItem
                    onClick={onRestore}
                    className="cursor-pointer text-primary focus:bg-primary/10 focus:text-primary"
                  >
                    <AnimatedIcon icon={RefreshIcon} size={16} strokeWidth={2} className="mr-2" />
                    Restaurar
                  </DropdownMenuItem>
                  {!isProtected && (
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <AnimatedIcon icon={Delete02Icon} size={16} strokeWidth={2} className="mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ── Tab de rendimiento ──
function PerformanceTab({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useGetUserPerformanceQuery(userId);

  return (
    <QueryState
      loading={isLoading}
      error={isError}
      empty={!data}
      loadingFallback={
        <div className="flex justify-center p-8">
          <BrandLoader text="Cargando rendimiento..." />
        </div>
      }
      emptyFallback={
        <div className="p-8 text-center text-muted-foreground">
          <AnimatedIcon icon={PieChartIcon} size={32} strokeWidth={2} className="mx-auto mb-2 opacity-50" aria-hidden />
          Sin datos de rendimiento disponibles.
        </div>
      }
    >
      {data && (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <StatCard
            label="Pendientes"
            color="amber"
            countTo={data.pendingApproval.comision}
            format={(n) => formatCordobas(n, "C$", 2)}
            sub={`${data.pendingApproval.count} ventas`}
            hint="Comisión de ventas pendientes de aprobación"
            delay={0}
          />
          <StatCard
            label="Aprobadas"
            color="emerald"
            countTo={data.approvedUnpaid.comision}
            format={(n) => formatCordobas(n, "C$", 2)}
            sub={`${data.approvedUnpaid.count} ventas`}
            hint="Comisión de ventas aprobadas sin pagar"
            delay={0.05}
          />
          <StatCard
            label="Pagadas"
            color="sky"
            countTo={data.paid.comision}
            format={(n) => formatCordobas(n, "C$", 2)}
            sub={`${data.paid.count} ventas`}
            hint="Comisión de ventas ya pagadas"
            delay={0.1}
          />
          <StatCard
            label="Balance"
            color="indigo"
            countTo={data.balance}
            format={(n) => formatCordobas(n, "C$", 2)}
            hint="Ajustes pendientes de liquidar en el próximo corte"
            delay={0.15}
          />
        </div>
      )}
    </QueryState>
  );
}

// ── Componente principal ──
export default function AdminUsuarios() {
  const { data: users = [], isLoading, isError } = useGetUsersQuery();
  const [updateRoles] = useUpdateUserRolesMutation();
  const [suspendUser] = useSuspendUserMutation();
  const [restoreUser] = useRestoreUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [updateProfile, { isLoading: isUpdatingProfile }] = useUpdateUserProfileMutation();
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();

  const isAdmin = useAppSelector(selectIsAdmin);
  const reduceMotion = useReducedMotion();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [detailTab, setDetailTab] = useState("editar");

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("seller");
  const [currentTab, setCurrentTab] = useState("activos");

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

  useEffect(() => {
    resetProfile(
      selectedUser
        ? {
            name: selectedUser.name ?? "",
            phone: selectedUser.phone ?? "",
            personal_email: selectedUser.personal_email ?? "",
            bank_account: selectedUser.bank_account ?? null,
          }
        : EMPTY_PROFILE_FORM,
    );
  }, [selectedUser, resetProfile]);

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

  // ── Handlers ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.endsWith("@gyrostorenic.com")) {
      toast.error("El correo debe pertenecer al dominio @gyrostorenic.com");
      return;
    }
    try {
      await createUser({ email: newEmail, name: newName, roles: [newRole] }).unwrap();
      toast.success(`Usuario ${newName} pre-creado exitosamente.`);
      setCreateDialogOpen(false);
      setNewName("");
      setNewEmail("");
      setNewRole("seller");
    } catch (error: any) {
      toast.error(error?.data?.error || "No se pudo crear el usuario.");
    }
  };

  const handleChangeRole = async (user: UserProfile, newRole: AppRole) => {
    if (isProtectedUser(user)) {
      toast.error("Operación denegada: Este usuario está protegido por el sistema.");
      return;
    }
    try {
      await updateRoles({ email: user.email, roles: [newRole] }).unwrap();
      toast.success(`Rol actualizado a ${ROLE_LABELS[newRole]}`);
    } catch (error: any) {
      toast.error(error?.data?.error || `Error al actualizar el rol de ${user.name}`);
    }
  };

  const handleSuspend = async (user: UserProfile) => {
    if (isProtectedUser(user)) {
      toast.error("Operación denegada: Este usuario está protegido por el sistema.");
      return;
    }
    try {
      await suspendUser(user.id).unwrap();
      toast.success(`${user.name} ha sido dado de baja.`);
    } catch (error: any) {
      toast.error(error?.data?.error || `Error al dar de baja a ${user.name}`);
    }
  };

  const handleRestore = async (user: UserProfile) => {
    try {
      await restoreUser(user.id).unwrap();
      toast.success(`${user.name} ha sido restaurado y ahora está activo.`);
    } catch (error: any) {
      toast.error(error?.data?.error || `Error al restaurar a ${user.name}`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    const user = userToDelete;
    if (isProtectedUser(user)) {
      toast.error("Operación denegada: Este usuario está protegido por el sistema.");
      setUserToDelete(null);
      setDeleteDialogOpen(false);
      return;
    }
    try {
      await deleteUser(user.id).unwrap();
      toast.success(`${user.name} ha sido borrado de la base de datos.`);
    } catch (error: any) {
      toast.error(error?.data?.error || `Error al borrar a ${user.name}`);
    } finally {
      setUserToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleSaveProfile = handleProfileSubmit(async (values) => {
    if (!selectedUser) return;
    try {
      await updateProfile({
        id: selectedUser.id,
        name: values.name,
        phone: values.phone,
        personal_email: values.personal_email,
        // El schema ya normalizó la cuenta; `undefined` y `null` significan lo
        // mismo acá: limpiar lo guardado.
        bank_account: values.bank_account ?? null,
      }).unwrap();
      toast.success("Perfil actualizado correctamente");
      setSelectedUser(null);
    } catch (error: any) {
      toast.error(error?.data?.error || "Error al actualizar el perfil");
    }
  });

  function openDetail(user: UserProfile, tab: "editar" | "rendimiento") {
    setSelectedUser(user);
    setDetailTab(tab);
  }

  const activeUsers = useMemo(() => users.filter((u) => !u.deleted_at), [users]);
  const deletedUsers = useMemo(() => users.filter((u) => u.deleted_at), [users]);
  const displayedUsers = currentTab === "activos" ? activeUsers : deletedUsers;

  const tabs = [
    { id: "activos", label: "Personal Activo" },
    { id: "inactivos", label: "Papelera (Inactivos)" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Análisis y sistema"
        title="Gestión de Personal"
        description="Administra los roles y el acceso del equipo a Gyro Store."
        actions={
        isAdmin ? (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default">
                <AnimatedIcon icon={UserAdd01Icon} size={16} strokeWidth={2} className="mr-2" />
                Agregar Empleado
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Pre-crear Empleado</DialogTitle>
                  <DialogDescription>
                    Registra al empleado y asigna su rol. Podrá iniciar sesión con Microsoft Entra ID
                    y el sistema lo enlazará automáticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Field>
                    <FieldLabel htmlFor="create-name">Nombre</FieldLabel>
                    <Input
                      id="create-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="create-email">Correo</FieldLabel>
                    <Input
                      id="create-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="usuario@gyrostorenic.com"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Rol Inicial</FieldLabel>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
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
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isCreating} variant="default">
                    {isCreating ? "Creando..." : "Guardar Empleado"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined
        }
      />

      <AnimatedTabs items={tabs} value={currentTab} onChange={setCurrentTab} layoutId="users-tabs" />

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            {currentTab === "activos" ? (
              <>
                <AnimatedIcon icon={Shield01Icon} size={20} strokeWidth={2} className="text-primary" />
                Personal Activo
              </>
            ) : (
              <>
                <AnimatedIcon icon={UserRemove01Icon} size={20} strokeWidth={2} className="text-destructive" />
                Papelera (30 días)
              </>
            )}
          </CardTitle>
          <CardDescription>
            {currentTab === "activos"
              ? "Personal con acceso al sistema mediante Microsoft Entra ID."
              : "Usuarios dados de baja. Serán eliminados permanentemente después de 30 días."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <QueryState
            loading={isLoading}
            error={isError}
            empty={displayedUsers.length === 0}
            loadingFallback={
              <div className="flex justify-center p-12">
                <BrandLoader text="Cargando perfiles..." />
              </div>
            }
            emptyFallback={
              <div className="p-12 text-center text-muted-foreground">
                <AnimatedIcon
                  icon={UserSettings01Icon}
                  size={32}
                  strokeWidth={2}
                  className="mx-auto mb-2 opacity-50"
                  aria-hidden
                />
                {currentTab === "activos" ? "Sin usuarios registrados" : "La papelera está vacía"}
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {displayedUsers.map((user, i) => (
                  <motion.div
                    key={user.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { duration: 0.25, ease: "easeOut", delay: i * 0.03 }
                    }
                  >
                    <UserCard
                      user={user}
                      isAdmin={isAdmin}
                      onEdit={() => openDetail(user, "editar")}
                      onPerformance={() => openDetail(user, "rendimiento")}
                      onSuspend={() => handleSuspend(user)}
                      onRestore={() => handleRestore(user)}
                      onDelete={() => {
                        setUserToDelete(user);
                        setDeleteDialogOpen(true);
                      }}
                      onChangeRole={(role) => handleChangeRole(user, role)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </QueryState>
        </CardContent>
      </Card>

      {/* ── Diálogo de confirmación para eliminar (reemplaza modal a mano) ── */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUserToDelete(null);
            setDeleteDialogOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Borrar permanentemente</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar por completo a{" "}
              <strong>{userToDelete?.name}</strong> y todo su acceso? Esta acción borrará su perfil
              de la base de datos y no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUserToDelete(null); setDeleteDialogOpen(false); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Sí, eliminar usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo de detalle con tabs ── */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
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

          {selectedUser && (
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
                      <AvatarImage src={selectedUser.avatar_url ?? undefined} alt={selectedUser.name} referrerPolicy="no-referrer" />
                      <AvatarFallback className="font-heading text-2xl font-bold uppercase">
                        {getInitials(selectedUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-heading text-sm font-semibold text-foreground">
                      {selectedUser.name}
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
                        value={selectedUser.email}
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
                        value={selectedUser.roles[0] || "seller"}
                        onValueChange={(v) => handleChangeRole(selectedUser, v as AppRole)}
                        disabled={isProtectedUser(selectedUser)}
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

                    {!selectedUser.deleted_at ? (
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => {
                          handleSuspend(selectedUser);
                          setSelectedUser(null);
                        }}
                        disabled={isProtectedUser(selectedUser)}
                      >
                        <AnimatedIcon icon={UserRemove01Icon} size={16} strokeWidth={2} className="mr-2" aria-hidden />
                        Archivar (Dar de baja)
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-primary/50 text-primary hover:bg-primary/10"
                        onClick={() => {
                          handleRestore(selectedUser);
                          setSelectedUser(null);
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
                {detailTab === "rendimiento" && <PerformanceTab userId={selectedUser.id} />}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
