import { requireUser, requireScope, handleError, HttpError, audit } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
// Chamado apos o widget concluir: guarda o itemId e o ESCOPO (pessoal x empresarial).
export async function POST(req) {
  try {
    const { itemId, scope, institution } = await req.json();
    if (!['personal', 'business'].includes(scope) || !itemId) throw new HttpError(400, 'Dados invalidos');
    const { user } = await requireScope(scope === 'personal' ? 'personal' : 'bakery');
    const { error } = await supabaseAdmin().from('bank_connections').upsert(
      { user_id: user.id, scope, pluggy_item_id: String(itemId), institution: institution || null, status: 'connected' },
      { onConflict: 'pluggy_item_id' });
    if (error) throw new HttpError(500, error.message);
    await audit(user.id, 'bank_connected', 'bank_connections', String(itemId), { scope });
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}
