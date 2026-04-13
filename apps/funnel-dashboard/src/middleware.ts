import { auth } from '@/auth';

export default auth((req) => {
  const path = req.nextUrl.pathname;
  if (path.startsWith('/api/auth')) return;
  if (path === '/api/telemetry') return;
  if (path.startsWith('/_next')) return;
  if (path === '/favicon.ico') return;

  if (!req.auth && path !== '/login') {
    return Response.redirect(new URL('/login', req.url));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};
