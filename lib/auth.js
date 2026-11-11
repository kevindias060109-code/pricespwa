import { supabaseServer } from './supabase-server';
import { supabaseAdmin } from './supabase-admin';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function getSession() {
  const sb = supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data?.user) return null;
  const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
  if (!profile || !profile.active) return null;
  return { sb, user: data.user, profile };
}

export async function requireUser() {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'Nao autenticado');
  return s;
}
export async function requireAdmin() {
  const s = await requireUser();
  if (!['owner', 'admin'].includes(s.profile.role)) throw new HttpError(403, 'Sem permissao');
  return s;
}
export async function requireOwner() {
  const s = await requireUser();
  if (s.profile.role !== 'owner') throw new HttpError(403, 'Apenas o ADM principal');
  return s;
}
export const canPersonal = (p) => p.role === 'owner' || p.can_personal;
export const canBakery = (p) => ['owner', 'admin'].includes(p.role) || p.can_bakery;

export async function requireScope(scope) {
  const s = await requireUser();
  const ok = scope === 'personal' ? canPersonal(s.profile) : canBakery(s.profile);
  if (!ok) throw new HttpError(403, 'Sem acesso a este ambiente');
  return s;
}

export async function audit(userId, action, entity, entityId, detail) {
  try {
    await supabaseAdmin().from('audit_log').insert({ user_id: userId, action, entity, entity_id: entityId, detail });
  } catch (e) { console.error('audit', e.message); }
}

export function handleError(e) {
  const status = e.status || 500;
  if (status === 500) console.error(e);
  return Response.json({ error: status === 500 ? 'Erro interno' : e.message }, { status });
}
