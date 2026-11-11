-- =====================================================================
-- Etapa 3: configuracoes do app (chaves de integracoes cadastradas pela tela)
-- Rode no SQL Editor do Supabase DEPOIS da 001 e 002. Nada e apagado.
-- Os valores ficam CRIPTOGRAFADOS (AES-256-GCM) pelo servidor; o banco so
-- guarda texto cifrado. RLS ligado e SEM policies: somente o backend
-- (service role) le e escreve. Nem usuario logado enxerga esta tabela.
-- =====================================================================
create table if not exists public.app_settings (
  key text primary key,
  value_enc text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
