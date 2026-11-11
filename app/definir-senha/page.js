'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

// Destino do link de convite e do "esqueci a senha".
export default function DefinirSenha() {
  const sb = supabaseBrowser();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const code = new URLSearchParams(location.search).get('code');
      if (code) await sb.auth.exchangeCodeForSession(code).catch(() => {});
      const { data } = await sb.auth.getSession(); // tokens no hash sao lidos automaticamente
      if (data.session) setReady(true);
      else setMsg('Link invalido ou expirado. Peca um novo convite/recuperacao.');
    })();
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => s && setReady(true));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function save(e) {
    e.preventDefault();
    if (password.length < 10) return setMsg('Use pelo menos 10 caracteres.');
    const { error } = await sb.auth.updateUser({ password });
    if (error) return setMsg(error.message);
    location.href = '/';
  }
  return (
    <div className="card" style={{ maxWidth: 380, margin: '40px auto' }}>
      <h1>Definir senha</h1>
      {ready ? (
        <form onSubmit={save}>
          <label>Nova senha (min. 10 caracteres)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          <p><button type="submit">Salvar e entrar</button></p>
        </form>
      ) : <p className="muted">Validando link...</p>}
      {msg && <p className="err">{msg}</p>}
    </div>
  );
}
