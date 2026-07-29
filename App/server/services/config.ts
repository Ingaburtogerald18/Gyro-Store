import { config } from '../config';

export interface PublicConfig {
  currency: typeof config.currency;
  exchangeRate: typeof config.exchangeRate;
  whatsapp: typeof config.whatsapp;
  categories: typeof config.categories;
}

// Devuelve únicamente la configuración segura para ser consumida por el cliente
export function getPublicConfig(): PublicConfig {
  return {
    currency: config.currency,
    exchangeRate: config.exchangeRate,
    whatsapp: config.whatsapp,
    categories: config.categories,
  };
}