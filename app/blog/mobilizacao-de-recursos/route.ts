import { html } from "./html";

// Rota estática: tem prioridade sobre /blog/[slug] para este endereço.
// Fora do layout do blog, então o aviso de cookies e o acesso às
// preferências entram aqui.
const RODAPE = '<a href="https://jards.com.br">jards.com.br</a>\n</footer>';
const RODAPE_COM_PRIVACIDADE =
  '<span style="display:flex;gap:16px;flex-wrap:wrap">' +
  '<a href="/privacidade">Política de Privacidade</a>' +
  '<button type="button" data-preferencias-cookies style="padding:0;border:0;background:none;font:inherit;color:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:2px">Preferências de cookies</button>' +
  '<a href="https://jards.com.br">jards.com.br</a></span>\n</footer>';

const pagina = html
  .replace("</head>", '<script src="/consentimento.js" defer></script>\n</head>')
  .replace(RODAPE, RODAPE_COM_PRIVACIDADE);

export function GET() {
  return new Response(pagina, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
