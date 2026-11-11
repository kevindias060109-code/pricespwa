import crypto from 'crypto';

// Chave mestra (32 bytes em base64) que fica SO nas variaveis de ambiente do servidor.
// Gerar: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
function masterKey() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) throw new Error('SETTINGS_ENCRYPTION_KEY nao configurada');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('SETTINGS_ENCRYPTION_KEY invalida: precisa ter 32 bytes em base64');
  return buf;
}

export function cryptoReady() {
  try { masterKey(); return true; } catch { return false; }
}

// aad amarra o texto cifrado ao nome da configuracao (impede trocar linhas entre chaves).
export function encrypt(plain, aad) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64'); // iv(12) | tag(16) | dados
}

export function decrypt(b64, aad) {
  const buf = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', masterKey(), buf.subarray(0, 12));
  if (aad) d.setAAD(Buffer.from(aad));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
