'use client';
import { useEffect, useState } from 'react';

const GROUPS = [
  { id: 'openai', title: 'IA (OpenAI)', test: 'openai', keys: ['OPENAI_API_KEY', 'OPENAI_MODEL'],
    help: 'Usada pelo assistente e pela leitura de nota fiscal. A chave fica criptografada no banco.' },
  { id: 'pluggy', title: 'Conexao bancaria (Pluggy)', test: 'pluggy', keys: ['PLUGGY_CLIENT_ID', 'PLUGGY_CLIENT_SECRET'],
    help: 'Opcional. Comece com as credenciais do sandbox da Pluggy.' },
];
const SOURCE = { tela: 'salva nesta tela', env: 'variavel de ambiente', padrao: 'valor padrao' };

async function call(method, body) {
  const r = await fetch('/api/admin/settings', {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: r.ok, j: await r.json().catch(() => ({})) };
}

export default function Configuracoes() {
  const [st, setSt] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [msgs, setMsgs] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { ok, j } = await call('GET');
    if (ok) setSt(j); else setError(j.error || 'Erro ao carregar');
  }
  useEffect(() => { load(); }, []);

  const say = (id, ok, text) => setMsgs((m) => ({ ...m, [id]: { ok, text } }));
  const item = (k) => st?.items.find((i) => i.key === k);

  async function test(id, target) {
    setBusy(id);
    const { j } = await call('POST', { target });
    say(id, !!j.ok, j.message || j.error);
    setBusy('');
  }

  async function save(g) {
    const changed = g.keys.filter((k) => (drafts[k] || '').trim());
    if (!changed.length) { say(g.id, false, 'Preencha pelo menos um campo.'); return; }
    setBusy(g.id);
    for (const key of changed) {
      const { ok, j } = await call('PUT', { key, value: drafts[key] });
      if (!ok) { say(g.id, false, j.error); setBusy(''); return; }
    }
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !changed.includes(k)))); // limpa os campos digitados
    await load();
    await test(g.id, g.test); // confirma na hora se funcionou
  }

  async function remove(g, key) {
    if (!confirm('Remover o valor salvo nesta tela? Se existir variavel de ambiente, ela volta a valer.')) return;
    setBusy(g.id);
    const { ok, j } = await call('DELETE', { key });
    say(g.id, ok, ok ? 'Valor removido.' : j.error);
    await load();
    setBusy('');
  }

  if (error) return <><h1>Configuracoes</h1><div className="card err">{error}</div></>;
  if (!st) return <><h1>Configuracoes</h1><p className="muted">Carregando...</p></>;

  return (
    <>
      <h1>Configuracoes e integracoes</h1>
      {!st.migrationReady && <div className="card err">A tabela de configuracoes ainda nao existe. Rode <code>supabase/003_app_settings.sql</code> no SQL Editor do Supabase.</div>}
      {!st.encryptionReady && <div className="card err">Falta a variavel <code>SETTINGS_ENCRYPTION_KEY</code> no servidor. Sem ela nao e possivel salvar chaves por aqui (veja o README).</div>}

      <div className="card">
        <h3>Banco de dados (Supabase)</h3>
        <p className="muted">Estas 3 chaves ficam nas variaveis de ambiente da Vercel: o app precisa delas para conseguir ler qualquer coisa do banco, inclusive estas configuracoes.</p>
        <p>
          URL: <b className={st.supabaseEnv.url ? 'ok' : 'err'}>{st.supabaseEnv.url ? 'ok' : 'faltando'}</b>{' · '}
          Publishable: <b className={st.supabaseEnv.publishable ? 'ok' : 'err'}>{st.supabaseEnv.publishable ? 'ok' : 'faltando'}</b>{' · '}
          Secret: <b className={st.supabaseEnv.secret ? 'ok' : 'err'}>{st.supabaseEnv.secret ? 'ok' : 'faltando'}</b>
        </p>
        <div className="row"><button className="ghost" disabled={busy === 'supabase'} onClick={() => test('supabase', 'supabase')}>Testar conexao</button></div>
        {msgs.supabase && <p className={msgs.supabase.ok ? 'ok' : 'err'}>{msgs.supabase.text}</p>}
      </div>

      {GROUPS.map((g) => (
        <div className="card" key={g.id}>
          <h3>{g.title}</h3>
          <p className="muted">{g.help}</p>
          {g.keys.map((k) => {
            const it = item(k);
            return (
              <div key={k}>
                <label htmlFor={k}>{it.label}</label>
                <p className="muted" style={{ margin: '0 0 4px' }}>
                  {it.broken && <span className="err">Valor salvo ilegivel (a SETTINGS_ENCRYPTION_KEY mudou?). Cadastre de novo. </span>}
                  {it.configured ? <>Atual: <b>{it.preview}</b> ({SOURCE[it.source]})</> : 'Nao configurado'}
                </p>
                <div className="row">
                  <input id={k} style={{ flex: 1, minWidth: 180 }} type={it.secret ? 'password' : 'text'} autoComplete="new-password"
                    placeholder={it.configured ? 'Digite para substituir' : 'Cole aqui'}
                    value={drafts[k] || ''} onChange={(e) => setDrafts({ ...drafts, [k]: e.target.value })} />
                  {it.source === 'tela' && <button type="button" className="ghost" disabled={!!busy} onClick={() => remove(g, k)}>Remover</button>}
                </div>
              </div>
            );
          })}
          <div className="row" style={{ marginTop: 12 }}>
            <button disabled={!!busy || !st.encryptionReady || !st.migrationReady} onClick={() => save(g)}>{busy === g.id ? 'Aguarde...' : 'Salvar e testar'}</button>
            <button className="ghost" disabled={!!busy} onClick={() => test(g.id, g.test)}>So testar</button>
          </div>
          {msgs[g.id] && <p className={msgs[g.id].ok ? 'ok' : 'err'}>{msgs[g.id].text}</p>}
        </div>
      ))}
      <p className="muted">Por seguranca, as chaves salvas nunca sao exibidas por completo: so o final. Para trocar, digite a nova.</p>
    </>
  );
}
