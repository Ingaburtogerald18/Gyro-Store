// Pestaña "General" de Configuración (extraída de admin.configuracion.tsx).
import { AnimatedIcon } from "~/components/ui/animated-icons";
import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Section } from "./Section";

export function GeneralConfig() {
  return (
    <div className="space-y-6">
      <Section title="Información del Negocio" description="Datos generales de contacto y operación de la tienda.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre de la Tienda</Label>
              <Input defaultValue="Gyro Store" />
            </div>
            <div className="space-y-2">
              <Label>Número RUC</Label>
              <Input placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono Principal (WhatsApp)</Label>
              <Input defaultValue="+505 " />
            </div>
            <div className="space-y-2">
              <Label>Correo de Contacto</Label>
              <Input type="email" placeholder="contacto@gyrostore.com" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección Física</Label>
              <Input defaultValue="Managua, Nicaragua" />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button className="shadow-sm">
              <AnimatedIcon icon={FloppyDiskIcon} size={16} strokeWidth={2} className="mr-2" />
              Guardar General
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
