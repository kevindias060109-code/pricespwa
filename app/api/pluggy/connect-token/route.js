import { requireUser, handleError } from '@/lib/auth';
import { pluggyKey, pluggyConnectToken } from '@/lib/pluggy';
// O usuario conecta o banco no widget da Pluggy (nunca digitamos senha bancaria aqui).
export async function POST() {
  try { await requireUser(); return Response.json({ accessToken: await pluggyConnectToken(await pluggyKey()) }); }
  catch (e) { return handleError(e); }
}
