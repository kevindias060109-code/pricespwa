-- Rode DEPOIS de 001_schema_rls.sql.

-- Movimentacao atualiza quantidade e custo medio automaticamente.
create or replace function public.apply_stock_movement() returns trigger
language plpgsql as $$
declare cur record;
begin
  select quantity, avg_cost into cur from public.b_ingredients where id = new.ingredient_id for update;
  if new.kind = 'in' then
    update public.b_ingredients set
      avg_cost = case when new.unit_cost is null or (cur.quantity + new.quantity) <= 0 then cur.avg_cost
                 else ((greatest(cur.quantity,0) * cur.avg_cost) + (new.quantity * new.unit_cost)) / (greatest(cur.quantity,0) + new.quantity) end,
      quantity = cur.quantity + new.quantity
    where id = new.ingredient_id;
  elsif new.kind = 'out' then
    if cur.quantity - new.quantity < 0 then raise exception 'Estoque insuficiente'; end if;
    update public.b_ingredients set quantity = quantity - new.quantity where id = new.ingredient_id;
  else  -- adjust: quantidade e um delta (pode ser negativo)
    update public.b_ingredients set quantity = quantity + new.quantity where id = new.ingredient_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_stock_movement on public.b_stock_movements;
create trigger trg_stock_movement after insert on public.b_stock_movements
  for each row execute function public.apply_stock_movement();

-- Confirmacao de nota fiscal: tudo ou nada (financeiro + estoque + status).
create or replace function public.confirm_document(
  p_doc uuid, p_vendor text, p_issued date, p_total numeric, p_items jsonb
) returns void language plpgsql as $$
declare doc public.b_documents; it jsonb;
begin
  select * into doc from public.b_documents where id = p_doc for update;
  if not found then raise exception 'Documento nao encontrado'; end if;
  if doc.status <> 'pending' then raise exception 'Documento ja processado'; end if;
  insert into public.b_transactions(kind, amount, description, category, occurred_on, status, source, document_id)
    values ('expense', p_total, 'Compra: ' || coalesce(p_vendor, 'nota fiscal'), 'compras',
            coalesce(p_issued, current_date), 'paid', 'nota', p_doc);
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if nullif(it->>'ingredient_id', '') is not null then
      insert into public.b_stock_movements(ingredient_id, kind, quantity, unit_cost, reason, document_id)
        values ((it->>'ingredient_id')::uuid, 'in', (it->>'quantity')::numeric,
                nullif(it->>'unit_cost','')::numeric, 'compra (nota fiscal)', p_doc);
    end if;
  end loop;
  update public.b_documents set status = 'confirmed', vendor = p_vendor, issued_on = p_issued, total = p_total where id = p_doc;
end $$;

-- Storage privado para notas fiscais (apenas equipe da doceria).
insert into storage.buckets (id, name, public) values ('notas', 'notas', false) on conflict (id) do nothing;
drop policy if exists notas_team on storage.objects;
create policy notas_team on storage.objects for all
  using (bucket_id = 'notas' and public.has_bakery())
  with check (bucket_id = 'notas' and public.has_bakery());

-- Indices unicos NAO parciais: necessarios para o upsert da importacao bancaria
-- (NULLs sao distintos no Postgres, entao lancamentos manuais nao colidem).
create unique index if not exists p_tx_ext_full on public.p_transactions (user_id, source, external_id);
create unique index if not exists b_tx_ext_full on public.b_transactions (source, external_id);
