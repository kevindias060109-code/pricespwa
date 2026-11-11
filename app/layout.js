import './globals.css';
import Link from 'next/link';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import LogoutButton from '@/components/LogoutButton';
import { getSession } from '@/lib/auth';

export const metadata = {
  title: 'Doceria & Financas',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Doceria', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png', icon: '/icons/icon-192.png' },
};
export const viewport = { themeColor: '#c2185b', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }) {
  const s = await getSession();
  return (
    <html lang="pt-BR">
      <body>
        {s && (
          <nav className="top">
            <Link href="/">Inicio</Link>
            <span className="muted" style={{ color: '#fff' }}>{s.profile.full_name || s.user.email}</span>
            <LogoutButton />
          </nav>
        )}
        <main>{children}</main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
