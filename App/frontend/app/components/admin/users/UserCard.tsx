// Card de un usuario en la grilla de Personal (extraída de admin.usuarios.tsx).
// Presentacional: recibe el usuario y callbacks; no toca la API.
import { AnimatedIcon } from "~/components/ui/animated-icons";
import {
  Delete02Icon,
  MoreVerticalIcon,
  PieChartIcon,
  RefreshIcon,
  Shield01Icon,
  UserRemove01Icon,
  UserSettings01Icon,
} from "@hugeicons/core-free-icons";
import type { AppRole, UserProfile } from "~/store/api/usersApi";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { StatusBadge } from "~/components/ui/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ROLE_LABELS, isProtectedUser, getInitials } from "./constants";

export function UserCard({
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
