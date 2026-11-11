-- =====================================================================
-- PWA Doceria + Financeiro Pessoal  |  Etapa 1: esquema + RLS
-- Rode no SQL Editor do Supabase. REVISE antes: se o projeto já tem
-- tabelas, NÃO rode às cegas. Tudo usa "if not exists" e nada é apagado.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Perfis e permissões ----------
do $$ begin
  create type app_role as enum ('owner','admin','personal','bakery');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role app_role not null default 'personal',
  can_personal boolean not null default false,
  can_bakery boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Funções auxiliares (security definer evita recursão de RLS)
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active and role = 'owner' from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active and role in ('owner','admin') from profiles where id = auth.uid()), false)
$$;

create or replace function public.has_personal() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active and (can_personal or role = 'owner') from profiles where id = auth.uid()), false)
$$;

create or replace function public.has_bakery() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active and (can_bakery or role in ('owner','admin')) from profiles where id = auth.uid()), false)
$$;

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_update on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());
-- Usuário comum só edita o próprio nome (nunca role/permissões):
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
-- Alterações de role/permissões/active: SOMENTE pelo backend (service role),
-- após validar is_owner() no servidor.
-- Não há policy de INSERT/DELETE: contas são criadas só via convite no backend.

-- ---------- Auditoria ----------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  entity text,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select using (public.is_admin());
-- Escrita somente pelo backend (service role).

-- =====================================================================
-- FINANCEIRO PESSOAL (isolado por usuário; nem admin enxerga o de outro)
-- =====================================================================
create table if not exists public.p_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  kind text not null default 'checking' check (kind in ('checking','savings','cash','investment')),
  opening_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.p_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  credit_limit numeric(14,2),
  closing_day smallint check (closing_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists public.p_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  unique (user_id, name, kind)
);

create table if not exists public.p_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid references public.p_accounts(id) on delete set null,
  card_id uuid references public.p_cards(id) on delete set null,
  category_id uuid references public.p_categories(id) on delete set null,
  kind text not null check (kind in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  description text,
  occurred_on date not null,
  invoice_month date,               -- fatura (1º dia do mês) quando for cartão
  source text not null default 'manual' check (source in ('manual','pluggy','import')),
  external_id text,                 -- id da transação no banco/Pluggy
  created_at timestamptz not null default now()
);
-- Prevenção de duplicidade na importação bancária:
create unique index if not exists p_tx_external_uq
  on public.p_transactions (user_id, source, external_id) where external_id is not null;

create table if not exists public.p_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  direction text not null check (direction in ('payable','receivable')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  due_on date not null,
  status text not null default 'open' check (status in ('open','paid','canceled')),
  settled_transaction_id uuid references public.p_transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.p_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0,
  target_date date,
  created_at timestamptz not null default now()
);

-- RLS pessoal: dono dos dados + permissão can_personal
do $$
declare t text;
begin
  foreach t in array array['p_accounts','p_cards','p_categories','p_transactions','p_bills','p_goals']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy %I on public.%I for all
      using (user_id = auth.uid() and public.has_personal())
      with check (user_id = auth.uid() and public.has_personal())$p$, t || '_own', t);
  end loop;
end $$;

-- =====================================================================
-- DOCERIA (compartilhado entre usuários com can_bakery)
-- =====================================================================
create table if not exists public.b_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.b_ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null check (unit in ('g','kg','ml','l','un')),
  quantity numeric(14,3) not null default 0,
  avg_cost numeric(14,4) not null default 0,   -- custo médio por unidade
  min_stock numeric(14,3) not null default 0,
  expires_on date,
  supplier_id uuid references public.b_suppliers(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.b_stock_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.b_ingredients(id) on delete cascade,
  kind text not null check (kind in ('in','out','adjust')),
  quantity numeric(14,3) not null,
  unit_cost numeric(14,4),
  reason text,                                  -- compra, produção, perda, ajuste
  document_id uuid,                             -- nota fiscal de origem, se houver
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.b_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'doce' check (category in ('doce','bolo','salgado','marmita','refeicao','outro')),
  yield_qty numeric(10,2) not null check (yield_qty > 0),
  yield_unit text not null default 'un',
  prep_minutes int,
  packaging_cost numeric(14,2) not null default 0,
  sale_price numeric(14,2),
  created_at timestamptz not null default now()
);

