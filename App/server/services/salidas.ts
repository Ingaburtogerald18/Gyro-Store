import { db } from '../supabase';
import { BadRequestError } from '../utils/httpError';
import type { RegisterSalidaInput, LiquidarSalidaInput, Salida } from '../../shared/schemas';

// Helpers internos para parsear y devolver tipos tipados
function parseSalidaRow(row: any): Salida {
  return {
    id: row.id,
    articulo: row.articulo,
    destino: row.destino,
    invoice_id: row.invoice_id,
    order_id: row.order_id,
    estado: row.estado,
    repartidor: row.repartidor,
    monto_esperado: row.monto_esperado,
    liquidacion: row.liquidacion,
    liquidado_at: row.liquidado_at,
    comprobante_url: row.comprobante_url,
    cuenta_deposito_id: row.cuenta_deposito_id,
    nota: row.nota,
    salio_at: row.salio_at,
    registrado_por: row.registrado_por,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SALIDA_COLUMNS = `
  id, articulo, destino, invoice_id, order_id, estado,
  repartidor, monto_esperado, liquidacion, liquidado_at, comprobante_url,
  cuenta_deposito_id, nota, salio_at, registrado_por, created_at, updated_at
`;

export async function createSalida(input: RegisterSalidaInput, userId: string): Promise<Salida> {
  // Si tiene invoice_id, la salida nace como 'facturada'.
  // Si no, nace como 'pendiente_registro' por defecto en DB.
  const estado = input.invoice_id ? 'facturada' : 'pendiente_registro';
  
  // Si es delivery, por defecto la liquidacion empieza 'pendiente', sino 'no_aplica'
  const liquidacion = input.destino === 'delivery' ? 'pendiente' : 'no_aplica';

  const { data, error } = await db
    .from('salidas')
    .insert({
      articulo: input.articulo,
      destino: input.destino,
      invoice_id: input.invoice_id ?? null,
      repartidor: input.repartidor ?? null,
      monto_esperado: input.monto_esperado ?? null,
      nota: input.nota ?? null,
      estado,
      liquidacion,
      registrado_por: userId,
    })
    .select(SALIDA_COLUMNS)
    .single();

  if (error) throw error;
  return parseSalidaRow(data);
}

export async function listSalidas(filters?: {
  estado?: string;
  liquidacion?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Salida[]> {
  let query = db.from('salidas').select(SALIDA_COLUMNS).order('salio_at', { ascending: false });

  if (filters?.estado) {
    query = query.eq('estado', filters.estado);
  }
  if (filters?.liquidacion) {
    query = query.eq('liquidacion', filters.liquidacion);
  }
  if (filters?.startDate) {
    query = query.gte('salio_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('salio_at', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(parseSalidaRow);
}

export async function liquidarSalida(id: string, input: LiquidarSalidaInput): Promise<Salida> {
  const { data: salida, error: salidaError } = await db
    .from('salidas')
    .select('id, destino')
    .eq('id', id)
    .maybeSingle();

  if (salidaError) throw salidaError;
  if (!salida) throw new BadRequestError('Salida no encontrada');
  if (salida.destino !== 'delivery') {
    throw new BadRequestError('Solo se pueden liquidar salidas con destino delivery');
  }

  const updates: any = {
    liquidacion: input.liquidacion,
    liquidado_at: new Date().toISOString(),
  };

  if (input.monto_esperado !== undefined) updates.monto_esperado = input.monto_esperado;
  if (input.comprobante_url !== undefined) updates.comprobante_url = input.comprobante_url;
  if (input.cuenta_deposito_id !== undefined) updates.cuenta_deposito_id = input.cuenta_deposito_id;
  if (input.nota !== undefined) updates.nota = input.nota;

  const { data, error } = await db
    .from('salidas')
    .update(updates)
    .eq('id', id)
    .select(SALIDA_COLUMNS)
    .single();

  if (error) throw error;
  return parseSalidaRow(data);
}

export async function linkToSale(id: string, orderId: string): Promise<Salida> {
  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) throw new BadRequestError('Venta no encontrada');

  const { data, error } = await db
    .from('salidas')
    .update({
      order_id: orderId,
      estado: 'registrada',
    })
    .eq('id', id)
    .eq('estado', 'pendiente_registro')
    .select(SALIDA_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new BadRequestError('No se pudo ligar a venta. Revise si la salida está pendiente.');

  return parseSalidaRow(data);
}

export async function markAsDevuelta(id: string): Promise<Salida> {
  const { data, error } = await db
    .from('salidas')
    .update({
      estado: 'devuelta',
    })
    .eq('id', id)
    .select(SALIDA_COLUMNS)
    .single();

  if (error) throw error;
  return parseSalidaRow(data);
}
