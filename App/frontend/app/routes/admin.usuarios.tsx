// Vista de Personal: orquestador delgado. La UI vive en components/admin/users/
// (card, diálogos de crear/borrar/detalle, tab de rendimiento) y las acciones
// en useUserActions. Acá solo se resuelve la lista, el filtro activos/papelera
// y qué usuario está seleccionado.
import { AnimatedIcon } from "~/components/ui/animated-icons";
import { Shield01Icon, UserRemove01Icon, UserSettings01Icon } from "@hugeicons/core-free-icons";
import { useState, useMemo } from "react";
import type { MetaFunction } from "@remix-run/node";
import { getBrandName, pageTitle } from '~/lib/brand';
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { useGetUsersQuery, type UserProfile } from "~/store/api/usersApi";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { PageHeader } from "~/components/layout/PageHeader";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";
import { QueryState } from "~/components/ui/QueryState";
import { BrandLoader } from "~/components/ui/module-loader";

import { UserCard } from "~/components/admin/users/UserCard";
import { CreateUserDialog } from "~/components/admin/users/CreateUserDialog";
import { DeleteUserDialog } from "~/components/admin/users/DeleteUserDialog";
import { UserDetailDialog } from "~/components/admin/users/UserDetailDialog";
import { useUserActions } from "~/components/admin/users/useUserActions";

export const meta: MetaFunction = () => {
  return [{ title: pageTitle('Personal', { admin: true }) }];
};

export default function AdminUsuarios() {
  const { data: users = [], isLoading, isError } = useGetUsersQuery();
  const isAdmin = useAppSelector(selectIsAdmin);
  const reduceMotion = useReducedMotion();
  const { changeRole, suspend, restore } = useUserActions();

  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [detailTab, setDetailTab] = useState<"editar" | "rendimiento">("editar");
  const [currentTab, setCurrentTab] = useState("activos");

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
        actions={isAdmin ? <CreateUserDialog /> : undefined}
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
                      onSuspend={() => suspend(user)}
                      onRestore={() => restore(user)}
                      onDelete={() => setUserToDelete(user)}
                      onChangeRole={(role) => changeRole(user, role)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </QueryState>
        </CardContent>
      </Card>

      <DeleteUserDialog user={userToDelete} onClose={() => setUserToDelete(null)} />

      <UserDetailDialog
        user={selectedUser}
        initialTab={detailTab}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  );
}