create table if not exists public.b_recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.b_recipes(id) on delete cascade,
  ingredient_id uuid references public.b_ingredients(id) on delete restrict,
  free_name text,                               -- item ainda não cadastrado
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null,
  check (ingredient_id is not null or free_name is not null)
);

create table if not exists public.b_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.b_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.b_customers(id) on delete set null,
  delivery_date date not null,
  delivery_time time,
  fulfillment text not null default 'pickup' check (fulfillment in ('pickup','delivery')),
  address text,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,  -- sinal/entrada NÃO é obrigatório
  payment_due_on date,
  status text not null default 'new' check (status in ('new','confirmed','in_production','ready','delivered','canceled')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.b_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.b_orders(id) on delete cascade,
  recipe_id uuid references public.b_recipes(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null check (quantity > 0),
  unit_price numeric(14,2) not null
);

create table if not exists public.b_documents (   -- notas fiscais lidas por IA
  id uuid primary key default gen_random_uuid(),
  storage_path text,
  file_hash text not null unique,                 -- detecta arquivo repetido
  access_key text unique,                         -- chave da NF-e, se existir
  vendor text,
  issued_on date,
  total numeric(14,2),
  extracted jsonb,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.b_transactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  description text,
  category text,
  supplier_id uuid references public.b_suppliers(id) on delete set null,
  order_id uuid references public.b_orders(id) on delete set null,
  document_id uuid references public.b_documents(id) on delete set null,
  occurred_on date not null,
  status text not null default 'paid' check (status in ('pending','paid')),
  source text not null default 'manual' check (source in ('manual','pluggy','nota','order')),
  external_id text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists b_tx_external_uq
  on public.b_transactions (source, external_id) where external_id is not null;
create unique index if not exists b_tx_document_uq
  on public.b_transactions (document_id) where document_id is not null;
create unique index if not exists b_tx_order_uq
  on public.b_transactions (order_id, occurred_on, amount) where order_id is not null;

create table if not exists public.b_shopping_list (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid references public.b_ingredients(id) on delete set null,
  free_name text,
  quantity numeric(14,3),
  unit text,
  origin text not null default 'manual' check (origin in ('manual','auto','ai')),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  check (ingredient_id is not null or free_name is not null)
);

-- Ações propostas pela IA que aguardam confirmação humana
create table if not exists public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope text not null check (scope in ('personal','bakery')),
  tool text not null,
  args jsonb not null,
  summary text not null,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','expired')),
  created_at timestamptz not null default now()
);
alter table public.ai_pending_actions enable row level security;
create policy ai_pending_own on public.ai_pending_actions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RLS doceria
do $$
declare t text;
begin
  foreach t in array array['b_suppliers','b_ingredients','b_stock_movements','b_recipes',
    'b_recipe_items','b_customers','b_orders','b_order_items','b_documents',
    'b_transactions','b_shopping_list']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy %I on public.%I for all
      using (public.has_bakery()) with check (public.has_bakery())$p$, t || '_team', t);
  end loop;
end $$;

-- =====================================================================
-- Open Finance (Pluggy) — separa conta pessoal de empresarial
-- =====================================================================
create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope text not null check (scope in ('personal','business')),
  pluggy_item_id text not null unique,
  institution text,
  last_sync_at timestamptz,
  status text,
  created_at timestamptz not null default now()
);
alter table public.bank_connections enable row level security;
create policy bank_conn_own on public.bank_connections for select
  using (user_id = auth.uid()
         and ((scope = 'personal' and public.has_personal())
           or (scope = 'business' and public.has_bakery())));
-- Criação/atualização somente pelo backend (service role).

-- ---------- Gatilho: cria profile sem permissões ao convidar ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Depois de criar SUA conta, promova-a a ADM principal (uma única vez):
-- update public.profiles set role='owner', can_personal=true, can_bakery=true
--   where id = '<SEU_USER_ID>';
