'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { MODULES } from '@/lib/modules';

const digits = (s) => (s || '').replace(/\D/g, '');
const wa = (phone) => { const d = digits(phone); return d ? `https://wa.me/${d.length <= 11 ? '55' + d : d}` : null; };

export default function Crud() {
  const { slug } = useParams();
  const cfg = MODULES[slug];
  const sb = supabaseBrowser();
  const [rows, setRows] = useState([]);
  const [refs, setRefs] = useState({});
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  async function load() {
    if (!cfg) return;
    const q = sb.from(cfg.table).select('*').order(cfg.order || 'created_at', { ascending: !!cfg.asc }).limit(300);
    const { data, error } = await q;
    if (error) return setMsg(error.message);
    setRows(data);
    const r = {};
    for (const f of cfg.fields.filter((x) => x.t === 'ref')) {
      if (r[f.ref]) continue;
      const { data: d } = await sb.from(f.ref).select('*').limit(500);
      r[f.ref] = d || [];
    }
    setRefs(r);
  }
  useEffect(() => { load(); }, [slug]);
  if (!cfg) return <p>Modulo nao encontrado.</p>;

  const label = (f, row) => row?.[f.label || 'name'] ?? row?.id;
  const show = (f, row) => {
    const v = row[f.k];
    if (f.t === 'ref') return label(f, (refs[f.ref] || []).find((x) => x.id === v)) || '';
    return v ?? '';
  };
  const phoneOf = (row) => {
    if (cfg.phoneField) return row[cfg.phoneField];
    if (cfg.phoneRef) return (refs.b_customers || []).find((c) => c.id === row[cfg.phoneRef])?.phone;
  };

  async function submit(e) {
    e.preventDefault(); setMsg('');
    const body = {};
    for (const f of cfg.fields) {
      const v = form[f.k];
      if (v === '' || v === undefined) { if (editing) body[f.k] = null; continue; }
      body[f.k] = f.t === 'number' ? Number(v) : v;
    }
    const { error } = editing
      ? await sb.from(cfg.table).update(body).eq('id', editing)
      : await sb.from(cfg.table).insert(body);
    if (error) return setMsg(error.message);
    setForm({}); setEditing(null); load();
  }
  async function del(id) {
    if (!confirm('Excluir este registro?')) return;
    const { error } = await sb.from(cfg.table).delete().eq('id', id);
    if (error) setMsg(error.message); else load();
  }

  const cols = [...cfg.fields.map((f) => f.k), ...(cfg.readonlyCols || [])];
  return (
    <>
      <h1>{cfg.title}</h1>
      {cfg.note && <p className="muted">{cfg.note}</p>}
      <form className="card" onSubmit={submit}>
        {cfg.fields.map((f) => (
          <div key={f.k}>
            <label>{f.l}{f.req ? ' *' : ''}</label>
            {f.t === 'select' ? (
              <select required={!!f.req} value={form[f.k] ?? ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}>
                <option value="">--</option>{f.opts.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : f.t === 'ref' ? (
              <select required={!!f.req} value={form[f.k] ?? ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}>
                <option value="">--</option>
                {(refs[f.ref] || []).map((o) => <option key={o.id} value={o.id}>{label(f, o)}</option>)}
              </select>
            ) : (
              <input type={f.t === 'number' ? 'number' : f.t === 'date' ? 'date' : 'text'} step="any" required={!!f.req}
                value={form[f.k] ?? ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
            )}
          </div>
        ))}
        <p className="row">
          <button type="submit">{editing ? 'Salvar alteracoes' : 'Adicionar'}</button>
          {editing && <button type="button" className="ghost" onClick={() => { setEditing(null); setForm({}); }}>Cancelar</button>}
        </p>
        {msg && <p className="err">{msg}</p>}
      </form>
      <div className="card scroll">
        <table>
          <thead><tr>{cols.map((c) => <th key={c}>{cfg.fields.find((f) => f.k === c)?.l || c}</th>)}<th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {cols.map((c) => {
                  const f = cfg.fields.find((x) => x.k === c);
                  return <td key={c}>{f ? String(show(f, r)) : String(r[c] ?? '')}</td>;
                })}
                <td className="row">
                  {wa(phoneOf(r)) && <a href={wa(phoneOf(r))} target="_blank" rel="noreferrer">WhatsApp</a>}
                  {!cfg.noEdit && <button className="ghost" onClick={() => { setEditing(r.id); setForm(Object.fromEntries(cfg.fields.map((f) => [f.k, r[f.k] ?? '']))); window.scrollTo(0, 0); }}>Editar</button>}
                  <button className="danger" onClick={() => del(r.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="muted">Nada cadastrado ainda.</p>}
      </div>
    </>
  );
}
