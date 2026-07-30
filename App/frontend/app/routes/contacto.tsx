// Formulario de contacto público (doc 09 ítem 48). Reciclado de v1
// (routes/contacto.tsx: mismo layout de dos columnas, react-hook-form +
// zodResolver), adaptado al schema y al mutation de v2 — v1 mandaba un
// correo; v2 captura el lead directo en el CRM (POST /api/contact →
// services/crm.ts), así que ahora el teléfono es obligatorio (es la llave de
// `contacts.phone`) en vez de opcional.
import type { MetaFunction } from '@remix-run/node';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { publicContactInputSchema, type PublicContactInput } from '@shared/schemas';
import { StoreHeader } from '~/components/store/store-header';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { errMsg } from '~/lib/utils';
import { useSendContactMutation } from '~/store/api/contactApi';

export const meta: MetaFunction = () => [{ title: 'Contacto · Gyro Store' }];

export default function Contacto() {
  const [sendContact, { isLoading }] = useSendContactMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PublicContactInput>({ resolver: zodResolver(publicContactInputSchema) });

  async function onSubmit(data: PublicContactInput) {
    try {
      await sendContact(data).unwrap();
      reset();
      toast.success('Mensaje enviado. Te respondemos pronto.');
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo enviar el mensaje.'));
    }
  }

  return (
    <>
      <StoreHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-text">Contacto</h1>
        <p className="mt-1 text-muted">¿Tenés una consulta? Escribinos y te respondemos.</p>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Nombre *" error={errors.name?.message}>
              <Input placeholder="Tu nombre" {...register('name')} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Teléfono *" error={errors.phone?.message}>
              <Input
                inputMode="tel"
                placeholder="8888 8888"
                {...register('phone')}
                aria-invalid={!!errors.phone}
              />
            </Field>
            <Field label="Correo (opcional)" error={errors.email?.message}>
              <Input
                type="email"
                placeholder="tu@correo.com"
                {...register('email')}
                aria-invalid={!!errors.email}
              />
            </Field>
            <Field label="Mensaje *" error={errors.message?.message}>
              <Textarea
                rows={4}
                placeholder="¿En qué te ayudamos?"
                {...register('message')}
                aria-invalid={!!errors.message}
              />
            </Field>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Enviando…' : 'Enviar mensaje'}
            </Button>
          </form>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-surface p-5 shadow-xs">
              <h2 className="font-semibold text-text">Visitanos</h2>
              <a
                href="https://maps.google.com/?q=Managua,Nicaragua"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
              >
                <MapPin className="h-4 w-4" aria-hidden /> Managua, Nicaragua
              </a>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
