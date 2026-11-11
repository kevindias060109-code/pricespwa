import { supabaseAdmin } from './supabase-admin';
import { encrypt, decrypt } from './crypto';

// Configuracoes que podem ser cadastradas pela tela. Supabase NAO entra aqui de proposito:
// o app precisa da URL/chave dele para conseguir ler qualquer coisa do banco (ver README).
export const SETTINGS = {
  OPENAI_API_KEY: { label: 'Chave da OpenAI', secret: true },
  OPENAI_MODEL: { label: 'Modelo da OpenAI', secret: false, fallback: 'gpt-4.1-mini' },
  PLUGGY_CLIENT_ID: { label: 'Pluggy Client ID', secret: true },
  PLUGGY_CLIENT_SECRET: { label: 'Pluggy Client Secret', secret: true },
};

// Ordem de prioridade: valor salvo na tela > variavel de ambiente > padrao.
// Se a tabela ainda nao existir (migracao 003 nao rodada), cai nas variaveis de ambiente.
export async function getSettings(keys) {
  let rows = [];
  let tableError = null;
  const { data, error } = await supabaseAdmin().from('app_settings').select('key,value_enc').in('key', keys);
  if (error) { tableError = error.message; console.error('app_settings:', error.message); } else rows = data || [];

  const out = {};
  for (const k of keys) {
    let value = null, source = null, broken = false;
    const row = rows.find((r) => r.key === k);
    if (row) {
      try { value = decrypt(row.value_enc, k); source = 'tela'; }
      catch (e) { broken = true; console.error(`app_settings ${k}: falha ao descriptografar (${e.message})`); }
    }
    if (!value && process.env[k]) { value = process.env[k]; source = 'env'; }
    if (!value && SETTINGS[k]?.fallback) { value = SETTINGS[k].fallback; source = 'padrao'; }
    out[k] = { value, source, broken };
  }
  Object.defineProperty(out, 'tableError', { value: tableError, enumerable: false });
  return out;
}

export async function setSetting(key, value, userId) {
  if (!SETTINGS[key]) throw new Error('Configuracao desconhecida');
  const { error } = await supabaseAdmin().from('app_settings').upsert(
    { key, value_enc: encrypt(value, key), updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

export async function deleteSetting(key) {
  if (!SETTINGS[key]) throw new Error('Configuracao desconhecida');
  const { error } = await supabaseAdmin().from('app_settings').delete().eq('key', key);
  if (error) throw new Error(error.message);
}

// Mostra so o final do segredo; nunca devolve o valor completo ao navegador.
export function mask(value, secret) {
  if (!value) return null;
  if (!secret) return value;
  return value.length <= 8 ? '••••' : `••••${value.slice(-4)}`;
}
