// O MONITORAMENTO DA IMPRENSA feito pelo Jards (decisão do dono, 23/11/2026: esquema misto, sem serviço pago, sem buscador e sem assinatura pessoal). Todo dia o Jards lê o RSS dos
// veículos que cada casa acompanha (a lista pública de notícias que o próprio site publica para leitura automática) e procura o nome dos eventos à venda. Nas matérias abertas procura também
// no texto, só para achar o nome (nada da matéria é guardado: só o título, o link e a data); nas fechadas, só no título e no resumo. Respeita o robots.txt de cada site.
// CLARO (o nome do evento junto do nome do espaço ou do artista) entra sozinho como marcação de imprensa, com "desfazer"; DÚBIO (só o nome do evento: "Hamlet" está em muita notícia que
// não é da casa) espera a confirmação do produtor. Sem banco, sem rede e sem imports de servidor: roda nos testes (tests/ticketeria-imprensa-monitor.test.ts).

/** A grande imprensa que já vem na lista de cada casa (as seções de cultura). O peso de cada uma continua vindo das vendas da casa, não desta lista. */
export const VEICULOS_PADRAO: { nome: string; site: string; feed: string }[] = [
  { nome: "Folha de S.Paulo · Ilustrada", site: "https://www1.folha.uol.com.br/ilustrada/", feed: "https://feeds.folha.uol.com.br/ilustrada/rss091.xml" },
  { nome: "Estadão · Cultura", site: "https://www.estadao.com.br/cultura/", feed: "https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/cultura/" },
  { nome: "g1 · Pop & Arte", site: "https://g1.globo.com/pop-arte/", feed: "https://g1.globo.com/rss/g1/pop-arte/" },
];

/** Os nomes curtos demais (até 3 letras) não são procurados: bateriam em qualquer texto. */
export const MIN_LETRAS_DO_TERMO = 4;
/** Na primeira leitura de um veículo, olha as notícias dos últimos tantos dias; depois, desde a última leitura (com um dia de folga). */
export const DIAS_DA_PRIMEIRA_LEITURA = 7;
/** Quantas matérias de um veículo o Jards abre por leitura para procurar no texto (as demais, só pelo título e resumo). */
export const MAX_MATERIAS_POR_LEITURA = 20;

