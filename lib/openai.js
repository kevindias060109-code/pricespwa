import OpenAI from 'openai';
import { getSettings } from './settings';
import { HttpError } from './auth';

// Cliente OpenAI usando a chave salva na tela de Configuracoes (ou a variavel de ambiente).
export async function getOpenAI() {
  const s = await getSettings(['OPENAI_API_KEY', 'OPENAI_MODEL']);
  if (!s.OPENAI_API_KEY.value) {
    throw new HttpError(503, 'IA nao configurada. Peca ao ADM principal para cadastrar a chave em Configuracoes.');
  }
  return { openai: new OpenAI({ apiKey: s.OPENAI_API_KEY.value }), model: s.OPENAI_MODEL.value };
}
