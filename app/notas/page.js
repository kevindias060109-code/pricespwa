'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function Notas() {
  const sb = supabaseBrowser();
  const [ings, setIngs] = useState([]);
  const [doc, setDoc] = useState(null); // { id, vendor, issued_on, total, items[] }
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { sb.from('b_ingredients').select('id,name,unit').order('name').then(({ data }) => setIngs(data || [])); }, []);

  async function upload(e) {
    const file = e.target.files[0]; if (!file) return;
    setBusy(true); setMsg(''); setDoc(null);
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/notas/extract', { method: 'POST', body: fd });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setMsg(j.error);
    const x = j.extracted;
    setDoc({ id: j.id, vendor: x.vendor || '', issued_on: x.issued_on || '', total: x.total ?? '',
      items: x.items.map((i) => ({ ...i, ingredient_id: '' })) });
  }
  const setItem = (idx, p) => setDoc({ ...doc, items: doc.items.map((it, i) => (i === idx ? { ...it, ...p } : it)) });

  async function confirm(reject) {
    const r = await fetch('/api/notas/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...doc, reject, items: doc.items.map((i) => ({ ingredient_id: i.ingredient_id, quantity: i.quantity, unit_cost: i.unit_price })) }) });
    const j = await r.json();
    setMsg(r.ok ? (reject ? 'Nota descartada.' : 'Nota confirmada: financeiro e estoque atualizados.') : j.error);
    if (r.ok) setDoc(null);
  }
  return (
    <>
      <h1>Ler nota fiscal</h1>
      <div className="card">
        <input type="file" accept="image/*,application/pdf" onChange={upload} />
        {busy && <p className="muted">Lendo documento com IA...</p>}
        {msg && <p className={msg.startsWith('Nota') ? 'ok' : 'err'}>{msg}</p>}
      </div>
      {doc && (
        <div className="card">
          <p className="muted">Confira os dados lidos. NADA foi lancado ainda. Associe cada item a um ingrediente do estoque para dar entrada (itens sem associacao nao movimentam estoque).</p>
          <label>Estabelecimento</label><input value={doc.vendor} onChange={(e) => setDoc({ ...doc, vendor: e.target.value })} />
          <label>Data</label><input type="date" value={doc.issued_on} onChange={(e) => setDoc({ ...doc, issued_on: e.target.value })} />
          <label>Total (R$)</label><input type="number" step="0.01" value={doc.total} onChange={(e) => setDoc({ ...doc, total: e.target.value })} />
          <div className="scroll"><table>
            <thead><tr><th>Item lido</th><th>Qtd</th><th>Un</th><th>Preco un.</th><th>Ingrediente do estoque</th></tr></thead>
            <tbody>{doc.items.map((it, i) => (
              <tr key={i}><td>{it.name}</td>
                <td><input style={{ width: 80 }} type="number" step="any" value={it.quantity ?? ''} onChange={(e) => setItem(i, { quantity: e.target.value })} /></td>
                <td>{it.unit}</td>
                <td><input style={{ width: 90 }} type="number" step="any" value={it.unit_price ?? ''} onChange={(e) => setItem(i, { unit_price: e.target.value })} /></td>
                <td><select value={it.ingredient_id} onChange={(e) => setItem(i, { ingredient_id: e.target.value })}>
                  <option value="">(nao dar entrada)</option>{ings.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>)}</select></td></tr>))}
            </tbody></table></div>
          <p className="muted">Atencao: a quantidade e o preco devem estar na MESMA unidade do ingrediente cadastrado (ex.: estoque em kg, informe kg).</p>
          <p className="row"><button onClick={() => confirm(false)}>Confirmar e lancar</button><button className="ghost" onClick={() => confirm(true)}>Descartar</button></p>
        </div>)}
    </>
  );
}
