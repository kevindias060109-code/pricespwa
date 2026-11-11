import { requireUser, handleError, HttpError, audit } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { pluggyKey, pluggyGet } from '@/lib/pluggy';

// Importa movimentacoes sem duplicar (indice unico em external_id).
export async function POST(req) {
  try {
    const { sb, user } = await requireUser();
    const { connectionId } = await req.json();
    const { data: conn } = await sb.from('bank_connections').select('*').eq('id', connectionId).single(); // RLS
    if (!conn) throw new HttpError(404, 'Conexao nao encontrada');
    const key = await pluggyKey();
    const { results: accounts } = await pluggyGet(`/accounts?itemId=${encodeURIComponent(conn.pluggy_item_id)}`, key);
    const admin = supabaseAdmin();
    let imported = 0;
    for (const acc of accounts) {
      const { results: txs } = await pluggyGet(`/transactions?accountId=${acc.id}&pageSize=500`, key);
      const rows = txs.map((t) => {
        const amount = Math.abs(Number(t.amount));
        const income = t.type ? t.type === 'CREDIT' : Number(t.amount) > 0;
        const base = { kind: income ? 'income' : 'expense', amount, description: t.description, occurred_on: String(t.date).slice(0, 10), source: 'pluggy', external_id: t.id };
        return conn.scope === 'personal' ? { ...base, user_id: conn.user_id } : { ...base, status: 'paid', created_by: user.id };
      }).filter((r) => r.amount > 0);
      if (!rows.length) continue;
      const table = conn.scope === 'personal' ? 'p_transactions' : 'b_transactions';
      const onConflict = conn.scope === 'personal' ? 'user_id,source,external_id' : 'source,external_id';
      const { data } = await admin.from(table).upsert(rows, { onConflict, ignoreDuplicates: true }).select('id');
      imported += data?.length || 0;
    }
    await admin.from('bank_connections').update({ last_sync_at: new Date().toISOString() }).eq('id', conn.id);
    await audit(user.id, 'bank_sync', 'bank_connections', conn.id, { imported });
    return Response.json({ ok: true, imported, saldos: accounts.map((a) => ({ conta: a.name, saldo: a.balance })) });
  } catch (e) { return handleError(e); }
}
