import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { destinoDaEntrada } from "@/lib/modulos";
import { lerVinculos } from "@/lib/modulos-servidor";

const WINDOW_MS = 60_000;

const API_LIMITS: [string, number][] = [
  ["/api/stripe/checkout", 10],
  ["/api/stripe/portal", 10],
  ["/api/members", 10],
  ["/api/admin", 20],
  ["/api/proposta-track", 20],
  ["/api/patrocinadores", 10],
  ["/api/calendar", 30],
  ["/api/email", 30],
  ["/api/mcp/keys", 10],
  ["/api/mcp/oauth/token", 60],
  ["/api/mcp/oauth/register", 30],
  ["/api/mcp/oauth/consent", 20],
  ["/api/mcp/server", 600],
  ["/api/mcp", 60],
  ["/api/auth/conta-sem-senha", 10],
  ["/api/", 60],
];

const PAGE_LIMIT = 120;
const PUBLIC_LIMIT = 60;
const MAX_RATE_LIMIT_ENTRIES = 10_000;

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateLimitEntry>();
let lastRateLimitCleanup = Date.now();

function maybeCleanupRateLimits() {
  const now = Date.now();
  if (now - lastRateLimitCleanup < 300_000) return;
  lastRateLimitCleanup = now;
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}

function isRateLimited(key: string, limit: number): boolean {
  maybeCleanupRateLimits();
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    if (!entry && rateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = rateLimitStore.keys().next().value as string | undefined;
      if (oldestKey) rateLimitStore.delete(oldestKey);
    }
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}

function getIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca o token em toda request (obrigatório para @supabase/ssr)
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const ip = getIp(request);
  const identity = user?.id ?? ip;

  // Usuário logado na raiz vai direto pro dashboard. Deslogado segue para
  // app/route.ts, que serve a landing page.
  if (pathname === "/" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Stripe webhook tem verificação HMAC própria — nunca bloquear.
  if (pathname !== "/api/stripe/webhook") {
    if (pathname.startsWith("/api/")) {
      let limit = 60;
      let routeBucket = "/api/other";
      for (const [prefix, routeLimit] of API_LIMITS) {
        if (pathname.startsWith(prefix)) {
          limit = routeLimit;
          routeBucket = prefix;
          break;
        }
      }

      const key = pathname.startsWith("/api/proposta-track")
        ? `ip:${ip}::proposta-track`
        : `u:${identity}::${routeBucket}`;

      if (isRateLimited(key, limit)) {
        return NextResponse.json(
          { error: "Muitas requisições. Aguarde um momento." },
          { status: 429 },
        );
      }
    } else {
      const isPublicPage =
        pathname.startsWith("/p/") ||
        pathname.startsWith("/r/") ||
        pathname.startsWith("/convite/") ||
        pathname === "/login" ||
        pathname === "/" ||
        pathname === "/robots.txt" ||
        pathname === "/sitemap.xml" ||
        pathname === "/termos" ||
        pathname === "/privacidade" ||
        pathname === "/incentivadores" ||
        pathname.startsWith("/redefinir-senha") ||
        pathname.startsWith("/nova-senha") ||
        pathname.startsWith("/cadastro") ||
        pathname.startsWith("/confirmacao-email") ||
        pathname.startsWith("/.well-known") ||
        pathname.startsWith("/blog");

      const publicBucket = pathname.startsWith("/p/")
        ? "proposal"
        : pathname.startsWith("/blog")
          ? "blog"
          : pathname === "/"
            ? "root"
            : "auth";
      const key = isPublicPage
        ? `ip:${ip}::${publicBucket}`
        : `u:${identity}::pages`;
      const limit = isPublicPage ? PUBLIC_LIMIT : PAGE_LIMIT;

      if (isRateLimited(key, limit)) {
        return new NextResponse("Muitas requisições. Aguarde um momento.", {
          status: 429,
        });
      }
    }
  }

  // Rotas públicas que não precisam de auth
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/cadastro") ||
    pathname.startsWith("/confirmacao-email") ||
    pathname.startsWith("/redefinir-senha") ||
    pathname.startsWith("/nova-senha") ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/p/") ||
    // Relatório do patrocinador por link (P5.2): o banco confere o link.
    pathname.startsWith("/r/") ||
    // Convite de convidado da prestação (P5.3): o banco confere o link; o aceite pede login.
    pathname.startsWith("/convite/") ||
    pathname.startsWith("/.well-known") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/termos" ||
    pathname === "/privacidade" ||
    pathname === "/incentivadores";

  // Usuário não logado tentando acessar rota privada → login
  if (!user && !isPublicRoute) {
    const nextPath = pathname + request.nextUrl.search;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url);
  }

  // Usuário logado acessando login → dashboard
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  // Entrada no app: quem não usa a captação em nenhuma organização vai direto
  // para a página do módulo dele, sem abrir o /dashboard (PD0.3). Aqui, antes
  // de a página começar, o desvio é um 307 de verdade; num layout ele viria
  // depois do "Carregando…". A navegação dentro do app passa por aqui também.
  if (user && pathname === "/dashboard" && request.method === "GET") {
    const destino = destinoDaEntrada(await lerVinculos(supabase, user.id));
    if (destino) {
      const url = request.nextUrl.clone();
      url.pathname = destino;
      const resposta = NextResponse.redirect(url);
      // A sessão renovada nesta requisição vai junto, senão se perde.
      supabaseResponse.cookies.getAll().forEach(cookie => resposta.cookies.set(cookie));
      return resposta;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // dados/: tabelas públicas que a tela baixa (CNAE do IBGE), sem passar pela sessão.
    "/((?!_next/static|_next/image|favicon.ico|consentimento\\.js$|origem-campanha\\.js$|dados/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4|webm|ttf|woff|woff2|otf|eot)$).*)",
  ],
};
