'use client';
import { supabaseBrowser } from '@/lib/supabase-browser';
export default function LogoutButton() {
  return (
    <button className="ghost" style={{ padding: '4px 10px' }} onClick={async () => {
      await supabaseBrowser().auth.signOut();
      // limpa qualquer cache local ao sair
      if ('caches' in window) (await caches.keys()).forEach((k) => caches.delete(k));
      location.href = '/login';
    }}>Sair</button>
  );
}
