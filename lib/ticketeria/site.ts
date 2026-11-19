// O site público da loja na Ticketeria (veio da Produção na T1, 18/11/2026; desenho da PD12.1 e PD12.1b): os blocos fixos de
// uma página (sem HTML livre), o endereço da página, e o domínio da pessoa (como lê o que ela digita e os registros de DNS que
// ela precisa criar). Sem tela e sem banco.

// ─── Blocos ─────────────────────────────────────────────────────────────────

export const TIPOS_DE_BLOCO = ["titulo", "texto", "imagem", "botao", "programacao", "contato"] as const;
export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

export const ROTULO_DO_TIPO_DE_BLOCO: Record<TipoDeBloco, string> = {
  titulo: "Título", texto: "Texto", imagem: "Imagem", botao: "Botão com link", programacao: "Programação de um espaço (Produção)", contato: "Contato",
};

export type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "imagem"; url: string; alt: string }
  | { tipo: "botao"; rotulo: string; url: string }
  /** As sessões confirmadas de um espaço da Produção da mesma organização; sem espaço, o bloco não mostra nada. */
  | { tipo: "programacao"; titulo: string; espaco_id: string | null }
  | { tipo: "contato"; email: string; telefone: string; endereco: string };

export const MAX_BLOCOS_POR_PAGINA = 60;

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O endereço de um link ou de uma imagem do site: só https (nada de javascript:, data: ou http solto), até 500 letras. */
export function lerUrlHttps(bruto: unknown): { ok: true; url: string } | { ok: false } {
  const valor = texto(bruto);
  if (valor.length === 0 || valor.length > 500) return { ok: false };
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hostname.length === 0) return { ok: false };
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false };
  }
}

export type LeituraDoBloco = { ok: true; bloco: Bloco } | { ok: false; erro: string };

