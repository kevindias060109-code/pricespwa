'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Relatorio() {
  const { scope } = useParams();
  const sb = supabaseBrowser();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [cats, setCats] = useState({});
  const table = scope === 'personal' ? 'p_transactions' : 'b_transactions';

  useEffect(() => {
    if (scope === 'personal') sb.from('p_categories').select('id,name').then(({ data }) => setCats(Object.fromEntries((data || []).map((c) => [c.id, c.name]))));
  }, [scope]);

  useEffect(() => {
    const from = `${month}-01`;
    const to = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1).toISOString().slice(0, 10);
    sb.from(table).select('*').gte('occurred_on', from).lt('occurred_on', to).order('occurred_on')
      .then(({ data, error }) => (error ? setErr(error.message) : setRows(data)));
  }, [month, table]);

  const sum = (k, filter = () => true) => rows.filter((r) => r.kind === k && filter(r)).reduce((a, r) => a + Number(r.amount), 0);
  const income = sum('income'), expense = sum('expense');
  const byCat = {};
  rows.filter((r) => r.kind === 'expense').forEach((r) => {
    const c = r.category || cats[r.category_id] || 'sem categoria';
    byCat[c] = (byCat[c] || 0) + Number(r.amount);
  });
  const pending = scope === 'bakery' ? rows.filter((r) => r.status === 'pending').reduce((a, r) => a + Number(r.amount), 0) : null;

  return (
    <>
      <h1>Relatorio mensal — {scope === 'personal' ? 'pessoal' : 'doceria'}</h1>
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 200 }} />
      {err && <p className="err">{err}</p>}
      <div className="grid">
        <div className="card">Entradas<h2 className="ok">{brl(income)}</h2></div>
        <div className="card">Saidas<h2 className="err">{brl(expense)}</h2></div>
        <div className="card">Resultado (lucro/saldo do mes)<h2>{brl(income - expense)}</h2></div>
        {pending !== null && <div className="card">Pendentes<h2>{brl(pending)}</h2></div>}
      </div>
      <div className="card"><h3>Despesas por categoria</h3>
        {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => <div key={c} className="row" style={{ justifyContent: 'space-between' }}><span>{c}</span><b>{brl(v)}</b></div>)}
        {!Object.keys(byCat).length && <p className="muted">Sem despesas no periodo.</p>}
      </div>
    </>
  );
}
