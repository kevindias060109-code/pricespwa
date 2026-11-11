import { getOpenAI } from '@/lib/openai';
import crypto from 'crypto';
import { requireScope, handleError, HttpError, audit } from '@/lib/auth';

export const maxDuration = 60;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['vendor', 'issued_on', 'total', 'access_key', 'items'],
  properties: {
    vendor: { type: ['string', 'null'] }, issued_on: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    total: { type: ['number', 'null'] }, access_key: { type: ['string', 'null'], description: 'chave de acesso de 44 digitos, se visivel' },
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'quantity', 'unit', 'unit_price', 'total'],
      properties: { name: { type: 'string' }, quantity: { type: ['number', 'null'] }, unit: { type: ['string', 'null'] }, unit_price: { type: ['number', 'null'] }, total: { type: ['number', 'null'] } } } },
  },
};

export async function POST(req) {
  try {
    const { sb, user } = await requireScope('bakery');
    const file = (await req.formData()).get('file');
    if (!file || typeof file === 'string') throw new HttpError(400, 'Envie um arquivo');
    if (!TYPES.includes(file.type)) throw new HttpError(400, 'Use JPG, PNG, WEBP ou PDF');
    if (file.size > 10 * 1024 * 1024) throw new HttpError(400, 'Maximo 10 MB');
    const buf = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash('sha256').update(buf).digest('hex');

    const { data: dup } = await sb.from('b_documents').select('id,status,vendor,total').eq('file_hash', hash).maybeSingle();
    if (dup) throw new HttpError(409, `Este arquivo ja foi enviado (${dup.vendor || 'sem nome'}, status ${dup.status}).`);

    const dataUrl = `data:${file.type};base64,${buf.toString('base64')}`;
    const part = file.type === 'application/pdf'
      ? { type: 'input_file', filename: 'nota.pdf', file_data: dataUrl }
      : { type: 'input_image', image_url: dataUrl };
    const { openai, model } = await getOpenAI(); // chave/modelo vindos de Configuracoes
    const resp = await openai.responses.create({
      model, store: false,
      instructions: 'Extraia os dados desta nota fiscal/cupom. Use null quando um campo nao estiver legivel. Nao invente valores.',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'Extraia estabelecimento, data, total, chave de acesso e itens.' }, part] }],
      text: { format: { type: 'json_schema', name: 'nota', schema: SCHEMA, strict: true } },
    });
    const extracted = JSON.parse(resp.output_text);

    if (extracted.access_key) {
      const { data: d2 } = await sb.from('b_documents').select('id').eq('access_key', extracted.access_key).maybeSingle();
      if (d2) throw new HttpError(409, 'Esta nota (mesma chave de acesso) ja foi lancada.');
    }
    const path = `${user.id}/${hash}.${file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]}`;
    const up = await sb.storage.from('notas').upload(path, buf, { contentType: file.type, upsert: false });
    if (up.error) throw new HttpError(500, 'Falha ao guardar o arquivo');
    const { data: doc, error } = await sb.from('b_documents').insert({
      storage_path: path, file_hash: hash, access_key: extracted.access_key, vendor: extracted.vendor,
      issued_on: extracted.issued_on, total: extracted.total, extracted, status: 'pending',
    }).select('id').single();
    if (error) throw new HttpError(409, error.code === '23505' ? 'Documento duplicado' : error.message);
    await audit(user.id, 'nota_extracted', 'b_documents', doc.id, { vendor: extracted.vendor, total: extracted.total });
    return Response.json({ id: doc.id, extracted });
  } catch (e) { return handleError(e); }
}
