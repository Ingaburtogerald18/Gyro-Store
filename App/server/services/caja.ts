import { db } from '../supabase';
import { BadRequestError } from '../utils/httpError';
import type { RegisterMovementInput, Account, AccountMovement } from '../../shared/schemas';

// ── ACCOUNTS ──

const ACCOUNT_COLUMNS = `id, nombre, tipo, moneda, activo, created_at`;

function parseAccountRow(row: any): Account {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    moneda: row.moneda,
    activo: row.activo,
    created_at: row.created_at,
  };
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await db
    .from('accounts')
    .select(ACCOUNT_COLUMNS)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(parseAccountRow);
}

export async function createAccount(nombre: string, tipo: 'banco'|'efectivo', moneda: string = 'NIO'): Promise<Account> {
  const { data, error } = await db
    .from('accounts')
    .insert({ nombre, tipo, moneda })
    .select(ACCOUNT_COLUMNS)
    .single();

  if (error) throw error;
  return parseAccountRow(data);
}

export async function toggleAccountStatus(id: string, activo: boolean): Promise<Account> {
  const { data, error } = await db
    .from('accounts')
    .update({ activo })
    .eq('id', id)
    .select(ACCOUNT_COLUMNS)
    .single();

  if (error) throw error;
  return parseAccountRow(data);
}

// ── MOVEMENTS ──

const MOVEMENT_COLUMNS = `
  id, account_id, tipo, monto, categoria, descripcion,
  salida_id, comprobante_url, ocurrio_at, registrado_por, created_at
`;

function parseMovementRow(row: any): AccountMovement {
  return {
    id: row.id,
    account_id: row.account_id,
    tipo: row.tipo,
    monto: row.monto,
    categoria: row.categoria,
    descripcion: row.descripcion,
    salida_id: row.salida_id,
    comprobante_url: row.comprobante_url,
    ocurrio_at: row.ocurrio_at,
    registrado_por: row.registrado_por,
    created_at: row.created_at,
  };
}

export async function registerMovement(input: RegisterMovementInput, userId: string): Promise<AccountMovement> {
  const { data, error } = await db
    .from('account_movements')
    .insert({
      account_id: input.account_id,
      tipo: input.tipo,
      monto: input.monto,
      categoria: input.categoria,
      descripcion: input.descripcion ?? null,
      comprobante_url: input.comprobante_url ?? null,
      ocurrio_at: input.ocurrio_at ?? new Date().toISOString(),
      registrado_por: userId,
    })
    .select(MOVEMENT_COLUMNS)
    .single();

  if (error) throw error;
  return parseMovementRow(data);
}

export async function listMovements(filters?: { accountId?: string; startDate?: string; endDate?: string }): Promise<AccountMovement[]> {
  let query = db.from('account_movements').select(MOVEMENT_COLUMNS).order('ocurrio_at', { ascending: false });

  if (filters?.accountId) {
    query = query.eq('account_id', filters.accountId);
  }
  if (filters?.startDate) {
    query = query.gte('ocurrio_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('ocurrio_at', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(parseMovementRow);
}

// ── BALANCE ──

export interface AccountBalance {
  accountId: string;
  balance: number;
}

export async function getBalances(): Promise<AccountBalance[]> {
  // Calculamos saldo por cuenta sumando ingresos y restando egresos
  const { data, error } = await db
    .from('account_movements')
    .select('account_id, tipo, monto');

  if (error) throw error;

  const balances: Record<string, number> = {};

  for (const mov of (data || [])) {
    if (!mov.account_id) continue;
    if (balances[mov.account_id] === undefined) balances[mov.account_id] = 0;
    if (mov.tipo === 'ingreso') {
      balances[mov.account_id]! += Number(mov.monto);
    } else {
      balances[mov.account_id]! -= Number(mov.monto);
    }
  }

  return Object.entries(balances).map(([accountId, balance]) => ({
    accountId,
    balance
  }));
}
