import { convert } from './units';

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + '01';
const clean = (s) => String(s || '').replace(/[%,()]/g, ' ').trim().slice(0, 80);

// Calcula consumo/custo de uma receita para "qty" unidades de rendimento.
async function recipeBreakdown(sb, name, qty) {
  const { data: recs } = await sb.from('b_recipes').select('*').ilike('name', `%${clean(name)}%`).limit(5);
  if (!recs?.length) return { error: `Receita "${name}" nao cadastrada.` };
  if (recs.length > 1) {
    const exact = recs.find((r) => r.name.toLowerCase() === String(name).toLowerCase());
    if (!exact) return { error: 'Mais de uma receita encontrada', options: recs.map((r) => r.name) };
    recs.splice(0, recs.length, exact);
  }
  const rec = recs[0];
  const { data: items } = await sb.from('b_recipe_items').select('*, b_ingredients(name,unit,quantity,avg_cost)').eq('recipe_id', rec.id);
  const factor = qty ? qty / Number(rec.yield_qty) : 1;
  let cost = 0; const missing_cost = [];
  const lines = (items || []).map((it) => {
    const ing = it.b_ingredients;
    const need = Number(it.quantity) * factor;
    const line = { ingrediente: ing?.name || it.free_name, necessario: r2(need * 1000) / 1000, unidade: it.unit };
    if (!ing) { line.obs = 'item nao cadastrado no estoque'; missing_cost.push(line.ingrediente); return line; }
    const inIngUnit = convert(need, it.unit, ing.unit);
    if (inIngUnit == null) { line.obs = 'unidade incompativel com o estoque'; missing_cost.push(ing.name); return line; }
    line.em_estoque = Number(ing.quantity); line.unidade_estoque = ing.unit;
    line.falta = Math.max(0, r2(inIngUnit - Number(ing.quantity)));
    if (Number(ing.avg_cost) > 0) { line.custo = r2(inIngUnit * Number(ing.avg_cost)); cost += line.custo; }
    else { line.obs = 'sem custo medio cadastrado'; missing_cost.push(ing.name); }
    return line;
  });
  const out_qty = qty || Number(rec.yield_qty);
  const packaging = Number(rec.packaging_cost) * (qty ? qty / Number(rec.yield_qty) : 1);
  const total = r2(cost + packaging);
  return {
    receita: rec.name, quantidade: out_qty, unidade: rec.yield_unit, itens: lines,
    custo_ingredientes: r2(cost), custo_embalagem: r2(packaging), custo_total: total,
    custo_por_unidade: r2(total / out_qty), preco_venda: rec.sale_price ? Number(rec.sale_price) : null,
    margem_por_unidade: rec.sale_price ? r2(Number(rec.sale_price) - total / out_qty) : null,
    custo_incompleto: missing_cost.length > 0, itens_sem_custo: missing_cost,
    aviso: missing_cost.length ? 'Custo parcial: faltam itens sem custo cadastrado.' : undefined,
  };
}

