import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Liga a biblioteca de idiomas (next-intl) ao pedido: i18n/request.ts diz qual idioma e quais textos servem cada tela.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDevelopment = process.env.NODE_ENV !== "production";

const construirContentSecurityPolicy = (frameAncestors: string) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://js.stripe.com https://cdn.tailwindcss.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com`,
  "script-src-attr 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://www.googletagmanager.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://pagead2.googlesyndication.com https://www.google.com https://google.com https://www.google.com.br https://*.doubleclick.net https://www.googleadservices.com${isDevelopment ? " http://localhost:* ws://localhost:*" : ""}`,
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://td.doubleclick.net https://www.googletagmanager.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-ancestors ${frameAncestors}`,
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const contentSecurityPolicy = construirContentSecurityPolicy("'none'");
// A programação para embutir (/embed/...) é a única página que outro site pode abrir num iframe: só mostra dados públicos.
const contentSecurityPolicyParaEmbutir = construirContentSecurityPolicy("*");

const cabecalhosComuns = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Só a origem, também entre páginas do próprio site: caminhos internos
  // (/p/<slug>, /login?next=…) não vazam como referrer para scripts de terceiros.
  { key: "Referrer-Policy", value: "strict-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), clipboard-write=(self)" },
  ...(isDevelopment
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Tudo, menos /embed/: não pode ser aberto dentro de outro site e não usa a câmera. (A porta da Produção, que usava a
      // câmera, saiu na T1 da Ticketeria; a leitura de ingressos da Ticketeria terá a regra dela quando existir.)
      { source: "/((?!embed/).*)", headers: [...cabecalhosComuns, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicyParaEmbutir }, ...cabecalhosComuns.filter(cabecalho => cabecalho.key !== "Content-Security-Policy")] },
    ];
  },
  // O blog virou "Publicações" (/publicacoes): as páginas antigas redirecionam
  // de vez. Arquivos em /blog/... (capas, imagens e fontes em public/blog)
  // continuam servidos ali, por isso o slug redirecionado não tem ponto nem barra.
  async redirects() {
    return [
      { source: "/blog", destination: "/publicacoes", permanent: true },
      { source: "/blog/:slug([^./]+)", destination: "/publicacoes/:slug", permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
