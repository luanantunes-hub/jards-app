// Validação do site informado pelo usuário para um projeto.
// A mesma regra roda no banco (função public.url_site_permitida, migration
// 20260930000000_projeto_incentivo_sites_usuario.sql) — manter as duas listas em sincronia.

const PADROES_BLOQUEADOS =
  /(porn|xxx|xvideo|xnxx|xhamster|redtube|youporn|pornhub|spankbang|tnaflix|tube8|brazzers|onlyfans|fansly|chaturbate|bongacams|camsoda|stripchat|livejasmin|myfreecams|erome|fapello|rule34|hentai|nsfw|motherless|efukt|thothub|camgirl|camwhore|sexcam|sexshop|sexchat|putaria|punheta|buceta|safadinha|novinhas|redwap|beeg|eporner|xtube|gostosas)/i;

export type ResultadoUrlSite = { ok: true; url: string } | { ok: false; erro: string };

export function validarUrlSite(entrada: string): ResultadoUrlSite {
  let texto = entrada.trim();
  if (!texto) return { ok: false, erro: "Informe o endereço do site." };
  if (/^[a-z][a-z0-9+.-]*:/i.test(texto) && !/^https?:\/\//i.test(texto)) {
    return { ok: false, erro: "Use um endereço que comece com http:// ou https://." };
  }
  if (!/^https?:\/\//i.test(texto)) texto = `https://${texto}`;

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { ok: false, erro: "Endereço inválido." };
  }
  const host = url.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return { ok: false, erro: "Endereço inválido." };
  if (texto.length > 500) return { ok: false, erro: "Endereço muito longo." };
  if (PADROES_BLOQUEADOS.test(host)) return { ok: false, erro: "Este tipo de site não é permitido." };
  return { ok: true, url: url.toString() };
}
