'use client';
import { useEffect, useState } from 'react';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [f, setF] = useState({ email: '', full_name: '', role: 'bakery' });
  const [msg, setMsg] = useState('');
  async function load() {
    const r = await fetch('/api/admin/users');
    if (r.ok) setUsers(await r.json()); else setMsg((await r.json()).error);
  }
  useEffect(() => { load(); }, []);
  async function invite(e) {
    e.preventDefault(); setMsg('');
    const r = await fetch('/api/admin/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const j = await r.json();
    setMsg(r.ok ? 'Convite enviado por e-mail.' : j.error);
    if (r.ok) { setF({ email: '', full_name: '', role: 'bakery' }); load(); }
  }
  async function patch(id, p) {
    const r = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...p }) });
    if (!r.ok) setMsg((await r.json()).error); else load();
  }
  return (
    <>
      <h1>Usuarios</h1>
      <form className="card" onSubmit={invite}>
        <h3>Convidar usuario (so o ADM principal)</h3>
        <label>E-mail</label><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <label>Nome</label><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <label>Perfil</label>
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="bakery">Usuario da doceria</option><option value="personal">Usuario pessoal</option><option value="admin">Administrador adicional</option>
        </select>
        <p><button>Enviar convite</button></p>
        {msg && <p className="muted">{msg}</p>}
      </form>
      <div className="card scroll"><table>
        <thead><tr><th>E-mail</th><th>Nome</th><th>Perfil</th><th>Pessoal</th><th>Doceria</th><th>Ativo</th></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.id}><td>{u.email}</td><td>{u.full_name}</td><td>{u.role}</td>
            <td><input type="checkbox" disabled={u.role === 'owner'} checked={u.can_personal} onChange={(e) => patch(u.id, { can_personal: e.target.checked })} /></td>
            <td><input type="checkbox" disabled={u.role === 'owner'} checked={u.can_bakery} onChange={(e) => patch(u.id, { can_bakery: e.target.checked })} /></td>
            <td><input type="checkbox" disabled={u.role === 'owner'} checked={u.active} onChange={(e) => patch(u.id, { active: e.target.checked })} /></td></tr>
        ))}</tbody></table>
        <p className="muted">Alteracoes de permissao so funcionam logado como ADM principal.</p></div>
    </>
  );
}
