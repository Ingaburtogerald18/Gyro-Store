// Constantes y helpers compartidos por las piezas de la vista de Personal
// (extraídas de admin.usuarios.tsx). Un solo lugar para el mapa de roles y las
// utilidades de perfil que consumen la card, el detalle y el hook de acciones.
import type { AppRole, UserProfile } from "~/store/api/usersApi";
import type { UpdateProfileInput } from "@shared/schemas";

export const ROLE_LABELS: Record<AppRole, string> = {
  global_admin: "Global Admin",
  admin: "Admin",
  seller: "Vendedor",
  cashier: "Cajero",
  logistics_admin: "Logística (Admin)",
  logistics_customer: "Logística (Lectura)",
};

export const isProtectedUser = (user: UserProfile) => user.isProtected === true;

// Formulario vacío del modal de edición. `bank_account` arranca en null: un
// empleado sin cuenta cargada no debe mostrar un banco elegido por defecto.
export const EMPTY_PROFILE_FORM: UpdateProfileInput = {
  name: "",
  phone: "",
  personal_email: "",
  bank_account: null,
};

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