const range = { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD (exclusivo)' } };
const fn = (name, description, properties = {}, required = []) =>
  ({ type: 'function', name, description, parameters: { type: 'object', properties, required }, strict: false });

export function buildTools(scope, sb, pending) {
  const propose = async (tool, args, summary) => {
    const { data, error } = await sb.from('ai_pending_actions').insert({ scope, tool, args, summary }).select('id').single();
    if (error) throw new Error(error.message);
    pending.push({ id: data.id, summary });
    return { status: 'aguardando_confirmacao_do_usuario', id: data.id, aviso: 'Nada foi gravado ainda. O usuario precisa confirmar na tela.' };
  };

  if (scope === 'bakery') {
    const handlers = {
      async get_stock({ search, only_low }) {
        let q = sb.from('b_ingredients').select('name,unit,quantity,avg_cost,min_stock,expires_on').order('name').limit(200);
        if (search) q = q.ilike('name', `%${clean(search)}%`);
        const { data } = await q;
        return only_low ? data.filter((i) => Number(i.quantity) <= Number(i.min_stock)) : data;
      },
      async scale_recipe({ recipe_name, quantity }) { return recipeBreakdown(sb, recipe_name, Number(quantity)); },
      async recipe_cost({ recipe_name, quantity }) { return recipeBreakdown(sb, recipe_name, quantity ? Number(quantity) : null); },
      async spending({ text, from = monthStart(), to }) {
        let q = sb.from('b_transactions').select('occurred_on,amount,description,category,status').eq('kind', 'expense').gte('occurred_on', from).limit(500);
        if (to) q = q.lt('occurred_on', to);
        const t = clean(text);
        if (t) q = q.or(`description.ilike.%${t}%,category.ilike.%${t}%`);
        const { data } = await q;
        return { periodo_inicio: from, filtro: t || null, total: r2(data.reduce((a, r) => a + Number(r.amount), 0)), lancamentos: data.length, itens: data.slice(0, 30),
          aviso: 'Considera apenas lancamentos financeiros cuja descricao/categoria contem o termo.' };
      },
      async list_debtors() {
        const { data } = await sb.from('b_orders').select('delivery_date,total,amount_paid,payment_due_on,status,b_customers(name,phone)').neq('status', 'canceled').limit(500);
        const open = data.filter((o) => Number(o.total) - Number(o.amount_paid) > 0.009)
          .map((o) => ({ cliente: o.b_customers?.name || 'sem cliente', entrega: o.delivery_date, vence: o.payment_due_on, falta_receber: r2(Number(o.total) - Number(o.amount_paid)), status: o.status }));
        return { total_a_receber: r2(open.reduce((a, o) => a + o.falta_receber, 0)), encomendas: open };
      },
      async list_orders({ from = today(), to, status }) {
        let q = sb.from('b_orders').select('delivery_date,delivery_time,fulfillment,total,amount_paid,status,b_customers(name),b_order_items(description,quantity)').gte('delivery_date', from).order('delivery_date').limit(100);
        if (to) q = q.lt('delivery_date', to);
        if (status) q = q.eq('status', status);
        return (await q).data;
      },
      async revenue_summary({ from = monthStart(), to }) {
        let q = sb.from('b_transactions').select('kind,amount,category,status').gte('occurred_on', from).limit(2000);
        if (to) q = q.lt('occurred_on', to);
        const { data } = await q;
        const s = (k, f = () => true) => r2(data.filter((r) => r.kind === k && f(r)).reduce((a, r) => a + Number(r.amount), 0));
        const cats = {}; data.filter((r) => r.kind === 'expense').forEach((r) => { cats[r.category || 'sem categoria'] = r2((cats[r.category || 'sem categoria'] || 0) + Number(r.amount)); });
        return { periodo_inicio: from, faturamento: s('income'), despesas: s('expense'), lucro: r2(s('income') - s('expense')), pendente_a_receber: s('income', (r) => r.status === 'pending'), despesas_por_categoria: cats };
      },
      async top_profitable_recipes() {
        const { data: recs } = await sb.from('b_recipes').select('name').limit(100);
        const out = [];
        for (const r of recs) {
          const b = await recipeBreakdown(sb, r.name, null);
          if (b.error || b.preco_venda == null) continue;
          out.push({ receita: b.receita, custo_por_unidade: b.custo_por_unidade, preco_venda: b.preco_venda, margem_por_unidade: b.margem_por_unidade, custo_incompleto: b.custo_incompleto });
        }
        return out.sort((a, b) => b.margem_por_unidade - a.margem_por_unidade).slice(0, 15);
      },
      async add_shopping_items({ items }) {
        const list = (items || []).slice(0, 50).map((i) => ({ name: clean(i.name), quantity: i.quantity ?? null, unit: i.unit ?? null }));
        return propose('add_shopping_items', { items: list }, `Adicionar a lista de compras: ${list.map((i) => `${i.quantity ?? ''}${i.unit ?? ''} ${i.name}`.trim()).join('; ')}`);
      },
      async record_expense({ amount, description, category, date }) {
        const a = { amount: Number(amount), description: clean(description), category: clean(category) || null, date: date || today() };
        return propose('record_expense', a, `Registrar despesa da doceria: R$ ${a.amount.toFixed(2)} — ${a.description} (${a.date})`);
      },
    };
    const defs = [
      fn('get_stock', 'Consulta o estoque real.', { search: { type: 'string' }, only_low: { type: 'boolean', description: 'so itens no estoque minimo ou abaixo' } }),
      fn('scale_recipe', 'Calcula ingredientes necessarios para produzir X unidades/porcoes/marmitas de uma receita cadastrada e compara com o estoque.', { recipe_name: { type: 'string' }, quantity: { type: 'number' } }, ['recipe_name', 'quantity']),
      fn('recipe_cost', 'Custo total, custo por unidade e margem de uma receita cadastrada.', { recipe_name: { type: 'string' }, quantity: { type: 'number' } }, ['recipe_name']),
      fn('spending', 'Soma despesas da doceria filtrando por termo (ex.: chocolate) e periodo.', { text: { type: 'string' }, ...range }),
      fn('list_debtors', 'Encomendas com valor ainda a receber e os clientes devedores.'),
      fn('list_orders', 'Consulta encomendas a partir de uma data.', { ...range, status: { type: 'string' } }),
      fn('revenue_summary', 'Faturamento, despesas, lucro e pendencias no periodo.', range),
      fn('top_profitable_recipes', 'Ranking de receitas por margem de lucro por unidade.'),
      fn('add_shopping_items', 'PROPÕE itens para a lista de compras (exige confirmacao do usuario). Pode incluir itens de receitas nao cadastradas.', { items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' } }, required: ['name'] } } }, ['items']),
      fn('record_expense', 'PROPÕE o registro de uma despesa (exige confirmacao do usuario).', { amount: { type: 'number' }, description: { type: 'string' }, category: { type: 'string' }, date: { type: 'string' } }, ['amount', 'description']),
    ];
    return { defs, handlers };
  }

  // ---------- pessoal ----------
  const handlers = {
    async balances() {
      const { data: accs } = await sb.from('p_accounts').select('id,name,opening_balance');
      const { data: tx } = await sb.from('p_transactions').select('account_id,kind,amount').not('account_id', 'is', null).limit(5000);
      return accs.map((a) => ({ conta: a.name, saldo: r2(Number(a.opening_balance) + tx.filter((t) => t.account_id === a.id).reduce((s, t) => s + (t.kind === 'income' ? 1 : -1) * Number(t.amount), 0)) }));
    },
    async summary({ from = monthStart(), to }) {
      let q = sb.from('p_transactions').select('kind,amount,p_categories(name)').gte('occurred_on', from).limit(3000);
      if (to) q = q.lt('occurred_on', to);
      const { data } = await q; const cats = {};
      data.filter((t) => t.kind === 'expense').forEach((t) => { const c = t.p_categories?.name || 'sem categoria'; cats[c] = r2((cats[c] || 0) + Number(t.amount)); });
      const s = (k) => r2(data.filter((t) => t.kind === k).reduce((a, t) => a + Number(t.amount), 0));
      return { periodo_inicio: from, receitas: s('income'), despesas: s('expense'), saldo_periodo: r2(s('income') - s('expense')), despesas_por_categoria: cats };
    },
    async upcoming_bills({ days = 30 }) {
      const limit = new Date(Date.now() + Number(days) * 864e5).toISOString().slice(0, 10);
      return (await sb.from('p_bills').select('direction,description,amount,due_on').eq('status', 'open').lte('due_on', limit).order('due_on').limit(100)).data;
    },
    async goals() { return (await sb.from('p_goals').select('name,target_amount,current_amount,target_date')).data; },
    async record_transaction({ kind, amount, description, date }) {
      const a = { kind, amount: Number(amount), description: clean(description), date: date || today() };
      return propose('record_transaction', a, `Registrar ${kind === 'income' ? 'receita' : 'despesa'} pessoal: R$ ${a.amount.toFixed(2)} — ${a.description} (${a.date})`);
    },
  };
  const defs = [
    fn('balances', 'Saldo atual por conta (saldo inicial + lancamentos).'),
    fn('summary', 'Receitas, despesas e despesas por categoria no periodo.', range),
    fn('upcoming_bills', 'Contas a pagar/receber em aberto nos proximos N dias.', { days: { type: 'number' } }),
    fn('goals', 'Metas e progresso.'),
    fn('record_transaction', 'PROPÕE registrar receita/despesa (exige confirmacao).', { kind: { type: 'string', enum: ['income', 'expense'] }, amount: { type: 'number' }, description: { type: 'string' }, date: { type: 'string' } }, ['kind', 'amount', 'description']),
  ];
  return { defs, handlers };
}

export const INSTRUCTIONS = (scope) => `Voce e o assistente ${scope === 'bakery' ? 'da doceria' : 'financeiro pessoal'} do usuario. Responda em portugues do Brasil, de forma direta. Hoje e ${today()}.
REGRAS:
- Use SEMPRE as ferramentas para obter dados reais. Nunca invente estoque, precos, receitas, clientes ou valores.
- Se a ferramenta nao trouxer o dado (receita nao cadastrada, sem custo), diga isso claramente. Se precisar estimar, rotule como "ESTIMATIVA (nao confirmada)" e explique a base.
- Mostre valores em R$ e deixe claro o periodo considerado.
- Para gravar algo, use apenas as ferramentas de proposta; elas NAO gravam, o usuario confirma na tela. Nunca diga que algo foi salvo antes da confirmacao.
- Para receitas nao cadastradas, ajude com uma estimativa de ingredientes rotulada como estimativa e ofereca propor itens para a lista de compras.`;
