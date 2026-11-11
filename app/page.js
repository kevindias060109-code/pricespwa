import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, canPersonal, canBakery } from '@/lib/auth';
import { MODULES } from '@/lib/modules';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const s = await getSession();
  if (!s) redirect('/login');
  const p = s.profile;
  const section = (scope) =>
    Object.entries(MODULES).filter(([, m]) => m.scope === scope).map(([slug, m]) => (
      <Link key={slug} className="tile" href={`/m/${slug}`}>{m.title}</Link>
    ));
  return (
    <>
      {canBakery(p) && (<>
        <h1>Doceria</h1>
        <div className="grid">
          <Link className="tile" href="/chat/bakery">Assistente da doceria (IA)</Link>
          <Link className="tile" href="/notas">Ler nota fiscal (IA)</Link>
          <Link className="tile" href="/relatorio/bakery">Relatorio mensal</Link>
          {section('bakery')}
        </div></>)}
      {canPersonal(p) && (<>
        <h1>Financeiro pessoal</h1>
        <div className="grid">
          <Link className="tile" href="/chat/personal">Assistente pessoal (IA)</Link>
          <Link className="tile" href="/relatorio/personal">Relatorio mensal / fluxo de caixa</Link>
          {section('personal')}
        </div></>)}
      {['owner', 'admin'].includes(p.role) && (<>
        <h1>Administracao</h1>
        <div className="grid">
          <Link className="tile" href="/admin">Usuarios e permissoes</Link>
          {p.role === 'owner' && <Link className="tile" href="/admin/configuracoes">Configuracoes e integracoes</Link>}
        </div></>)}
      {!canBakery(p) && !canPersonal(p) && !['owner', 'admin'].includes(p.role) && (
        <div className="card">Sua conta ainda nao tem acessos liberados. Fale com o administrador.</div>)}
    </>
  );
}
