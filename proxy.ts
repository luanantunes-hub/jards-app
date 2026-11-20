import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { INICIO_DO_MODULO } from "@/lib/modulos";
import { entradaDoAcesso, lerAcessoAosModulos } from "@/lib/modulos-acesso";
import { ehHostDoApp, hostDoPedido } from "@/lib/ticketeria/site";

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
  // Avisos de pagamento do provedor (sem login, token próprio): muitos em rajada quando um evento abre as vendas.
  ["/api/ticketeria/avisos", 600],
  // Validação de saque do Asaas (sem login, token próprio): um pedido por saque, rápido.
  ["/api/ticketeria/validacao-saque", 300],
  // Compra de ingressos (sem login): por IP. Cada compra abre uma reserva e uma cobrança, então o teto é baixo; a consulta do Pix pago é mais frequente.
  // Conferir um cupom (sem login): o teto é bem menor, para ninguém ficar adivinhando códigos.
  // A equipe da porta pelo link (sem login): várias pessoas no mesmo wi-fi, uma leitura atrás da outra.
  ["/api/ticketeria/porta-equipe", 300],
  // A API pública de leitura da Ticketeria (sem login, aberta a outros sites): por IP; o cache da borda segura o grosso.
  ["/api/ticketeria/publico", 120],
  // Pedir e confirmar o reembolso pela página do pedido (sem login): poucas por minuto, por IP; o link é de uso único e o banco limita os pedidos por pedido.
  ["/api/ticketeria/pedido", 10],
  ["/api/ticketeria/compra/cupom", 15],
  // O mapa de lugares de uma sessão (sem login): a tela o relê a cada vez que abre.
  ["/api/ticketeria/compra/mapa", 40],
  // Entrar na lista de espera e sair dela (sem login): poucas por minuto, por IP.
  ["/api/ticketeria/compra/espera", 10],
  // Sair da lista de novidades pelo link do e-mail (sem login): poucas por minuto, por IP.
  ["/api/ticketeria/novidades", 20],
  ["/api/ticketeria/compra", 60],
  ["/api/mcp/keys", 10],
  ["/api/mcp/oauth/token", 60],
  ["/api/mcp/oauth/register", 30],
  ["/api/mcp/oauth/consent", 20],
  ["/api/mcp/server", 600],
  ["/api/mcp", 60],
  // Página de envio de arquivos do assistente (sem login): preparar e concluir, por IP.
  ["/api/enviar", 40],
  // Resposta do acerto técnico pela casa (sem login): por IP.
  ["/api/acerto", 30],
  // Resposta ao convite da produção pelo link (sem login): por IP.
  ["/api/presenca", 30],
  // Inscrição de voluntários pelo link (sem login): por IP.
  ["/api/voluntario", 10],
  // Agendamento de visitas pelo link (sem login): por IP.
  ["/api/visita", 10],
  // Programação pública de um espaço (sem login, aberta a outros sites): por IP.
  ["/api/programacao", 60],
  // Tela de palco pelo link (sem login): lê a cada 10 segundos, e vários aparelhos podem dividir o mesmo IP.
  ["/api/palco", 240],
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

/**
 * O pedido chegou por um domínio que não é do Jards: é o site de uma pessoa (o site da loja na Ticketeria). Reescreve para a rota interna
 * /dominio/[host]/... (que só mostra o que está publicado) e não deixa passar o app, a API nem o painel por esse endereço.
 */
