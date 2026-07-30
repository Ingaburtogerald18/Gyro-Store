import { useState } from 'react';
import type { MetaFunction } from '@remix-run/node';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '~/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin } from '~/store/slices/authSlice';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Shield, ShieldAlert, UserCog, UserX, Trash2, UserPlus, MailPlus, AlertTriangle, CheckCircle2, ChevronDown, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

export const meta: MetaFunction = () => {
  return [{ title: 'Personal | Gyro Store Admin' }];
};

// Mapa de roles para renderizarlos bonitos
const ROLE_BADGES: Record<AppRole, { label: string; colorClass: string }> = {
  global_admin: { label: 'Global Admin', colorClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  admin: { label: 'Admin', colorClass: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  seller: { label: 'Vendedor', colorClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cashier: { label: 'Cajero', colorClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  logistics_admin: { label: 'Logística (Admin)', colorClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  logistics_customer: { label: 'Logística (Lectura)', colorClass: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

const SUPER_ADMIN_EMAIL = 'gerald.aburto@gyrostorenic.com';

export default function AdminUsuarios() {
  const { data: users = [], isLoading, isError, refetch } = useGetUsersQuery();
  const [updateRoles] = useUpdateUserRolesMutation();
  const [suspendUser] = useSuspendUserMutation();
  const [restoreUser] = useRestoreUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [updateProfile, { isLoading: isUpdatingProfile }] = useUpdateUserProfileMutation();
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const isAdmin = useAppSelector(selectIsAdmin);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('seller');

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
      toast.success(`Rol de ${user.name} actualizado a ${ROLE_BADGES[newRole].label}`);
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
      toast.success(`${user.name} ha sido dado de baja (movido a Papelera).`);
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
    
    const newName = nameInput?.value?.trim();
    
    if (!newName) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    try {
      await updateProfile({ id: selectedUser.id, name: newName }).unwrap();
      
      // Mostrar info sobre los otros campos
      if (phoneInput?.value || personalEmailInput?.value || bankAccountInput?.value) {
        toast.success(`Nombre actualizado. (Teléfono, Correo Personal y Cuenta Bancaria pendientes de base de datos)`);
      } else {
        toast.success('Perfil actualizado correctamente');
      }
      
      setSelectedUser(null);
    } catch (error: any) {
      toast.error(error?.data?.error || 'Error al actualizar el perfil');
    }
  };

  // Filtrar activos e inactivos (soft deleted)
  const activeUsers = users.filter(u => !u.deleted_at);
  const deletedUsers = users.filter(u => u.deleted_at);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-50">Gestión de Personal</h2>
          <p className="text-slate-400">Administra los roles y el acceso del equipo a Gyro Store.</p>
        </div>
        
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10">
                <UserPlus className="w-4 h-4 mr-2" />
                Agregar Empleado
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800 text-slate-50">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Pre-crear Empleado</DialogTitle>
                  <DialogDescription className="text-slate-400">
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
                      className="col-span-3 bg-slate-800 border-slate-700" 
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
                      className="col-span-3 bg-slate-800 border-slate-700" 
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Rol Inicial</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                      <SelectTrigger className="col-span-3 bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                        {Object.entries(ROLE_BADGES).map(([key, config]) => (
                          <SelectItem key={key} value={key} className="hover:bg-slate-700 focus:bg-slate-700">
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isCreating} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isCreating ? 'Creando...' : 'Guardar Empleado'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="activos" className="w-full">
        <TabsList className="mb-4 bg-slate-900 border border-slate-800 h-11 p-1">
          <TabsTrigger value="activos" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400">Personal Activo</TabsTrigger>
          <TabsTrigger value="inactivos" className="data-[state=active]:bg-slate-800 data-[state=active]:text-rose-400">Papelera (Inactivos)</TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="mt-0">
          <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="border-b border-slate-800/50 pb-4">
          <CardTitle className="text-lg text-slate-50 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Cuentas Activas
          </CardTitle>
          <CardDescription className="text-slate-400">
            Personal con acceso al sistema mediante Microsoft Entra ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="text-center py-12">
              <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
              <p className="text-rose-400 font-medium">Error al cargar usuarios.</p>
              <p className="text-slate-500 text-sm mt-1">El backend (Postgres) aún no está conectado.</p>
            </div>
          ) : (
            <div className="p-6">
              {isLoading ? (
                <div className="text-center py-12 text-slate-500">Cargando perfiles...</div>
              ) : activeUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <UserCog className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  Sin usuarios registrados
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {activeUsers.map((user) => {
                    const isProtected = user.email === SUPER_ADMIN_EMAIL;
                    const primaryRole = user.roles[0] || 'seller';
                    const badge = ROLE_BADGES[primaryRole];

                    return (
                      <div 
                        key={user.id} 
                        onClick={() => setSelectedUser(user)}
                        className="group relative flex flex-col items-center p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 hover:bg-slate-800/30 transition-all shadow-sm cursor-pointer"
                      >
                        {isProtected && (
                          <div className="absolute top-4 left-4 text-amber-500" title="Protegido por el sistema">
                            <Shield className="w-4 h-4" />
                          </div>
                        )}
                        {isAdmin && (
                          <div className="absolute top-3 right-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild disabled={isProtected}>
                                <Button variant="ghost" size="icon" className={`h-8 w-8 text-slate-500 hover:text-slate-300 ${isProtected ? 'hidden' : ''}`}>
                                  <UserCog className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-200">
                                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cambiar rol</div>
                                {Object.entries(ROLE_BADGES).map(([roleKey, roleConfig]) => (
                                  <DropdownMenuItem 
                                    key={roleKey} 
                                    onClick={() => handleChangeRole(user, roleKey as AppRole)}
                                    className="hover:bg-slate-800 cursor-pointer"
                                  >
                                    {roleConfig.label}
                                  </DropdownMenuItem>
                                ))}
                                <div className="h-px bg-slate-800 my-1" />
                                <DropdownMenuItem 
                                  onSelect={(e) => {
                                    handleSuspend(user);
                                  }}
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                                >
                                  <UserX className="w-4 h-4 mr-2" />
                                  Dar de baja
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}

                        <div className="mt-2 mb-4">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.name} className="w-20 h-20 rounded-full border-4 border-slate-800 object-cover bg-slate-900" />
                          ) : (
                            <div className="grid w-20 h-20 place-items-center rounded-full bg-slate-800 border-4 border-slate-900 text-2xl font-bold text-slate-300">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-slate-200 text-center line-clamp-1">{user.name}</h3>
                        <p className="text-sm text-slate-500 text-center mb-5 truncate w-full" title={user.email}>{user.email}</p>

                        <div className="mt-auto">
                          <Badge variant="outline" className={badge.colorClass}>
                            {badge.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactivos" className="mt-0">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800/50 pb-4">
              <CardTitle className="text-lg text-slate-50 flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-400" />
                Papelera (30 días)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Usuarios dados de baja. Serán eliminados permanentemente después de 30 días.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!isLoading && !isError && (
                <div className="p-6">
                  {deletedUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-slate-800/50 bg-slate-900/30 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3 text-slate-600">
                        <UserX className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-slate-400 font-medium">La papelera está vacía</p>
                      <p className="text-xs text-slate-500 mt-1">Los usuarios dados de baja aparecerán aquí por 30 días.</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {deletedUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-800/50 bg-slate-900/30">
                          <div className="flex items-center gap-3">
                            <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-800/50 text-xs font-bold text-slate-600">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-400 line-through">{u.name}</p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="border-slate-700 text-slate-500 bg-slate-800/50">Dado de baja</Badge>
                            {isAdmin && (
                              <div className="flex items-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                  onClick={() => handleRestore(u)}
                                  title="Restaurar usuario"
                                >
                                  <RefreshCcw className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                                  onClick={() => setUserToDelete(u)}
                                  title="Borrar permanentemente"
                                >
                                  <UserX className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de confirmación custom para eliminar usuario permanentemente */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border p-6 rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-100 mb-2">Borrar permanentemente</h3>
            <p className="text-slate-400 mb-6 text-sm">
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
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Información del Empleado</DialogTitle>
            <DialogDescription className="text-slate-400">
              Modifica los datos del usuario o archívalo si ya no forma parte del equipo.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="flex flex-col gap-6 py-6 h-full">
              {/* Foto centrada y grande */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-4xl font-bold text-slate-300 border-4 border-slate-700 shadow-xl">
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
                  <Label htmlFor="display-name" className="text-slate-400">Display Name</Label>
                  <Input 
                    id="display-name" 
                    defaultValue={selectedUser.name} 
                    className="bg-slate-800/50 border-slate-700 text-slate-200" 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="correo" className="text-slate-400">Correo Corporativo</Label>
                  <Input 
                    id="correo" 
                    type="email" 
                    defaultValue={selectedUser.email} 
                    className="bg-slate-800/50 border-slate-700 text-slate-400" 
                    disabled 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="correo-personal" className="text-slate-400">Correo Personal</Label>
                  <Input 
                    id="correo-personal" 
                    type="email" 
                    placeholder="usuario@gmail.com"
                    className="bg-slate-800/50 border-slate-700 text-slate-200" 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role" className="text-slate-400">Role Principal</Label>
                  <Input 
                    id="role" 
                    defaultValue={ROLE_BADGES[selectedUser.roles[0] || 'seller'].label} 
                    className="bg-slate-800/50 border-slate-700 text-slate-400" 
                    disabled 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="numero" className="text-slate-400">Número de Teléfono</Label>
                  <Input 
                    id="numero" 
                    placeholder="+505 0000 0000" 
                    className="bg-slate-800/50 border-slate-700 text-slate-200" 
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="cuenta-bancaria" className="text-slate-400">Cuenta Bancaria (Pagos)</Label>
                  <Input 
                    id="cuenta-bancaria" 
                    placeholder="Ej. BAC 123456789 - Cuenta en Córdobas" 
                    className="bg-slate-800/50 border-slate-700 text-slate-200" 
                  />
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-slate-800 flex flex-col gap-3">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSaveProfile}
                  disabled={isUpdatingProfile}
                >
                  <RefreshCcw className={`w-4 h-4 mr-2 ${isUpdatingProfile ? 'animate-spin' : ''}`} />
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
                    <UserX className="w-4 h-4 mr-2" />
                    Archivar (Dar de baja)
                  </Button>
                ) : (
                  <Button 
                    variant="outline"
                    className="w-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => {
                      handleRestore(selectedUser);
                      setSelectedUser(null);
                    }}
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
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
