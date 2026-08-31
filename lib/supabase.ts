/**
 * lib/supabase.ts
 * Cliente Supabase para uso 100% client-side (GitHub Pages / SPA estático).
 *
 * IMPORTANTE: se NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY
 * não estiverem preenchidas no momento do build (ex: Secrets ainda não
 * configuradas no GitHub), o app NÃO deve quebrar com tela branca. Em vez
 * disso, usamos valores de fallback válidos (mas inertes) e expomos
 * `isSupabaseConfigured` para a UI avisar o usuário.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_ANON_KEY = 'placeholder-anon-key-not-configured';

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Verdadeiro somente quando as duas variáveis de ambiente foram de fato preenchidas. */
export const isSupabaseConfigured: boolean = Boolean(
  envUrl && envUrl.trim().length > 0 && envAnonKey && envAnonKey.trim().length > 0,
);

const supabaseUrl = envUrl && envUrl.trim().length > 0 ? envUrl : FALLBACK_URL;
const supabaseAnonKey =
  envAnonKey && envAnonKey.trim().length > 0 ? envAnonKey : FALLBACK_ANON_KEY;

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  // Aviso apenas no console do navegador; não interrompe a renderização.
  // eslint-disable-next-line no-console
  console.warn(
    '[kayG CPA] Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY nas Secrets do repositório para habilitar login e dados.',
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Mantém a sessão viva em localStorage para o usuário não deslogar
      // ao fechar a aba do navegador no celular.
      persistSession: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'kayg-cpa-auth',
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },
);
