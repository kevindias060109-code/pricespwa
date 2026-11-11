import { requireOwner, handleError, audit, HttpError } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ROLES = ['admin', 'personal', 'bakery'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  try {
    const { user } = await requireOwner(); // so o ADM principal convida
    const b = await req.json();
    const email = String(b.email || '').trim().toLowerCase();
    if (!EMAIL.test(email)) throw new HttpError(400, 'E-mail invalido');
    if (!ROLES.includes(b.role)) throw new HttpError(400, 'Perfil invalido');
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: String(b.full_name || '').slice(0, 120) },
      redirectTo: `${process.env.APP_URL}/definir-senha`,
    });
    if (error) throw new HttpError(400, error.message);
    const role = b.role;
    const { error: e2 } = await admin.from('profiles').update({
      role,
      full_name: String(b.full_name || '').slice(0, 120) || null,
      can_personal: role === 'personal' || !!b.can_personal,
      can_bakery: role === 'bakery' || role === 'admin' || !!b.can_bakery,
    }).eq('id', data.user.id);
    if (e2) throw new HttpError(500, e2.message);
    await audit(user.id, 'invite_user', 'profiles', data.user.id, { email, role });
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}
