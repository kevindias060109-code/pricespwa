import { createClient } from '@supabase/supabase-js';
// Cliente com a SECRET KEY: ignora RLS. Usar so em rotas de servidor,
// SEMPRE depois de validar permissao (requireOwner/requireAdmin).
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
