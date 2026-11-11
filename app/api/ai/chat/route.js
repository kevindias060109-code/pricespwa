import { getOpenAI } from '@/lib/openai';
import { requireScope, handleError, HttpError, audit } from '@/lib/auth';
import { buildTools, INSTRUCTIONS } from '@/lib/ai-tools';

export const maxDuration = 60;

export async function POST(req) {
  try {
    const { scope, messages } = await req.json();
    if (!['bakery', 'personal'].includes(scope)) throw new HttpError(400, 'Escopo invalido');
    const { sb, user } = await requireScope(scope); // checa permissao no servidor
    if (!Array.isArray(messages) || !messages.length) throw new HttpError(400, 'Mensagens obrigatorias');
    let input = messages.slice(-20).map((m) => {
      if (!['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') throw new HttpError(400, 'Mensagem invalida');
      return { role: m.role, content: m.content.slice(0, 4000) };
    });
    const pending = [];
    const { defs, handlers } = buildTools(scope, sb, pending); // sb = sessao do usuario => RLS
    const { openai, model } = await getOpenAI(); // chave/modelo vindos de Configuracoes

    for (let i = 0; i < 6; i++) {
      const resp = await openai.responses.create({ model, instructions: INSTRUCTIONS(scope), input, tools: defs, store: false });
      const calls = resp.output.filter((o) => o.type === 'function_call');
      if (!calls.length) {
        await audit(user.id, 'ai_chat', scope, null, { pending: pending.map((p) => p.id) });
        return Response.json({ reply: resp.output_text, pending });
      }
      input = [...input, ...resp.output];
      for (const c of calls) {
        let out;
        try {
          if (!handlers[c.name]) throw new Error('ferramenta desconhecida');
          out = await handlers[c.name](JSON.parse(c.arguments || '{}'));
        } catch (e) { out = { error: e.message }; }
        input.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(out).slice(0, 30000) });
      }
    }
    return Response.json({ reply: 'Nao consegui concluir a consulta. Tente reformular a pergunta.', pending });
  } catch (e) { return handleError(e); }
}
