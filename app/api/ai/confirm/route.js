import { requireUser, handleError, HttpError, audit, canBakery, canPersonal } from '@/lib/auth';

const today = () => new Date().toISOString().slice(0, 10);

export async function POST(req) {
  try {
    const { sb, user, profile } = await requireUser();
    const { id, reject } = await req.json();
    const { data: act } = await sb.from('ai_pending_actions').select('*').eq('id', id).single(); // RLS: so as proprias
    if (!act || act.status !== 'pending') throw new HttpError(404, 'Acao nao encontrada ou ja processada');
    const allowed = act.scope === 'bakery' ? canBakery(profile) : canPersonal(profile);
    if (!allowed) throw new HttpError(403, 'Sem permissao');
    if (reject) {
      await sb.from('ai_pending_actions').update({ status: 'rejected' }).eq('id', id);
      return Response.json({ ok: true });
    }
    const a = act.args;
    if (act.tool === 'add_shopping_items') {
      const { error } = await sb.from('b_shopping_list').insert(a.items.map((i) => ({ free_name: i.name, quantity: i.quantity, unit: i.unit, origin: 'ai' })));
      if (error) throw new HttpError(400, error.message);
    } else if (act.tool === 'record_expense') {
      const { data: dup } = await sb.from('b_transactions').select('id').eq('kind', 'expense').eq('amount', a.amount).eq('occurred_on', a.date).ilike('description', a.description).limit(1);
      if (dup?.length) throw new HttpError(409, 'Lancamento igual ja existe (duplicidade evitada).');
      const { error } = await sb.from('b_transactions').insert({ kind: 'expense', amount: a.amount, description: a.description, category: a.category, occurred_on: a.date || today(), source: 'manual' });
      if (error) throw new HttpError(400, error.message);
    } else if (act.tool === 'record_transaction') {
      const { data: dup } = await sb.from('p_transactions').select('id').eq('kind', a.kind).eq('amount', a.amount).eq('occurred_on', a.date).ilike('description', a.description).limit(1);
      if (dup?.length) throw new HttpError(409, 'Lancamento igual ja existe (duplicidade evitada).');
      const { error } = await sb.from('p_transactions').insert({ kind: a.kind, amount: a.amount, description: a.description, occurred_on: a.date || today() });
      if (error) throw new HttpError(400, error.message);
    } else throw new HttpError(400, 'Acao desconhecida');
    await sb.from('ai_pending_actions').update({ status: 'confirmed' }).eq('id', id);
    await audit(user.id, 'ai_action_confirmed', act.scope, id, { tool: act.tool, args: a });
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}
