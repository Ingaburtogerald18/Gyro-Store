import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, MoreVerticalIcon, RefreshIcon, SecurityCheckIcon, Shield01Icon, UserAdd01Icon, UserRemove01Icon, UserSettings01Icon } from "@hugeicons/core-free-icons";
import { useState, useMemo } from 'react';
import type { MetaFunction } from '@remix-run/node';
import type { ColumnDef } from '@tanstack/react-table';
import { 
  useGetUsersQuery, 
  useUpdateUserRolesMutation, 
  useCreateUserMutation,
  useDeleteUserMutation,
  useSuspendUserMutation,
  useRestoreUserMutation,
  useUpdateUserProfileMutation,
  type AppRole,
  type UserProfile
} from '~/store/api/usersApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { DataTable } from '~/components/ui/DataTable';
import { StatusBadge } from '~/components/ui/StatusBadge';
import { AnimatedTabs } from '~/components/ui/AnimatedTabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin } from '~/store/slices/authSlice';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';

import { toast } from 'sonner';
import { QueryState } from '~/components/ui/QueryState';
import { BrandLoader } from '~/components/ui/module-loader';

export const meta: MetaFunction = () => {
  return [{ title: 'Personal | Gyro Store Admin' }];
};

const ROLE_LABELS: Record<AppRole, string> = {
  global_admin: 'Global Admin',
  admin: 'Admin',
  seller: 'Vendedor',
  cashier: 'Cajero',
  logistics_admin: 'Logística (Admin)',
  logistics_customer: 'Logística (Lectura)',
};

const SUPER_ADMIN_EMAIL = 'gerald.aburto@gyrostorenic.com';

