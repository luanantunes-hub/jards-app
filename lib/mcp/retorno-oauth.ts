/** Escapa texto para HTML, inclusive dentro de atributos entre aspas. */
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

interface PaginaDeRetorno {
  /** Endereço de volta ao assistente (callback OAuth), já com code/state ou error. */
  destino: string;
  titulo: string;
  mensagem: string;
}

/**
 * Página que devolve a pessoa ao assistente (Claude, ChatGPT) depois do Permitir ou do Negar.
 *
 * Não pode ser um redirect direto da resposta do formulário: a política de segurança do Jards
 * (form-action 'self') faz o navegador bloquear o redirect de um formulário para outro site, e a tela
 * de consentimento ficava parada em "Autorizando…". O refresh da página não passa por essa regra.
 * Sem script de propósito: o link embaixo cobre quem tiver o refresh desligado.
 */
export function paginaDeRetorno({ destino, titulo, mensagem }: PaginaDeRetorno): string {
  const href = escaparHtml(destino);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="0;url=${href}">
<title>${escaparHtml(titulo)} — Jards</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#282525;font:1rem/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:26rem;padding:1.5rem;text-align:center}
h1{margin:0 0 .5rem;font-size:1.125rem;font-weight:600}
p{margin:.5rem 0;color:rgba(13,13,13,.65);font-size:.9375rem}
a{color:#7259b5}
</style>
</head>
<body>
<main>
<h1>${escaparHtml(titulo)}</h1>
<p>${escaparHtml(mensagem)}</p>
<p>Se nada acontecer em alguns segundos, <a href="${href}">continue por aqui</a>.</p>
</main>
</body>
</html>
`;
}
