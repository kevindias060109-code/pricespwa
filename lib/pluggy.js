import { getSettings } from './settings';
import { HttpError } from './auth';

const BASE = 'https://api.pluggy.ai';
export async function pluggyKey() {
  const s = await getSettings(['PLUGGY_CLIENT_ID', 'PLUGGY_CLIENT_SECRET']);
  const clientId = s.PLUGGY_CLIENT_ID.value, clientSecret = s.PLUGGY_CLIENT_SECRET.value;
  if (!clientId || !clientSecret) throw new HttpError(503, 'Pluggy nao configurado. Peca ao ADM principal para cadastrar em Configuracoes.');
  const r = await fetch(`${BASE}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }) });
  if (!r.ok) throw new HttpError(502, 'Falha na autenticacao Pluggy (confira Client ID e Secret em Configuracoes)');
  return (await r.json()).apiKey;
}
export async function pluggyGet(path, key) {
  const r = await fetch(`${BASE}${path}`, { headers: { 'X-API-KEY': key } });
  if (!r.ok) throw new Error(`Pluggy ${r.status}`);
  return r.json();
}
export async function pluggyConnectToken(key) {
  const r = await fetch(`${BASE}/connect_token`, { method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok) throw new Error('Falha ao criar connect token');
  return (await r.json()).accessToken;
}