export default function AdminUsuarios() {
  const { data: users = [], isLoading, isError } = useGetUsersQuery();
  const [updateRoles] = useUpdateUserRolesMutation();
  const [suspendUser] = useSuspendUserMutation();
  const [restoreUser] = useRestoreUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [updateProfile, { isLoading: isUpdatingProfile }] = useUpdateUserProfileMutation();
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  
  const isAdmin = useAppSelector(selectIsAdmin);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('seller');
  const [currentTab, setCurrentTab] = useState('activos');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.endsWith('@gyrostorenic.com')) {
      toast.error('El correo debe pertenecer al dominio @gyrostorenic.com');
      return;
    }
    try {
      await createUser({ email: newEmail, name: newName, roles: [newRole] }).unwrap();
      toast.success(`Usuario ${newName} pre-creado exitosamente.`);
      setDialogOpen(false);
      setNewName('');
      setNewEmail('');
      setNewRole('seller');
    } catch (error: any) {
      toast.error(error?.data?.error || 'No se pudo crear el usuario.');
    }
  };

  const handleChangeRole = async (user: UserProfile, newRole: AppRole) => {
    if (user.email === SUPER_ADMIN_EMAIL) {
      toast.error('Operación denegada: Este usuario está protegido por el sistema.');
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
    if (user.email === SUPER_ADMIN_EMAIL) {
      toast.error('Operación denegada: Este usuario está protegido por el sistema.');
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
    if (user.email === SUPER_ADMIN_EMAIL) {
      toast.error('Operación denegada: Este usuario está protegido por el sistema.');
      setUserToDelete(null);
      return;
    }
    try {
      await deleteUser(user.id).unwrap();
      toast.success(`${user.name} ha sido borrado de la base de datos.`);
    } catch (error: any) {
      toast.error(error?.data?.error || `Error al borrar a ${user.name}`);
    } finally {
      setUserToDelete(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    const nameInput = document.getElementById('display-name') as HTMLInputElement;
    const phoneInput = document.getElementById('numero') as HTMLInputElement;
    const personalEmailInput = document.getElementById('correo-personal') as HTMLInputElement;
    const bankAccountInput = document.getElementById('cuenta-bancaria') as HTMLInputElement;
    
    const nameVal = nameInput?.value?.trim();
    if (!nameVal) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    try {
      await updateProfile({ id: selectedUser.id, name: nameVal }).unwrap();
      if (phoneInput?.value || personalEmailInput?.value || bankAccountInput?.value) {
        toast.success(`Nombre actualizado. (Otros campos pendientes de base de datos)`);
      } else {
        toast.success('Perfil actualizado correctamente');
      }
      setSelectedUser(null);
    } catch (error: any) {
      toast.error(error?.data?.error || 'Error al actualizar el perfil');
    }
  };

  const activeUsers = useMemo(() => users.filter(u => !u.deleted_at), [users]);
  const deletedUsers = useMemo(() => users.filter(u => u.deleted_at), [users]);

  const columns = useMemo<ColumnDef<UserProfile>[]>(() => [
    {
      accessorKey: "name",
      header: "Empleado",
      cell: ({ row }) => {
        const user = row.original;
        const isProtected = user.email === SUPER_ADMIN_EMAIL;
        return (
          <div className="flex items-center gap-3 py-1 min-w-[200px]">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground border shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-foreground flex items-center gap-1.5 truncate">
                {user.name}
                {isProtected && (
                  <span title="Protegido por el sistema" className="inline-flex shrink-0">
                    <HugeiconsIcon icon={Shield01Icon} size={14} strokeWidth={2} aria-label="Protegido por el sistema" className="text-warning" />
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: "roles",
      header: "Rol Principal",
      cell: ({ row }) => {
        const role = row.original.roles[0] || 'seller';
        return <Badge variant="outline">{ROLE_LABELS[role as AppRole] || role}</Badge>;
      }
    },
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => {
        const deleted = !!row.original.deleted_at;
        if (deleted) return <StatusBadge status="error" label="De Baja" />;
        return <StatusBadge status="success" label="Activo" pulse />;
      }
    },
    {
      id: "actions",
      meta: { align: "right" },
      cell: ({ row }) => {
        const user = row.original;
        const isProtected = user.email === SUPER_ADMIN_EMAIL;
        if (!isAdmin) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <HugeiconsIcon icon={MoreVerticalIcon} size={16} strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</div>
              <DropdownMenuItem onClick={() => setSelectedUser(user)} className="cursor-pointer">
                <HugeiconsIcon icon={UserSettings01Icon} size={16} strokeWidth={2} className="mr-2" /> Editar Perfil
              </DropdownMenuItem>
              <div className="h-px bg-border my-1" />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rol</div>
              {Object.entries(ROLE_LABELS).map(([roleKey, label]) => (
                <DropdownMenuItem 
                  key={roleKey} 
                  onClick={() => handleChangeRole(user, roleKey as AppRole)}
                  className="cursor-pointer"
                >
                  {label}
                </DropdownMenuItem>
              ))}
              {!user.deleted_at ? (
                <>
                  {!isProtected && (
                    <>
                      <div className="h-px bg-border my-1" />
                      <DropdownMenuItem onClick={() => handleSuspend(user)} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                        <HugeiconsIcon icon={UserRemove01Icon} size={16} strokeWidth={2} className="mr-2" /> Dar de baja
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-border my-1" />
                  <DropdownMenuItem onClick={() => handleRestore(user)} className="text-primary focus:bg-primary/10 focus:text-primary cursor-pointer">
                    <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={2} className="mr-2" /> Restaurar
                  </DropdownMenuItem>
                  {!isProtected && (
                    <DropdownMenuItem onClick={() => setUserToDelete(user)} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                      <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} className="mr-2" /> Eliminar
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    }
  ], [isAdmin]);

  const tabs = [
    { id: 'activos', label: 'Personal Activo' },
    { id: 'inactivos', label: 'Papelera (Inactivos)' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Gestión de Personal</h2>
          <p className="text-muted-foreground">Administra los roles y el acceso del equipo a Gyro Store.</p>
        </div>
        
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default">
                <HugeiconsIcon icon={UserAdd01Icon} size={16} strokeWidth={2} className="mr-2" />
                Agregar Empleado
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Pre-crear Empleado</DialogTitle>
                  <DialogDescription>
                    Registra al empleado y asigna su rol. Podrá iniciar sesión con Microsoft Entra ID y el sistema lo enlazará automáticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Nombre</Label>
                    <Input 
                      id="name" 
                      value={newName} 
                      onChange={e => setNewName(e.target.value)} 
                      className="col-span-3" 
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Correo</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={newEmail} 
                      onChange={e => setNewEmail(e.target.value)} 
                      placeholder="usuario@gyrostorenic.com"
                      className="col-span-3" 
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Rol Inicial</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                      <SelectTrigger className="col-span-3">
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
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isCreating} variant="default">
                    {isCreating ? 'Creando...' : 'Guardar Empleado'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <AnimatedTabs
        items={tabs}
        value={currentTab}
        onChange={setCurrentTab}
        layoutId="users-tabs"
      />

      <Card>
        <CardHeader className="border-b border pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            {currentTab === 'activos' ? (
              <><HugeiconsIcon icon={Shield01Icon} size={20} strokeWidth={2} className="text-primary" /> Cuentas Activas</>
            ) : (
              <><HugeiconsIcon icon={UserRemove01Icon} size={20} strokeWidth={2} className="text-destructive" /> Papelera (30 días)</>
            )}
          </CardTitle>
          <CardDescription>
            {currentTab === 'activos' 
              ? 'Personal con acceso al sistema mediante Microsoft Entra ID.' 
              : 'Usuarios dados de baja. Serán eliminados permanentemente después de 30 días.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState
            loading={isLoading}
            error={isError}
            empty={currentTab === 'activos' ? activeUsers.length === 0 : deletedUsers.length === 0}
            loadingFallback={<div className="flex p-12 justify-center"><BrandLoader text="Cargando perfiles..." /></div>}
            emptyFallback={
              <div className="p-12 text-center text-muted-foreground">
                <HugeiconsIcon icon={UserSettings01Icon} size={32} strokeWidth={2} className="mx-auto mb-2 opacity-50" />
                {currentTab === 'activos' ? 'Sin usuarios registrados' : 'La papelera está vacía'}
              </div>
            }
          >
            <div className="p-4 sm:p-6">
              <DataTable
                columns={columns}
                data={currentTab === 'activos' ? activeUsers : deletedUsers}
                searchPlaceholder="Buscar usuario por nombre o correo..."
                paginated
                pageSize={10}
              />
            </div>
          </QueryState>
        </CardContent>
      </Card>

      {/* Modal de confirmación custom para eliminar usuario permanentemente */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border p-6 rounded-card shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-foreground mb-2">Borrar permanentemente</h3>
            <p className="text-muted-foreground mb-6 text-sm">
              ¿Seguro que deseas eliminar por completo a <strong>{userToDelete.name}</strong> y todo su acceso? Esta acción borrará su perfil de la base de datos y no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setUserToDelete(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>Sí, eliminar usuario</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal con detalles del usuario */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Información del Empleado</DialogTitle>
            <DialogDescription>
              Modifica los datos del usuario o archívalo si ya no forma parte del equipo.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="flex flex-col gap-6 py-6 h-full">
              {/* Foto centrada y grande */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-4xl font-bold text-muted-foreground border-4 border shadow-xl">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    selectedUser.name.charAt(0).toUpperCase()
                  )}
                </div>
              </div>

              {/* Campos de Información */}
              <div className="grid gap-4 flex-1 mt-2">
                <div className="grid gap-2">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input 
                    id="display-name" 
                    defaultValue={selectedUser.name} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="correo">Correo Corporativo</Label>
                  <Input 
                    id="correo" 
                    type="email" 
                    defaultValue={selectedUser.email} 
                    disabled 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="correo-personal">Correo Personal</Label>
                  <Input 
                    id="correo-personal" 
                    type="email" 
                    placeholder="usuario@gmail.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role Principal</Label>
                  <Input 
                    id="role" 
                    defaultValue={ROLE_LABELS[selectedUser.roles[0] || 'seller']} 
                    disabled 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="numero">Número de Teléfono</Label>
                  <Input 
                    id="numero" 
                    placeholder="+505 0000 0000" 
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="cuenta-bancaria">Cuenta Bancaria (Pagos)</Label>
                  <Input 
                    id="cuenta-bancaria" 
                    placeholder="Ej. BAC 123456789 - Cuenta en Córdobas" 
                  />
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border flex flex-col gap-3">
                <Button 
                  variant="default"
                  className="w-full"
                  onClick={handleSaveProfile}
                  disabled={isUpdatingProfile}
                >
                  <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={2} className={`w-4 h-4 mr-2 ${isUpdatingProfile ? 'animate-spin' : ''}`} />
                  {isUpdatingProfile ? 'Guardando...' : 'Guardar Cambios'}
                </Button>

                {!selectedUser.deleted_at ? (
                  <Button 
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      handleSuspend(selectedUser);
                      setSelectedUser(null);
                    }}
                    disabled={selectedUser.email === SUPER_ADMIN_EMAIL}
                  >
                    <HugeiconsIcon icon={UserRemove01Icon} size={16} strokeWidth={2} className="mr-2" />
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
                    <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={2} className="mr-2" />
                    Restaurar Usuario
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