function rotearSiteDaPessoa(request: NextRequest, host: string): NextResponse {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") return NextResponse.next();
  if (pathname.startsWith("/api") || pathname.startsWith("/dominio")) return new NextResponse("Não encontrado", { status: 404 });
  if (isRateLimited(`site:${getIp(request)}`, 300)) return new NextResponse("Muitas requisições. Aguarde um momento.", { status: 429 });
  const url = request.nextUrl.clone();
  url.pathname = `/dominio/${encodeURIComponent(host)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export async function proxy(request: NextRequest) {
  // Domínio de uma pessoa: o site dela, sem login e sem passar pelo app.
  const host = hostDoPedido(request.headers.get("host"));
  if (!ehHostDoApp(host, process.env.NEXT_PUBLIC_APP_URL)) return rotearSiteDaPessoa(request, host);
  // Na casa do Jards, a rota interna dos sites não abre direto: só o domínio da pessoa chega nela.
  if (request.nextUrl.pathname.startsWith("/dominio")) return new NextResponse("Não encontrado", { status: 404 });

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

  // Usuário logado na raiz vai direto pra página de entrada (a da captação, ou
  // a do módulo que usa quando não usa a captação). Deslogado segue para
  // app/route.ts, que serve a landing page.
  if (pathname === "/" && user) {
    const url = request.nextUrl.clone();
    url.pathname = await paginaDeEntradaDe(supabase, user.id);
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
        pathname.startsWith("/enviar/") ||
        pathname.startsWith("/acerto/") ||
        pathname.startsWith("/presenca/") ||
        pathname.startsWith("/voluntario/") ||
        pathname.startsWith("/visita/") ||
        pathname.startsWith("/programacao/") ||
        pathname.startsWith("/hospedagem/") ||
        pathname.startsWith("/patrocinador/") ||
        pathname.startsWith("/palco/") ||
        pathname.startsWith("/ficha/") ||
        pathname.startsWith("/tabela/") ||
        // Compra de ingressos e os ingressos de um pedido (sem login): o id da sessão e o do pedido (UUID sorteado) são a prova; o servidor confere tudo.
        pathname.startsWith("/comprar/") ||
        pathname.startsWith("/pedido/") ||
        // Sair da lista de espera pelo link do e-mail (sem login): o token do link, conferido no servidor, é a prova.
        pathname.startsWith("/espera/") ||
        // Sair da lista de novidades do produtor pelo link do e-mail de divulgação (sem login): o token do link, conferido no servidor, é a prova.
        pathname.startsWith("/novidades/") ||
        // A porta da equipe pelo link (sem login): o segredo do link, conferido no servidor, é a prova.
        pathname.startsWith("/porta/") ||
        // A entrada da bilheteria (venda na porta): e-mail e senha; o resto de /bilheteria pede login e o painel confere se a conta é de bilheteria.
        pathname === "/bilheteria/entrar" ||
        pathname.startsWith("/embed/") ||
        pathname.startsWith("/convite/") ||
        pathname === "/login" ||
        pathname === "/" ||
        pathname === "/robots.txt" ||
        pathname === "/sitemap.xml" ||
        pathname === "/termos" ||
        pathname === "/termos-de-compra" ||
        pathname === "/privacidade" ||
        pathname === "/incentivadores" ||
        pathname === "/crm" ||
        pathname === "/precos" ||
        pathname === "/prestacao-de-contas" ||
        pathname === "/ticketeria" ||
        pathname.startsWith("/redefinir-senha") ||
        pathname.startsWith("/nova-senha") ||
        pathname.startsWith("/cadastro") ||
        pathname.startsWith("/confirmacao-email") ||
        pathname.startsWith("/.well-known") ||
        pathname.startsWith("/publicacoes") ||
        pathname.startsWith("/blog");

      const publicBucket = pathname.startsWith("/p/")
        ? "proposal"
        : pathname.startsWith("/publicacoes") || pathname.startsWith("/blog")
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
    pathname.startsWith("/publicacoes") ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/p/") ||
    // Relatório do patrocinador por link (P5.2): o banco confere o link.
    pathname.startsWith("/r/") ||
    // Envio de arquivos pelo link que o assistente deu (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/enviar/") ||
    // Acerto técnico pelo link (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/acerto/") ||
    // Convite da produção pelo link (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/presenca/") ||
    // Inscrição de voluntários pelo link (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/voluntario/") ||
    // Agendamento de visitas pelo link (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/visita/") ||
    // Programação pública de um espaço e a versão para embutir (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/programacao/") ||
    // Lista de quartos para o hotel, pelo link (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/hospedagem/") ||
    // Portal do patrocinador, pelo link (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/patrocinador/") ||
    // Tela de palco pelo link (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/palco/") ||
    // Ficha técnica do espaço, pelo link (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/ficha/") ||
    // Tabelas para a transportadora e a locadora, pelo link (sem login): o código do link, conferido no servidor, é a autorização.
    pathname.startsWith("/tabela/") ||
    // Compra de ingressos e os ingressos de um pedido (sem login): o id da sessão e o do pedido (UUID sorteado) são a prova; o servidor confere tudo.
    pathname.startsWith("/comprar/") ||
    pathname.startsWith("/pedido/") ||
    pathname.startsWith("/espera/") ||
    pathname.startsWith("/novidades/") ||
    pathname.startsWith("/porta/") ||
    pathname === "/bilheteria/entrar" ||
    pathname.startsWith("/embed/") ||
    // Convite de convidado da prestação (P5.3): o banco confere o link; o aceite pede login.
    pathname.startsWith("/convite/") ||
    pathname.startsWith("/.well-known") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/termos" ||
    pathname === "/termos-de-compra" ||
    pathname === "/privacidade" ||
    pathname === "/incentivadores" ||
    pathname === "/crm" ||
    pathname === "/precos" ||
    pathname === "/prestacao-de-contas" ||
    pathname === "/ticketeria";

  // Quem não entrou na bilheteria volta para a entrada dela, não para o login do Jards.
  if (!user && !isPublicRoute && (pathname === "/bilheteria" || pathname.startsWith("/bilheteria/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/bilheteria/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Usuário não logado tentando acessar rota privada → login
  if (!user && !isPublicRoute) {
    const nextPath = pathname + request.nextUrl.search;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url);
  }

  // Usuário logado acessando login → página de entrada
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = await paginaDeEntradaDe(supabase, user.id);
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  // Quem não usa a captação em nenhuma organização (só a produção, por exemplo)
  // não passa por ela ao entrar: abrir /dashboard (depois do login, pela raiz ou
  // por um favorito) leva à página inicial do módulo que usa, antes de qualquer
  // tela. Só vale para abertura de página: a navegação dentro do app (RSC) e a
  // pré-busca não trazem Sec-Fetch-Dest "document" e seguem pelo layout de
  // cliente, que conhece a organização aberta. A consulta que falha não tira
  // ninguém da captação. A busca (?_imp=1&...) vai junto no redirecionamento.
  if (user && pathname === "/dashboard" && request.method === "GET" && request.headers.get("sec-fetch-dest") === "document") {
    const entrada = await paginaDeEntradaDe(supabase, user.id);
    if (entrada !== INICIO_DO_MODULO.captacao) {
      const url = request.nextUrl.clone();
      url.pathname = entrada;
      const redirecionamento = NextResponse.redirect(url);
      // O token pode ter sido renovado nesta requisição: o redirecionamento leva os cookies novos.
      supabaseResponse.cookies.getAll().forEach(cookie => redirecionamento.cookies.set(cookie));
      return redirecionamento;
    }
  }

  return supabaseResponse;
}

/** O proxy não espera mais que isto pela leitura que decide a página de entrada (a consulta normal leva dezenas de ms). */
const LIMITE_DA_LEITURA_MS = 1_500;

/** Página de entrada de quem está logado, lida do banco; sem leitura completa (ou fora do prazo), a da captação. */
async function paginaDeEntradaDe(supabase: Parameters<typeof lerAcessoAosModulos>[0], userId: string): Promise<string> {
  return entradaDoAcesso(await lerAcessoAosModulos(supabase, userId, { limiteMs: LIMITE_DA_LEITURA_MS }));
}

export const config = {
  matcher: [
    // dados/: tabelas públicas que a tela baixa (CNAE do IBGE), sem passar pela sessão.
    // widget/: o script que o produtor cola no site dele (WordPress, Wix...), aberto a qualquer um.
    // menu-site.css/js: o menu das páginas públicas; sem isto, quem está deslogado recebia o redirecionamento para o login.
    "/((?!_next/static|_next/image|favicon.ico|consentimento\\.js$|folha-sw\\.js$|origem-campanha\\.js$|menu-site\\.(?:css|js)$|dados/|widget/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4|webm|ttf|woff|woff2|otf|eot)$).*)",
  ],
};
