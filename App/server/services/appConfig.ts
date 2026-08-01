import { db } from '../supabase';
import {
  financialConfigSchema,
  type FinancialConfig,
  imageResourcesSchema,
  type ImageResources,
} from '../../shared/schemas';

const FINANCIAL_CONFIG_KEY = 'financial_config';
const IMAGE_RESOURCES_KEY = 'image_resources';

// Valores por defecto extraídos del documento 11-Logica-Financiera.md
const DEFAULT_FINANCIAL_CONFIG: FinancialConfig = {
  exchangeRate: 37,
  salaryPercentage: 0.20,
  costoFUScale: [
    { maxCost: 100, amount: 15 },
    { maxCost: 200, amount: 25 },
    { maxCost: 300, amount: 35 },
    { maxCost: 500, amount: 55 },
    { maxCost: 800, amount: 75 },
    { maxCost: 1300, amount: 95 },
    { maxCost: 2000, amount: 120 },
    { maxCost: null, amount: 150 },
  ],
  pozos: {
    publicidad: 0.25,
    mantenimiento: 0.07,
    utiles: 0.05,
    garantias: 0.08,
    prestamos: 0.40,
    suscripciones: 0.05,
    servicios: 0.10,
  },
  marginScale: [
    // El tramo < 50 genera un error lógico, pero lo mapeamos con 0 margen como salvaguarda
    { maxCost: 50, margin: 0.00 },
    { maxCost: 300, margin: 0.43 },
    { maxCost: 500, margin: 0.41 },
    { maxCost: 900, margin: 0.37 },
    { maxCost: 1500, margin: 0.33 },
    { maxCost: 2500, margin: 0.30 },
    { maxCost: null, margin: 0.25 },
  ],
  commissionScale: [
    { maxProfit: 100, margin: 0.45 },
    { maxProfit: 200, margin: 0.40 },
    { maxProfit: 400, margin: 0.37 },
    { maxProfit: 500, margin: 0.35 },
    { maxProfit: 600, margin: 0.31 },
    { maxProfit: 900, margin: 0.27 },
    { maxProfit: null, margin: 0.27 }, // El último tramo se extiende como catch-all
  ],
  wholesaleDiscounts: [
    { minQty: 12, discount: 0.15 },
    { minQty: 6, discount: 0.10 },
    { minQty: 3, discount: 0.05 },
    { minQty: 2, discount: 0.025 },
  ]
};

let cachedFinancialConfig: FinancialConfig | null = null;
let financialConfigCachedAt = 0;

export async function getFinancialConfig(): Promise<FinancialConfig> {
  if (cachedFinancialConfig && Date.now() - financialConfigCachedAt < 60_000) {
    return cachedFinancialConfig;
  }

  const { data, error } = await db
    .from('app_config')
    .select('value')
    .eq('key', FINANCIAL_CONFIG_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return DEFAULT_FINANCIAL_CONFIG;
  }

  const parsed = financialConfigSchema.safeParse(data.value);
  if (!parsed.success) {
    console.error('Configuración financiera inválida en la BD:', parsed.error);
    return DEFAULT_FINANCIAL_CONFIG;
  }

  cachedFinancialConfig = parsed.data;
  financialConfigCachedAt = Date.now();
  return parsed.data;
}

export async function updateFinancialConfig(config: FinancialConfig): Promise<FinancialConfig> {
  financialConfigCachedAt = 0;
  const { error } = await db
    .from('app_config')
    .upsert({
      key: FINANCIAL_CONFIG_KEY,
      value: config as any,
    });

  if (error) {
    throw error;
  }

  return getFinancialConfig();
}

let cachedImageResources: ImageResources | null = null;
let imageResourcesCachedAt = 0;

export async function getImageResources(): Promise<ImageResources> {
  if (cachedImageResources && Date.now() - imageResourcesCachedAt < 60_000) {
    return cachedImageResources;
  }

  const { data, error } = await db
    .from('app_config')
    .select('value')
    .eq('key', IMAGE_RESOURCES_KEY)
    .maybeSingle();

  if (error) throw error;
  if (!data) return {};

  const result = imageResourcesSchema.safeParse(data.value);
  if (!result.success) return {};

  cachedImageResources = result.data;
  imageResourcesCachedAt = Date.now();
  return result.data;
}

export async function updateImageResources(payload: unknown): Promise<ImageResources> {
  imageResourcesCachedAt = 0;
  const config = imageResourcesSchema.parse(payload);

  const { error } = await db
    .from('app_config')
    .upsert({
      key: IMAGE_RESOURCES_KEY,
      value: config as any,
    });

  if (error) throw error;
  return config;
}
