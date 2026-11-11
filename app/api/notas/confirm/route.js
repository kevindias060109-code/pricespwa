import { requireScope, handleError, HttpError, audit } from '@/lib/auth';

export async function POST(req) {
  try {
    const { sb, user } = await requireScope('bakery');
    const b = await req.json();
    const total = Number(b.total);
    if (!b.id || !(total > 0)) throw new HttpError(400, 'Documento e total validos sao obrigatorios');
    if (b.reject) {
      await sb.from('b_documents').update({ status: 'rejected' }).eq('id', b.id).eq('status', 'pending');
      return Response.json({ ok: true });
    }
    const items = (b.items || []).filter((i) => i.ingredient_id && Number(i.quantity) > 0).map((i) => ({
      ingredient_id: i.ingredient_id, quantity: Number(i.quantity), unit_cost: i.unit_cost == null ? null : Number(i.unit_cost),
    }));
    const { error } = await sb.rpc('confirm_document', {
      p_doc: b.id, p_vendor: b.vendor || null, p_issued: b.issued_on || null, p_total: total, p_items: items,
    });
    if (error) throw new HttpError(error.code === '23505' ? 409 : 400, error.code === '23505' ? 'Nota ja lancada no financeiro.' : error.message);
    await audit(user.id, 'nota_confirmed', 'b_documents', b.id, { total, itens_estoque: items.length });
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}
