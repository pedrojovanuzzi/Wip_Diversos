import { NextRequest, NextResponse } from "next/server";

/**
 * Guard de rotas. Cobre só o subconjunto migrado nesta 1ª leva:
 *   - "/"            requer permission >= 1 (validação do user fica nos Server Components)
 *   - "/licencas"    requer permission >= 5
 *   - "/auth/login"  redireciona pra "/" se já houver cookie
 *   - "/feedback/Opnion" público
 *
 * O middleware só verifica PRESENÇA do cookie. A validação real (e o nível de permissão)
 * acontece no Server Component via `requireUser(N)`, que pode redirecionar se necessário.
 * Esse design evita uma chamada HTTP por request no middleware (que não tem `cache` por request).
 */

const PROTECTED_PREFIXES = [
  "/",
  "/licencas",
  "/Onu",
  "/PowerDns",
  "/Pm2Logs",
  "/ServerLogs",
  "/TimeTracking",
];

const PUBLIC_EXACT = new Set<string>([
  "/auth/login",
  "/feedback/Opnion",
  "/TimeTracking/ClockIn",
]);

function isProtected(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return false;
  if (pathname.startsWith("/feedback/")) return false;
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/")),
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = req.cookies.has("user");

  if (pathname === "/auth/login" && hasCookie) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isProtected(pathname) && !hasCookie) {
    const url = new URL("/auth/login", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // tudo, exceto assets estáticos / api routes do próprio next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map)$).*)",
  ],
};
