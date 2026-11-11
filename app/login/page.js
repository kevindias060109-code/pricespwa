'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const sb = supabaseBrowser();

  async function enter(e) {
    e.preventDefault(); setMsg('');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return setMsg('E-mail ou senha invalidos.');
    location.href = '/';
  }
  async function forgot() {
    if (!email) return setMsg('Digite seu e-mail primeiro.');
    await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/definir-senha` });
    setMsg('Se o e-mail existir, enviamos um link para redefinir a senha.');
  }
  return (
    <div className="card" style={{ maxWidth: 380, margin: '40px auto' }}>
      <h1>Entrar</h1>
      <form onSubmit={enter}>
        <label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <label>Senha</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        <p><button type="submit">Entrar</button></p>
      </form>
      <button className="ghost" onClick={forgot}>Esqueci minha senha</button>
      {msg && <p className="muted">{msg}</p>}
      <p className="muted">Contas so sao criadas pelo administrador (convite por e-mail).</p>
    </div>
  );
}
