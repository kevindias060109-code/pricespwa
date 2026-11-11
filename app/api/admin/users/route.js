import { requireAdmin, requireOwner, handleError, audit, HttpError } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    await requireAdmin();
    const admin = supabaseAdmin();
    const { data: profiles } = await admin.from('profiles').select('*').order('created_at');
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    const emails = Object.fromEntries((list?.users || []).map((u) => [u.id, u.email]));
    return Response.json(profiles.map((p) => ({ ...p, email: emails[p.id] })));
  } catch (e) { return handleError(e); }
}

// Alterar permissoes: SOMENTE o ADM principal.
export async function PATCH(req) {
  try {
    const { user } = await requireOwner();
    const b = await req.json();
    if (!b.id) throw new HttpError(400, 'id obrigatorio');
    if (b.id === user.id) throw new HttpError(400, 'Nao altere a propria conta aqui');
    const patch = {};
    if (['admin', 'personal', 'bakery'].includes(b.role)) patch.role = b.role;
    if (typeof b.can_personal === 'boolean') patch.can_personal = b.can_personal;
    if (typeof b.can_bakery === 'boolean') patch.can_bakery = b.can_bakery;
    if (typeof b.active === 'boolean') patch.active = b.active;
    const admin = supabaseAdmin();
    const { error } = await admin.from('profiles').update(patch).eq('id', b.id);
    if (error) throw new HttpError(400, error.message);
    if (patch.active === false) await admin.auth.admin.signOut(b.id, 'global').catch(() => {});
    await audit(user.id, 'update_permissions', 'profiles', b.id, patch);
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}