/** Um bloco como o site guarda: o tipo vem da lista, os textos têm limite, link e imagem só em https, e a imagem exige texto alternativo. */
export function lerBloco(entrada: unknown): LeituraDoBloco {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  switch (e.tipo) {
    case "titulo": {
      const t = texto(e.texto);
      return t === "" || t.length > 120 ? { ok: false, erro: "O título tem de 1 a 120 letras." } : { ok: true, bloco: { tipo: "titulo", texto: t } };
    }
    case "texto": {
      const t = texto(e.texto);
      return t === "" || t.length > 5000 ? { ok: false, erro: "O texto tem de 1 a 5.000 letras." } : { ok: true, bloco: { tipo: "texto", texto: t } };
    }
    case "imagem": {
      const url = lerUrlHttps(e.url), alt = texto(e.alt);
      if (!url.ok) return { ok: false, erro: "O endereço da imagem tem de começar com https://." };
      if (alt === "" || alt.length > 200) return { ok: false, erro: "Descreva a imagem em até 200 letras (texto alternativo)." };
      return { ok: true, bloco: { tipo: "imagem", url: url.url, alt } };
    }
    case "botao": {
      const url = lerUrlHttps(e.url), rotulo = texto(e.rotulo);
      if (rotulo === "" || rotulo.length > 60) return { ok: false, erro: "O texto do botão tem de 1 a 60 letras." };
      if (!url.ok) return { ok: false, erro: "O endereço do botão tem de começar com https://." };
      return { ok: true, bloco: { tipo: "botao", rotulo, url: url.url } };
    }
    case "programacao": {
      const titulo = texto(e.titulo), espaco = texto(e.espaco_id);
      if (titulo.length > 120) return { ok: false, erro: "O título da programação pode ter até 120 letras." };
      if (espaco !== "" && !UUID.test(espaco)) return { ok: false, erro: "Escolha o espaço da programação." };
      return { ok: true, bloco: { tipo: "programacao", titulo, espaco_id: espaco === "" ? null : espaco.toLowerCase() } };
    }
    case "contato": {
      const email = texto(e.email), telefone = texto(e.telefone), endereco = texto(e.endereco);
      if (email === "" && telefone === "" && endereco === "") return { ok: false, erro: "Informe ao menos um contato: e-mail, telefone ou endereço." };
      if (email !== "" && (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) return { ok: false, erro: "O e-mail do contato não parece certo." };
      if (telefone.length > 40) return { ok: false, erro: "O telefone pode ter até 40 letras." };
      if (endereco.length > 200) return { ok: false, erro: "O endereço pode ter até 200 letras." };
      return { ok: true, bloco: { tipo: "contato", email, telefone, endereco } };
    }
    default:
      return { ok: false, erro: "Escolha o tipo do bloco." };
  }
}

export type LeituraDosBlocos = { ok: true; blocos: Bloco[] } | { ok: false; erro: string };

/** Os blocos de uma página: de 0 a 60, cada um válido. O erro diz qual bloco. */
export function lerBlocos(entradas: readonly unknown[]): LeituraDosBlocos {
  if (entradas.length > MAX_BLOCOS_POR_PAGINA) return { ok: false, erro: `A página aceita até ${MAX_BLOCOS_POR_PAGINA} blocos.` };
  const blocos: Bloco[] = [];
  for (const [indice, entrada] of entradas.entries()) {
    const leitura = lerBloco(entrada);
    if (!leitura.ok) return { ok: false, erro: `Bloco ${indice + 1}: ${leitura.erro}` };
    blocos.push(leitura.bloco);
  }
  return { ok: true, blocos };
}

/** Os blocos que vêm do banco, para desenhar: o que não passa na leitura some (o banco só confere que é uma lista). */
export function blocosDoJson(json: unknown): Bloco[] {
  return (Array.isArray(json) ? json : []).flatMap(entrada => { const leitura = lerBloco(entrada); return leitura.ok ? [leitura.bloco] : []; }).slice(0, MAX_BLOCOS_POR_PAGINA);
}

/** O endereço da página a partir do título ("Quem somos" vira "quem-somos"); vazio vira "pagina". */
export function slugDaPagina(titulo: string, usados: ReadonlySet<string> = new Set()): string {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36).replace(/-+$/g, "") || "pagina";
  if (!usados.has(base)) return base;
  for (let n = 2; n < 100; n++) if (!usados.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${usados.size + 1}`;
}

/** A cor do tema ("#RRGGBB"); outra coisa vira o grafite do Jards. */
export function corDoTema(cor: unknown): string {
  return typeof cor === "string" && /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#282525";
}

/** Branco ou grafite, o que fica mais legível sobre a cor do tema (contraste pela luminância). */
export function textoSobreCor(cor: string): "#ffffff" | "#282525" {
  const n = parseInt(corDoTema(cor).slice(1), 16);
  const canal = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const luminancia = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  return luminancia > 0.4 ? "#282525" : "#ffffff";
}

// ─── Domínio ────────────────────────────────────────────────────────────────

/** Os endereços do próprio Jards: nunca viram domínio de site (o site abre só no domínio da pessoa). */
const DOMINIOS_DO_JARDS = ["jards.com.br", "vercel.app", "vercel.com", "localhost", "local", "internal", "test", "invalid", "example"];

export type LeituraDoDominio = { ok: true; dominio: string } | { ok: false; erro: string };

/**
 * O domínio como a pessoa digita ("https://www.Casa.com.br/" vira "www.casa.com.br"): sem endereço, caminho, porta nem ponto
 * final; letras minúsculas; com ao menos um ponto; rótulos de até 63 letras. Recusa IP, o domínio do Jards e endereços de teste.
 */
export function lerDominio(bruto: string): LeituraDoDominio {
  let d = bruto.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (d === "") return { ok: false, erro: "Informe o domínio do site, como www.casa.com.br." };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d)) return { ok: false, erro: "Use o nome do domínio, não o número IP." };
  if (d.length > 253 || !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return { ok: false, erro: "Esse domínio não parece certo. Escreva só o nome, como www.casa.com.br." };
  if (DOMINIOS_DO_JARDS.some(proibido => d === proibido || d.endsWith(`.${proibido}`))) return { ok: false, erro: "Este endereço é do próprio Jards. Use o domínio da sua casa, festival ou companhia." };
  d = d.normalize("NFC");
  return { ok: true, dominio: d };
}

/** O host de um pedido ("Casa.com.br:443" vira "casa.com.br"), para achar o site. Vazio se não for um nome. */
export function hostDoPedido(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

const SEGUNDOS_NIVEIS = new Set(["com.br", "org.br", "net.br", "art.br", "tv.br", "gov.br", "edu.br", "mus.br", "co.uk", "org.uk", "com.au", "com.ar", "com.pt", "co.nz", "co.za"]);

/** O domínio "raiz" (sem www nem outro prefixo)? Nele o DNS usa um registro A; num prefixo, um CNAME. */
export function ehDominioRaiz(dominio: string): boolean {
  const partes = dominio.split(".");
  return partes.length === 2 || (partes.length === 3 && SEGUNDOS_NIVEIS.has(partes.slice(1).join(".")));
}

export type RegistroDeDns = { tipo: "A" | "CNAME" | "TXT"; nome: string; valor: string; para: "apontar" | "provar" };

/** Os valores padrão da Vercel; o servidor usa os que a API dela devolve para o domínio quando existem. */
export const REGISTRO_A_PADRAO = "76.76.21.21";
export const REGISTRO_CNAME_PADRAO = "cname.vercel-dns.com";

/** O prefixo do TXT de posse: prova que quem cadastrou o domínio controla o DNS dele. */
export const PREFIXO_DA_PROVA = "_jards-verificacao";

/**
 * Os dois registros que a pessoa cria no DNS: um que aponta o domínio para o Jards (A no raiz, CNAME no resto) e um TXT com o
 * código de verificação, que prova que ela controla o DNS. Os valores de apontar podem vir da API da Vercel.
 */
export function registrosDeDns(dominio: string, token: string, apontar?: { a?: string; cname?: string }): RegistroDeDns[] {
  const raiz = ehDominioRaiz(dominio);
  return [
    raiz
      ? { tipo: "A", nome: "@ (o próprio domínio)", valor: apontar?.a ?? REGISTRO_A_PADRAO, para: "apontar" }
      : { tipo: "CNAME", nome: dominio.split(".")[0], valor: apontar?.cname ?? REGISTRO_CNAME_PADRAO, para: "apontar" },
    { tipo: "TXT", nome: `${PREFIXO_DA_PROVA}.${dominio}`, valor: token, para: "provar" },
  ];
}

/** Onde procurar o TXT de posse no DNS. */
export const nomeDaProva = (dominio: string) => `${PREFIXO_DA_PROVA}.${dominio}`;

/** O TXT do DNS (uma lista de pedaços por registro) tem o token? */
export function provaConfere(registros: readonly (readonly string[])[], token: string): boolean {
  return registros.some(partes => partes.join("").trim() === token);
}

/** Os espaços da Produção que os blocos de programação mostram, sem repetir. */
export function espacosDosBlocos(blocos: readonly Bloco[]): string[] {
  return [...new Set(blocos.flatMap(bloco => (bloco.tipo === "programacao" && bloco.espaco_id ? [bloco.espaco_id] : [])))];
}

/** Ordem simples de um item do menu do site: início primeiro, o resto pela ordem e pelo título. */
export function ordemDasPaginas<T extends { slug: string; ordem: number; titulo: string }>(paginas: readonly T[]): T[] {
  return [...paginas].sort((a, b) => Number(b.slug === "inicio") - Number(a.slug === "inicio") || a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

/**
 * O pedido é para o próprio Jards (o app, as páginas públicas, os previews da Vercel) ou para o domínio de uma pessoa? Tudo o que
 * não é do Jards é tratado como domínio de site: se não tem site ativo, a página responde "não encontrado" (o app nunca abre em
 * endereço que não conhece).
 */
export function ehHostDoApp(host: string, urlDoApp?: string): boolean {
  const h = hostDoPedido(host);
  if (h === "" || h === "localhost" || h === "127.0.0.1" || h.endsWith(".localhost")) return true;
  if (h === "jards.com.br" || h.endsWith(".jards.com.br") || h.endsWith(".vercel.app")) return true;
  if (urlDoApp) {
    try {
      const doApp = new URL(urlDoApp).hostname.toLowerCase();
      if (h === doApp || h === `www.${doApp}` || `www.${h}` === doApp) return true;
    } catch {
      // URL do app mal escrita: só valem os endereços acima.
    }
  }
  return false;
}

// ─── SEO ────────────────────────────────────────────────────────────────────

export type LeituraDoSeo = { ok: true; descricao: string | null; imagem_url: string | null } | { ok: false; erro: string };

/** A descrição (até 300 letras) e a imagem de compartilhamento (https) da página; vazio é "sem". */
export function lerSeo(campos: { descricao: string; imagem: string }): LeituraDoSeo {
  const descricao = campos.descricao.trim();
  if (descricao.length > 300) return { ok: false, erro: "A descrição pode ter até 300 letras." };
  const imagem = campos.imagem.trim();
  if (imagem === "") return { ok: true, descricao: descricao === "" ? null : descricao, imagem_url: null };
  const url = lerUrlHttps(imagem);
  if (!url.ok) return { ok: false, erro: "O endereço da imagem tem de começar com https://." };
  return { ok: true, descricao: descricao === "" ? null : descricao, imagem_url: url.url };
}

const escapaXml = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** O endereço completo de uma página do site no domínio da pessoa (a de início é a raiz). */
export const enderecoDaPagina = (host: string, slug: string) => (slug === "inicio" ? `https://${host}/` : `https://${host}/${slug}`);

/** O sitemap.xml do domínio: as páginas publicadas, com a data da última publicação. */
export function sitemapDoSite(host: string, paginas: readonly { slug: string; publicada_em: string | null }[]): string {
  const itens = paginas.map(pagina => `  <url><loc>${escapaXml(enderecoDaPagina(host, pagina.slug))}</loc>${pagina.publicada_em ? `<lastmod>${escapaXml(pagina.publicada_em.slice(0, 10))}</lastmod>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${itens}\n</urlset>\n`;
}

/** O robots.txt do domínio: libera tudo e aponta o sitemap quando o site está no ar; fecha quando não. */
export function robotsDoSite(host: string, noAr: boolean): string {
  return noAr ? `User-agent: *\nAllow: /\nSitemap: https://${host}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n";
}

