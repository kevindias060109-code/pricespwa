import OpenAI from 'openai';
import { requireOwner, handleError, HttpError, audit } from '@/lib/auth';
import { SETTINGS, getSettings, setSetting, deleteSetting, mask } from '@/lib/settings';
import { cryptoReady } from '@/lib/crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { pluggyKey } from '@/lib/pluggy';

const KEYS = Object.keys(SETTINGS);

// Status das configuracoes. NUNCA devolve o valor completo de um segredo.
export async function GET() {
  try {
    await requireOwner();
    const s = await getSettings(KEYS);
    return Response.json({
      encryptionReady: cryptoReady(),
      migrationReady: !s.tableError,
      supabaseEnv: {
        url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        publishable: !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        secret: !!process.env.SUPABASE_SECRET_KEY,
      },
      items: KEYS.map((k) => ({
        key: k, label: SETTINGS[k].label, secret: SETTINGS[k].secret,
        configured: !!s[k].value, source: s[k].source, broken: s[k].broken,
        preview: mask(s[k].value, SETTINGS[k].secret),
      })),
    });
  } catch (e) { return handleError(e); }
}

function validate(key, raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) throw new HttpError(400, 'Informe um valor');
  if (value.length > 500 || /\s/.test(value)) throw new HttpError(400, 'Valor invalido (sem espacos ou quebras de linha)');
  if (key === 'OPENAI_API_KEY' && !value.startsWith('sk-')) throw new HttpError(400, 'A chave da OpenAI comeca com "sk-"');
  if (key === 'OPENAI_MODEL' && !/^[\w.:-]+$/.test(value)) throw new HttpError(400, 'Nome de modelo invalido');
  return value;
}

export async function PUT(req) {
  try {
    const { user } = await requireOwner();
    if (!cryptoReady()) throw new HttpError(500, 'Falta a variavel SETTINGS_ENCRYPTION_KEY no servidor (veja o README).');
    const { key, value } = await req.json();
    if (!SETTINGS[key]) throw new HttpError(400, 'Configuracao desconhecida');
    await setSetting(key, validate(key, value), user.id);
    await audit(user.id, 'setting_updated', 'app_settings', key, null); // nunca grava o valor
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}

// Remove o valor salvo na tela (volta a valer a variavel de ambiente, se existir).
export async function DELETE(req) {
  try {
    const { user } = await requireOwner();
    const { key } = await req.json();
    if (!SETTINGS[key]) throw new HttpError(400, 'Configuracao desconhecida');
    await deleteSetting(key);
    await audit(user.id, 'setting_removed', 'app_settings', key, null);
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}

// Teste de conexao sem gastar tokens. Responde 200 com { ok, message } para a tela mostrar.
export async function POST(req) {
  try {
    await requireOwner();
    const { target } = await req.json();
    try {
      if (target === 'openai') {
        const s = await getSettings(['OPENAI_API_KEY', 'OPENAI_MODEL']);
        if (!s.OPENAI_API_KEY.value) return Response.json({ ok: false, message: 'Chave da OpenAI nao cadastrada.' });
        await new OpenAI({ apiKey: s.OPENAI_API_KEY.value }).models.retrieve(s.OPENAI_MODEL.value);
        return Response.json({ ok: true, message: `OpenAI conectada. Modelo "${s.OPENAI_MODEL.value}" disponivel.` });
      }
      if (target === 'pluggy') {
        await pluggyKey();
        return Response.json({ ok: true, message: 'Pluggy autenticada com sucesso.' });
      }
      if (target === 'supabase') {
        const { error } = await supabaseAdmin().from('profiles').select('id', { count: 'exact', head: true });
        if (error) return Response.json({ ok: false, message: `Supabase respondeu com erro: ${error.message}` });
        return Response.json({ ok: true, message: 'Supabase conectado (chave secreta funcionando).' });
      }
    } catch (e) {
      const status = e?.status;
      const message = target === 'openai'
        ? status === 401 ? 'A OpenAI recusou a chave (confira se esta correta e ativa).'
          : status === 404 ? 'Chave valida, mas o modelo informado nao existe para esta conta.'
          : 'Nao foi possivel falar com a OpenAI. Tente de novo.'
        : e instanceof HttpError ? e.message : 'Falha no teste de conexao.';
      return Response.json({ ok: false, message });
    }
    throw new HttpError(400, 'Alvo de teste invalido');
  } catch (e) { return handleError(e); }
}