export type NoticiaDoFeed = { titulo: string; link: string; resumo: string; publicado: string | null };
export type Motivo = "evento_e_espaco" | "evento_e_artista" | "so_evento" | "evento_no_texto";

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ccedil: "ç", Ccedil: "Ç", ntilde: "ñ", Ntilde: "Ñ", ordm: "º", ordf: "ª", deg: "°",
  ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", copy: "©", reg: "®",
};
// As vogais acentuadas do português (&aacute; &Atilde; &ecirc; …).
for (const [nome, marca] of [["acute", "\u0301"], ["grave", "\u0300"], ["circ", "\u0302"], ["tilde", "\u0303"], ["uml", "\u0308"]] as const) {
  for (const v of "aeiouAEIOU") ENTIDADES[`${v}${nome}`] = `${v}${marca}`.normalize("NFC");
}
/** Tira as entidades HTML (&amp; &#233; &#xE9;). */
export const semEntidades = (t: string): string => t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " "; }
  return ENTIDADES[e] ?? ENTIDADES[e.toLowerCase()] ?? m;
});
const semCdata = (t: string): string => t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
/** O texto visível de um pedaço de HTML: sem scripts, estilos e marcas, com as entidades resolvidas e os espaços juntos. */
export function textoDoHtml(html: string): string {
  return semEntidades(html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
const campo = (bloco: string, nomes: string[]): string => {
  for (const n of nomes) {
    const m = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i").exec(bloco);
    if (m) return textoDoHtml(semCdata(m[1]));
  }
  return "";
};
/** O dia (AAAA-MM-DD) de uma data de RSS ("Mon, 23 Nov 2026 10:00:00 -0300") ou Atom ("2026-11-23T10:00:00Z"); null se não dá para ler. */
export function diaDaData(t: string): string | null {
  const ms = Date.parse(t.trim());
  if (!Number.isFinite(ms)) return null;
  return new Date(ms - 3 * 3600000).toISOString().slice(0, 10); // no horário de Brasília
}

/** As notícias de um RSS (item) ou Atom (entry): título, link, resumo e dia. Notícia sem título ou sem link https fica de fora. */
export function lerFeed(xml: string): NoticiaDoFeed[] {
  const saida: NoticiaDoFeed[] = [];
  for (const m of xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
    const bloco = m[2];
    const titulo = campo(bloco, ["title"]).slice(0, 300);
    let link = campo(bloco, ["link"]);
    if (!/^https?:\/\//i.test(link)) link = /<link[^>]*href=["']([^"']+)["']/i.exec(bloco)?.[1] ?? "";
    if (!/^https?:\/\//i.test(link)) link = campo(bloco, ["guid"]);
    link = semEntidades(link.trim());
    if (!titulo || !/^https?:\/\//i.test(link) || link.length > 1000) continue;
    const data = campo(bloco, ["pubDate", "published", "updated", "dc:date"]);
    saida.push({ titulo, link, resumo: campo(bloco, ["description", "summary", "content:encoded", "content"]).slice(0, 4000), publicado: data ? diaDaData(data) : null });
  }
  return saida;
}

/** O RSS que a própria página anuncia (<link rel="alternate" type="application/rss+xml" href>), com o endereço completo; null se não anuncia. */
export function feedAnunciado(html: string, base: string): string | null {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["']?alternate/i.test(tag) || !/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    try { const u = new URL(semEntidades(href), base); if (u.protocol === "https:" || u.protocol === "http:") return u.toString(); } catch { /* endereço quebrado: segue */ }
  }
  return null;
}
/** O RSS de portais grandes que seguem um padrão conhecido e nem sempre o anunciam na página (o g1 regional: g1.globo.com/sp/sorocaba-jundiai/ → /rss/g1/sp/sorocaba-jundiai/). */
export function feedPorPadrao(site: string): string | null {
  try {
    const u = new URL(site);
    if (u.hostname === "g1.globo.com" && u.pathname.length > 1 && !u.pathname.startsWith("/rss/")) return `https://g1.globo.com/rss/g1${u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`}`;
  } catch { /* endereço quebrado */ }
  return null;
}
/** Os caminhos de RSS mais comuns para tentar quando a página não anuncia (WordPress e afins). */
export const CAMINHOS_COMUNS_DE_FEED = ["/feed/", "/rss/", "/rss.xml", "/feed.xml", "/index.xml"];
/** Parece um RSS ou Atom (para não confundir uma página de erro com um feed). */
export const pareceFeed = (texto: string): boolean => /<(rss|feed|rdf:RDF)\b/i.test(texto.slice(0, 2000));

const SEPARADOR_DA_SECAO = " · ";
/** O endereço de site colado pelo produtor, conferido: http(s), com domínio de verdade (sem IP, sem localhost, sem porta estranha). "portaldacidade.com.br" vira "https://portaldacidade.com.br/". */
export function lerSite(entrada: string): { ok: true; site: string; nome: string } | { ok: false; erro: string } {
  let t = entrada.trim();
  if (!t) return { ok: false, erro: "Cole o endereço do site." };
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
  let u: URL;
  try { u = new URL(t); } catch { return { ok: false, erro: "Esse endereço não parece um site. Ex.: portaldacidade.com.br" }; }
  const host = u.hostname.toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^\d+(\.\d+){3}$/.test(host) || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost" || (u.port && u.port !== "80" && u.port !== "443") || u.username || u.password) {
    return { ok: false, erro: "Esse endereço não parece um site. Ex.: portaldacidade.com.br" };
  }
  const site = `${u.protocol}//${host}${u.pathname || "/"}`.slice(0, 300);
  // O nome: o domínio sem "www" e, se o endereço aponta para uma seção, a última parte dela ("g1.globo.com · sorocaba-jundiai").
  const secao = u.pathname.split("/").filter(Boolean).at(-1);
  const nome = `${host.replace(/^www\d?\./, "")}${secao ? `${SEPARADOR_DA_SECAO}${decodeURIComponent(secao).slice(0, 40)}` : ""}`.slice(0, 80);
  return { ok: true, site, nome };
}

/**
 * Se o robots.txt deixa um robô qualquer ("User-agent: *") ler este caminho: vale a regra mais longa entre Allow e Disallow que começa o caminho (o padrão do robots.txt). Sem regra, pode.
 */
export function robotsPermite(robots: string, caminho: string): boolean {
  const grupos: { agentes: string[]; regras: { permite: boolean; prefixo: string }[] }[] = [];
  let atual: (typeof grupos)[number] | null = null;
  let ultimaFoiAgente = false;
  for (const bruta of robots.split(/\r?\n/)) {
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(bruta.replace(/#.*/, "").trim());
    if (!m) continue;
    const chave = m[1].toLowerCase(), valor = m[2].trim();
    if (chave === "user-agent") {
      if (!atual || !ultimaFoiAgente) { atual = { agentes: [], regras: [] }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
      ultimaFoiAgente = true;
      continue;
    }
    ultimaFoiAgente = false;
    if (atual && (chave === "allow" || chave === "disallow") && valor) atual.regras.push({ permite: chave === "allow", prefixo: valor });
  }
  // O padrão do robots.txt: começa no início do caminho, "*" vale qualquer trecho e "$" marca o fim. Vence o padrão mais longo.
  const casa = (padrao: string): boolean => {
    const fim = padrao.endsWith("$");
    const corpo = (fim ? padrao.slice(0, -1) : padrao).split("*").map(p => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    return new RegExp(`^${corpo}${fim ? "$" : ""}`).test(caminho);
  };
  let melhor: { permite: boolean; prefixo: string } | null = null;
  for (const r of grupos.filter(g => g.agentes.includes("*")).flatMap(g => g.regras)) {
    if (casa(r.prefixo) && (!melhor || r.prefixo.length > melhor.prefixo.length || (r.prefixo.length === melhor.prefixo.length && r.permite))) melhor = r;
  }
  return melhor ? melhor.permite : true;
}

/** Para comparar: sem acento, sem maiúscula, só letras e números separados por um espaço. */
export const normalizarTexto = (t: string | null | undefined): string => ` ${(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
const contem = (textoNormal: string, termo: string | null | undefined): boolean => {
  const n = normalizarTexto(termo).trim();
  return n.replace(/ /g, "").length >= MIN_LETRAS_DO_TERMO && textoNormal.includes(` ${n} `);
};

export type EventoProcurado = { id: string; titulo: string; artista: string | null; locais: string[] };

/**
 * O que uma notícia diz de um evento: null se não cita o evento; senão o motivo. Claro (entra sozinho): o nome do evento junto do nome de um espaço do evento ou do artista, em qualquer
 * parte (título, resumo ou texto). Dúbio: só o nome do evento, no título ou resumo ("so_evento") ou só no texto da matéria ("evento_no_texto").
 */
export function motivoDaNoticia(n: { titulo: string; resumo: string; texto?: string | null }, e: EventoProcurado): Motivo | null {
  const chamada = normalizarTexto(`${n.titulo} ${n.resumo}`);
  const tudo = n.texto ? normalizarTexto(`${n.titulo} ${n.resumo} ${n.texto}`) : chamada;
  if (!contem(tudo, e.titulo)) return null;
  if (e.locais.some(l => contem(tudo, l))) return "evento_e_espaco";
  if (contem(tudo, e.artista)) return "evento_e_artista";
  return contem(chamada, e.titulo) ? "so_evento" : "evento_no_texto";
}
export const motivoClaro = (m: Motivo): boolean => m === "evento_e_espaco" || m === "evento_e_artista";
/** A notícia vale a pena abrir para procurar no texto: cita algum termo da casa (evento, espaço ou artista) no título ou resumo, ou parece agenda ou estreia. */
export function valeAbrir(n: { titulo: string; resumo: string }, eventos: EventoProcurado[]): boolean {
  const chamada = normalizarTexto(`${n.titulo} ${n.resumo}`);
  if (eventos.some(e => contem(chamada, e.titulo) || contem(chamada, e.artista) || e.locais.some(l => contem(chamada, l)))) return true;
  return /\b(agenda|programacao|fim de semana|o que fazer|roteiro|estreia|estreias|em cartaz|temporada)\b/.test(chamada);
}

export const FRASE_DO_MOTIVO: Record<Motivo, string> = {
  evento_e_espaco: "tinha o nome do evento e do espaço",
  evento_e_artista: "tinha o nome do evento e do artista",
  so_evento: "só o nome do evento",
  evento_no_texto: "o nome do evento no texto, sem o espaço",
};
export const FRASE_DA_SITUACAO: Record<"aguardando" | "lendo" | "sem_rss" | "bloqueado" | "erro", string> = {
  aguardando: "ainda não lido", lendo: "lendo", sem_rss: "não achamos o RSS deste site", bloqueado: "o site bloqueia a leitura automática", erro: "não deu para ler na última vez",
};
