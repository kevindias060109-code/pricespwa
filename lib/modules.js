// Telas CRUD geradas por configuracao. O RLS do banco garante o acesso.
const T = 'text', N = 'number', D = 'date';
export const MODULES = {
  // ---------- Pessoal ----------
  contas: { scope: 'personal', title: 'Contas bancarias', table: 'p_accounts', fields: [
    { k: 'name', l: 'Nome', t: T, req: 1 }, { k: 'institution', l: 'Banco', t: T },
    { k: 'kind', l: 'Tipo', t: 'select', opts: ['checking', 'savings', 'cash', 'investment'] },
    { k: 'opening_balance', l: 'Saldo inicial', t: N }] },
  cartoes: { scope: 'personal', title: 'Cartoes', table: 'p_cards', fields: [
    { k: 'name', l: 'Nome', t: T, req: 1 }, { k: 'credit_limit', l: 'Limite', t: N },
    { k: 'closing_day', l: 'Dia fechamento', t: N }, { k: 'due_day', l: 'Dia vencimento', t: N }] },
  categorias: { scope: 'personal', title: 'Categorias', table: 'p_categories', fields: [
    { k: 'name', l: 'Nome', t: T, req: 1 }, { k: 'kind', l: 'Tipo', t: 'select', opts: ['income', 'expense'], req: 1 }] },
  lancamentos: { scope: 'personal', title: 'Receitas e despesas', table: 'p_transactions', order: 'occurred_on', fields: [
    { k: 'kind', l: 'Tipo', t: 'select', opts: ['income', 'expense'], req: 1 },
    { k: 'amount', l: 'Valor', t: N, req: 1 }, { k: 'description', l: 'Descricao', t: T },
    { k: 'occurred_on', l: 'Data', t: D, req: 1 },
    { k: 'account_id', l: 'Conta', t: 'ref', ref: 'p_accounts' },
    { k: 'card_id', l: 'Cartao', t: 'ref', ref: 'p_cards' },
    { k: 'category_id', l: 'Categoria', t: 'ref', ref: 'p_categories' },
    { k: 'invoice_month', l: 'Fatura (1o dia do mes)', t: D }] },
  contas_pagar_receber: { scope: 'personal', title: 'Contas a pagar / receber', table: 'p_bills', order: 'due_on', fields: [
    { k: 'direction', l: 'Tipo', t: 'select', opts: ['payable', 'receivable'], req: 1 },
    { k: 'description', l: 'Descricao', t: T, req: 1 }, { k: 'amount', l: 'Valor', t: N, req: 1 },
    { k: 'due_on', l: 'Vencimento', t: D, req: 1 },
    { k: 'status', l: 'Status', t: 'select', opts: ['open', 'paid', 'canceled'] }] },
  metas: { scope: 'personal', title: 'Metas', table: 'p_goals', fields: [
    { k: 'name', l: 'Meta', t: T, req: 1 }, { k: 'target_amount', l: 'Valor alvo', t: N, req: 1 },
    { k: 'current_amount', l: 'Valor atual', t: N }, { k: 'target_date', l: 'Data alvo', t: D }] },
  // ---------- Doceria ----------
  fornecedores: { scope: 'bakery', title: 'Fornecedores', table: 'b_suppliers', fields: [
    { k: 'name', l: 'Nome', t: T, req: 1 }, { k: 'phone', l: 'Telefone', t: T }, { k: 'notes', l: 'Obs', t: T }], phoneField: 'phone' },
  ingredientes: { scope: 'bakery', title: 'Estoque / ingredientes', table: 'b_ingredients', order: 'name', asc: true, fields: [
    { k: 'name', l: 'Nome', t: T, req: 1 }, { k: 'unit', l: 'Unidade', t: 'select', opts: ['g', 'kg', 'ml', 'l', 'un'], req: 1 },
    { k: 'min_stock', l: 'Estoque minimo', t: N }, { k: 'expires_on', l: 'Validade', t: D },
    { k: 'supplier_id', l: 'Fornecedor', t: 'ref', ref: 'b_suppliers' }],
    note: 'Quantidade e custo medio mudam por Movimentacoes (entrada/saida).', readonlyCols: ['quantity', 'avg_cost'] },
  movimentacoes: { scope: 'bakery', title: 'Movimentacoes de estoque', table: 'b_stock_movements', fields: [
    { k: 'ingredient_id', l: 'Ingrediente', t: 'ref', ref: 'b_ingredients', req: 1 },
    { k: 'kind', l: 'Tipo', t: 'select', opts: ['in', 'out', 'adjust'], req: 1 },
    { k: 'quantity', l: 'Quantidade (adjust aceita negativo)', t: N, req: 1 },
    { k: 'unit_cost', l: 'Custo unitario (entradas)', t: N }, { k: 'reason', l: 'Motivo', t: T }], noEdit: true },
  receitas: { scope: 'bakery', title: 'Receitas', table: 'b_recipes', fields: [
    { k: 'name', l: 'Nome', t: T, req: 1 },
    { k: 'category', l: 'Categoria', t: 'select', opts: ['doce', 'bolo', 'salgado', 'marmita', 'refeicao', 'outro'] },
    { k: 'yield_qty', l: 'Rendimento', t: N, req: 1 }, { k: 'yield_unit', l: 'Unid. rendimento', t: T },
    { k: 'prep_minutes', l: 'Tempo de preparo (min)', t: N },
    { k: 'packaging_cost', l: 'Embalagem (R$)', t: N }, { k: 'sale_price', l: 'Preco de venda', t: N }] },
  itens_receita: { scope: 'bakery', title: 'Ingredientes das receitas', table: 'b_recipe_items', fields: [
    { k: 'recipe_id', l: 'Receita', t: 'ref', ref: 'b_recipes', req: 1 },
    { k: 'ingredient_id', l: 'Ingrediente cadastrado', t: 'ref', ref: 'b_ingredients' },
    { k: 'free_name', l: 'OU nome livre (nao cadastrado)', t: T },
    { k: 'quantity', l: 'Quantidade', t: N, req: 1 },
    { k: 'unit', l: 'Unidade', t: 'select', opts: ['g', 'kg', 'ml', 'l', 'un'], req: 1 }] },
  clientes: { scope: 'bakery', title: 'Clientes', table: 'b_customers', fields: [
    { k: 'name', l: 'Nome', t: T, req: 1 }, { k: 'phone', l: 'Telefone', t: T },
    { k: 'address', l: 'Endereco', t: T }, { k: 'notes', l: 'Obs', t: T }], phoneField: 'phone' },
  encomendas: { scope: 'bakery', title: 'Encomendas', table: 'b_orders', order: 'delivery_date', fields: [
    { k: 'customer_id', l: 'Cliente', t: 'ref', ref: 'b_customers' },
    { k: 'delivery_date', l: 'Data de entrega', t: D, req: 1 }, { k: 'delivery_time', l: 'Horario (HH:MM)', t: T },
    { k: 'fulfillment', l: 'Retirada/Entrega', t: 'select', opts: ['pickup', 'delivery'] },
    { k: 'address', l: 'Endereco', t: T }, { k: 'total', l: 'Valor total', t: N },
    { k: 'amount_paid', l: 'Valor ja pago (opcional)', t: N }, { k: 'payment_due_on', l: 'Previsao de pagamento', t: D },
    { k: 'status', l: 'Status', t: 'select', opts: ['new', 'confirmed', 'in_production', 'ready', 'delivered', 'canceled'] },
    { k: 'notes', l: 'Obs', t: T }], phoneRef: 'customer_id' },
  itens_encomenda: { scope: 'bakery', title: 'Itens das encomendas', table: 'b_order_items', fields: [
    { k: 'order_id', l: 'Encomenda', t: 'ref', ref: 'b_orders', label: 'delivery_date' },
    { k: 'recipe_id', l: 'Receita', t: 'ref', ref: 'b_recipes' },
    { k: 'description', l: 'Descricao', t: T, req: 1 }, { k: 'quantity', l: 'Quantidade', t: N, req: 1 },
    { k: 'unit_price', l: 'Preco unitario', t: N, req: 1 }] },
  financeiro: { scope: 'bakery', title: 'Financeiro da doceria', table: 'b_transactions', order: 'occurred_on', fields: [
    { k: 'kind', l: 'Tipo', t: 'select', opts: ['income', 'expense'], req: 1 },
    { k: 'amount', l: 'Valor', t: N, req: 1 }, { k: 'description', l: 'Descricao', t: T },
    { k: 'category', l: 'Categoria', t: T }, { k: 'occurred_on', l: 'Data', t: D, req: 1 },
    { k: 'status', l: 'Status', t: 'select', opts: ['paid', 'pending'] },
    { k: 'supplier_id', l: 'Fornecedor', t: 'ref', ref: 'b_suppliers' },
    { k: 'order_id', l: 'Encomenda', t: 'ref', ref: 'b_orders', label: 'delivery_date' }] },
  compras: { scope: 'bakery', title: 'Lista de compras', table: 'b_shopping_list', fields: [
    { k: 'ingredient_id', l: 'Ingrediente cadastrado', t: 'ref', ref: 'b_ingredients' },
    { k: 'free_name', l: 'OU item nao cadastrado', t: T },
    { k: 'quantity', l: 'Quantidade', t: N }, { k: 'unit', l: 'Unidade', t: T },
    { k: 'done', l: 'Comprado?', t: 'select', opts: ['false', 'true'] }] },
};
