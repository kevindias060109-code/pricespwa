'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function Chat() {
  const { scope } = useParams();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState([]);
  const end = useRef(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, pending]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setText(''); setBusy(true);
    const r = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, messages: next }) });
    const j = await r.json(); setBusy(false);
    setMsgs([...next, { role: 'assistant', content: r.ok ? j.reply : `Erro: ${j.error}` }]);
    if (r.ok && j.pending?.length) setPending((p) => [...p, ...j.pending]);
  }
  async function decide(id, reject) {
    const r = await fetch('/api/ai/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reject }) });
    const j = await r.json();
    setMsgs((m) => [...m, { role: 'assistant', content: r.ok ? (reject ? 'Cancelado.' : 'Confirmado e registrado.') : `Nao foi possivel: ${j.error}` }]);
    setPending((p) => p.filter((x) => x.id !== id));
  }
  return (
    <>
      <h1>Assistente {scope === 'bakery' ? 'da doceria' : 'pessoal'}</h1>
      <p className="muted">Responde com os dados reais do sistema. Antes de gravar algo, pede sua confirmacao.</p>
      {msgs.map((m, i) => <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'ai'}`}>{m.content}</div>)}
      {busy && <div className="msg ai muted">Consultando...</div>}
      {pending.map((p) => (
        <div key={p.id} className="pending">
          <b>Confirmar?</b> {p.summary}
          <p className="row"><button onClick={() => decide(p.id, false)}>Confirmar</button><button className="ghost" onClick={() => decide(p.id, true)}>Cancelar</button></p>
        </div>))}
      <div ref={end} />
      <form onSubmit={send} className="row" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', padding: 10, borderTop: '1px solid #ecdcd8' }}>
        <input style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={scope === 'bakery' ? 'Ex.: quanto custa cada marmita de baiao de dois?' : 'Ex.: quanto gastei este mes?'} />
        <button disabled={busy}>Enviar</button>
      </form>
    </>
  );
}
