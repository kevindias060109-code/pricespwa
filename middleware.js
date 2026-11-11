import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

const PUBLIC = ['/login', '/definir-senha', '/offline.html', '/manifest.webmanifest', '/sw.js'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data } = await sb.auth.getUser(); // renova a sessao
  const isPublic = PUBLIC.some((p) => pathname === p) || pathname.startsWith('/icons/');
  if (!data?.user && !isPublic && !pathname.startsWith('/api/')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
