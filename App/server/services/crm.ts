// CRM: captura de leads públicos + actividad inicial (doc 09 ítems 33-34).
// Reemplaza al email de v1 (server/routes/contact.js mandaba un correo — v2
// no tiene servicio de email todavía): el mensaje del formulario público
// entra directo al CRM (contacts/contact_activities) para que el staff le dé
// seguimiento desde el board, en vez de perderse en una bandeja de correo.
//
// v1's services/crm.js `createContact` (admin, exige `user` autenticado,
// tags/source/product/status propios de la ficha completa del panel) NO es
// lo que se recicla acá — sigue siendo admin-only y queda fuera de este
// archivo. Lo que sí se recicla es el patrón de `addContactActivity`: crear
// una actividad ligada al contacto en el mismo movimiento.
import { db } from '../supabase';
import type { PublicContactInput } from '../../shared/schemas';

export interface Lead {
  contactId: string;
  activityId: string;
}

// find-or-create por teléfono (contacts.phone es UNIQUE): un visitante que
// escribe dos veces no rompe el constraint — se le agrega una actividad
// nueva al mismo contacto en vez de fallar. No se pisa el nombre de un
// contacto existente: podría ser un dato que el staff ya corrigió a mano.
export async function createLead(input: PublicContactInput): Promise<Lead> {
  const { data: existing, error: findError } = await db
    .from('contacts')
    .select('id')
    .eq('phone', input.phone)
    .maybeSingle();
  if (findError) throw findError;

  let contactId: string;
  if (existing) {
    contactId = existing.id;
  } else {
    const { data: created, error: createError } = await db
      .from('contacts')
      .insert({ phone: input.phone, name: input.name, origin: 'organic' })
      .select('id')
      .single();
    if (createError) throw createError;
    contactId = created.id;
  }

  // `contacts` no tiene columna de email (doc 03 B.3): si lo mandaron, viaja
  // dentro de la nota de la actividad en vez de perderse.
  const note = input.email ? `Correo: ${input.email}\n\n${input.message}` : input.message;

  const { data: activity, error: activityError } = await db
    .from('contact_activities')
    .insert({ contact_id: contactId, type: 'contact_form', note })
    .select('id')
    .single();
  if (activityError) throw activityError;

  return { contactId, activityId: activity.id };
}

// find-or-create por teléfono para un PEDIDO WEB. Igual que createLead no pisa el
// nombre de un contacto existente (el staff pudo corregirlo a mano) y deja una
// actividad en el historial para que el pedido aparezca en la ficha del CRM.
//
// Best-effort desde el checkout: TODO va en try/catch y devuelve null si algo
// falla, porque un pedido NO debe romperse porque el CRM tuvo un problema. El
// origen es `whatsapp_link` (el pedido se cierra por el link de WhatsApp).
export async function findOrCreateOrderContact(
  phone: string,
  name: string,
): Promise<string | null> {
  try {
    const { data: existing } = await db
      .from('contacts')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    let contactId: string;
    if (existing) {
      contactId = existing.id;
    } else {
      const { data: created } = await db
        .from('contacts')
        .insert({ phone, name, origin: 'whatsapp_link' })
        .select('id')
        .single();
      if (created) {
        contactId = created.id;
      } else {
        // Carrera: otro pedido del mismo teléfono lo creó en el ínterin
        // (contacts.phone es UNIQUE). Re-leer en vez de fallar.
        const { data: retry } = await db
          .from('contacts')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();
        if (!retry) return null;
        contactId = retry.id;
      }
    }

    await db
      .from('contact_activities')
      .insert({ contact_id: contactId, type: 'web_order', note: 'Pedido desde el catálogo web.' });

    return contactId;
  } catch {
    return null;
  }
}
