// Vigia das páginas e arquivos dos órgãos (P6.1).
//
// A rotina jards-agente-paginas chama a função agente-normativo no modo
// "paginas": cada fonte vencida (normas_fontes do tipo pagina ou arquivo) é
// baixada, o conteúdo que importa vira texto e o hash desse texto diz se a
// fonte mudou desde a última coleta. Se mudou, a versão nova fica em
// normas_documentos, com a cópia do que foi baixado no bucket normas, e o
// super admin vê a diferença lado a lado em /admin/normas.
//
// Ficam fora do hash os menus, o rodapé, os botões de compartilhar e a data de
// "atualizado em", que muda sem o texto mudar. Entram o texto principal e a
// lista de arquivos ligados: um manual novo aparece como um link novo.
//
// Os sites do gov.br feitos em Volto (ANCINE, Esporte, Saúde) montam o texto
// no navegador: o HTML chega quase vazio e o conteúdo está no JSON da API
// (++api++). Os de Plone clássico (Cultura) trazem o texto em #content. O
// Planalto publica em windows-1252 sem declarar.
//
// Usado pela função, pela tela (diferença entre versões) e pelos testes.

export type Recorte = { de: string; ate?: string | null };

export type ArquivoLigado = { nome: string; url: string };

export type FormatoDoConteudo = "volto" | "html" | "pdf" | "docx" | "xlsx" | "odt" | "ods" | "arquivo";

export type ConteudoDaPagina = {
  formato: FormatoDoConteudo;
  titulo: string | null;
  texto: string;
  arquivos: ArquivoLigado[];
  /** Data de atualização que a própria página mostra; não entra no hash. */
  atualizadoEm: string | null;
};

/** Texto guardado por versão; acima disso a fonte precisa de recorte. */
export const TEXTO_MAXIMO_PAGINA = 1_000_000;

// ─── Texto ──────────────────────────────────────────────────────────────────

const LATIN1 = (
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 " +
  "acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml " +
  "Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde " +
  "Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig " +
  "ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide " +
  "oslash ugrave uacute ucirc uuml yacute thorn yuml"
).split(" ");

const ENTIDADES: Record<string, number> = {
  amp: 38, lt: 60, gt: 62, quot: 34, apos: 39,
  ndash: 8211, mdash: 8212, lsquo: 8216, rsquo: 8217, sbquo: 8218, ldquo: 8220, rdquo: 8221, bdquo: 8222,
  bull: 8226, hellip: 8230, euro: 8364, trade: 8482, prime: 8242,
  ...Object.fromEntries(LATIN1.map((nome, i) => [nome, 160 + i])),
};

export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (inteiro, codigo: string) => {
    if (codigo[0] === "#") {
      const n = codigo[1] === "x" || codigo[1] === "X" ? parseInt(codigo.slice(2), 16) : parseInt(codigo.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : inteiro;
    }
    const n = ENTIDADES[codigo] ?? ENTIDADES[codigo.toLowerCase()];
    return n ? String.fromCharCode(n) : inteiro;
  });
}

// Espaços de largura zero, marca de ordem de bytes e hífen opcional.
const INVISIVEIS = new RegExp("[" + [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0xad].map(c => String.fromCharCode(c)).join("") + "]", "g");

/** Uma linha por parágrafo, espaços simples, sem linhas vazias. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(INVISIVEIS, "")
    .split(/\r\n|\r|\n/)
    .map(linha => linha.replace(/\s+/g, " ").trim())
    .filter(linha => linha.length > 0)
    .join("\n");
}

/** Lê os bytes pelo charset declarado; sem declaração válida, tenta UTF-8 e cai no windows-1252. */
export function decodificarBytes(bytes: Uint8Array, contentType: string | null): string {
  const doCabecalho = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  const inicio = new TextDecoder("windows-1252").decode(bytes.subarray(0, 4096));
  const doMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(inicio)?.[1];
  const declarado = (doCabecalho ?? doMeta)?.toLowerCase();
  if (declarado && declarado !== "utf-8" && declarado !== "utf8") {
    try {
      return new TextDecoder(declarado).decode(bytes);
    } catch {
      // Rótulo desconhecido: segue para a detecção.
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// ─── HTML ───────────────────────────────────────────────────────────────────

/** Índice logo depois do fechamento do elemento aberto antes de `desde`; sem fechamento, `desde`. */
function fimDoElemento(html: string, tag: string, desde: number): number {
  const marca = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  marca.lastIndex = desde;
  let profundidade = 1;
  for (let m = marca.exec(html); m; m = marca.exec(html)) {
    if (m[1]) {
      profundidade -= 1;
      if (profundidade === 0) return m.index + m[0].length;
    } else if (!m[0].endsWith("/>")) {
      profundidade += 1;
    }
  }
  return desde;
}

/** Conteúdo do primeiro elemento cuja abertura casa com o padrão. */
export function conteudoDoElemento(html: string, abertura: RegExp): string | null {
  const m = new RegExp(abertura.source, abertura.flags.replace("g", "")).exec(html);
  if (!m) return null;
  const tag = /^<([a-z0-9]+)/i.exec(m[0])![1];
  const inicio = m.index + m[0].length;
  const fim = fimDoElemento(html, tag, inicio);
  if (fim === inicio) return html.slice(inicio);
  return html.slice(inicio, html.lastIndexOf("<", fim - 1));
}

const RUIDO = new RegExp(
  "<(nav|header|footer|aside|form|button|select)\\b[^>]*>" +
  "|<([a-z][a-z0-9]*)\\b[^>]*\\b(?:id|class)=[\"'][^\"']*" +
  "(?:compartilh|share|social|byline|breadcrumb|documentactions|related)[^\"']*[\"'][^>]*>",
  "gi",
);

/** Tira menus, rodapé, compartilhar e a linha de publicação, numa passada só. */
function semRuido(html: string): string {
  const partes: string[] = [];
  let desde = 0;
  RUIDO.lastIndex = 0;
  for (let m = RUIDO.exec(html); m; m = RUIDO.exec(html)) {
    const tag = (m[1] ?? m[2]).toLowerCase();
    const fim = fimDoElemento(html, tag, m.index + m[0].length);
    partes.push(html.slice(desde, m.index), " ");
    desde = fim;
    RUIDO.lastIndex = fim;
  }
  partes.push(html.slice(desde));
  return partes.join("");
}

/**
 * Texto do HTML com uma linha por bloco (parágrafo, item, linha de tabela).
 * A quebra de linha do código-fonte vale espaço, como no navegador: o
 * Planalto quebra os parágrafos no meio.
 */
export function textoDoHtml(html: string): string {
  const comQuebras = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/?(p|div|section|article|li|ul|ol|tr|table|thead|tbody|h[1-6]|blockquote|pre|dd|dt|dl|figure|figcaption|main)\b[^>]*>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]*>/g, "");
  return normalizarTexto(decodificarEntidades(comQuebras));
}

const ARQUIVO = /\.(pdf|docx?|xlsx?|odt|ods|odp|pptx?|zip|rar|csv)(?:$|[/?#])|@@(?:download|display-file)\//i;

export function ehLinkDeArquivo(url: string): boolean {
  return ARQUIVO.test(url);
}

function resolverUrl(href: string, base: string): string | null {
  try {
    const url = new URL(href.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function nomeDoArquivo(url: string): string {
  const caminho = url.replace(/\/@@(?:download|display-file)\/file$/i, "").replace(/[?#].*$/, "");
  try {
    return decodeURIComponent(caminho.slice(caminho.lastIndexOf("/") + 1)) || url;
  } catch {
    return caminho.slice(caminho.lastIndexOf("/") + 1) || url;
  }
}

/** O mesmo arquivo aparece como @@download e @@display-file: a chave ignora a visão. */
export function chaveDoArquivo(url: string): string {
  return url.replace(/\/@@(?:download|display-file)\/file$/i, "").replace(/#.*$/, "");
}

function juntarArquivo(lista: Map<string, ArquivoLigado>, nome: string, url: string | null) {
  if (!url || !ehLinkDeArquivo(url)) return;
  const chave = chaveDoArquivo(url);
  const atual = lista.get(chave);
  const limpo = nome.replace(/\s+/g, " ").trim();
  if (!atual) lista.set(chave, { nome: limpo || nomeDoArquivo(url), url });
  else if (!atual.nome && limpo) atual.nome = limpo;
}

function arquivosDoHtml(html: string, base: string, lista = new Map<string, ArquivoLigado>()): Map<string, ArquivoLigado> {
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = resolverUrl(decodificarEntidades(m[2]), base);
    juntarArquivo(lista, normalizarTexto(decodificarEntidades(m[3].replace(/<[^>]*>/g, " "))).replace(/\n/g, " "), url);
  }
  return lista;
}

/** O título do Plone (h1.documentFirstHeading) ou o da aba; o Planalto põe "Presidência da República" no h1. */
function tituloDoHtml(html: string): string | null {
  const h1 = /<h1\b[^>]*\bclass=["'][^"']*documentFirstHeading[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  const titulo = h1 ?? /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const texto = titulo ? textoDoHtml(titulo).replace(/\n/g, " ") : "";
  return texto || null;
}

function atualizadoNoHtml(html: string): string | null {
  const m = /(?:Atualizado|Modificado) em:?\s*(?:<[^>]*>\s*)*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}[h:]\d{2})?)/i.exec(html);
  return m ? m[1] : null;
}

/**
 * Plone clássico guarda título, descrição e texto em #content; o Volto
 * renderizado no servidor, em #page-document. Fora do gov.br, main, article
 * ou o corpo inteiro.
 */
function principal(html: string): string {
  const candidatos = /\bid=["']content-core["']/i.test(html)
    ? [/<div\b[^>]*\bid=["']content["'][^>]*>/i]
    : [/<div\b[^>]*\bid=["']page-document["'][^>]*>/i, /<main\b[^>]*>/i, /<article\b[^>]*>/i, /<body\b[^>]*>/i];
  for (const abertura of candidatos) {
    const conteudo = conteudoDoElemento(html, abertura);
    if (conteudo && conteudo.trim()) return conteudo;
  }
  return html;
}

export function conteudoDoHtml(html: string, base: string): Omit<ConteudoDaPagina, "formato"> {
  const limpo = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, " ");
  const corpo = semRuido(principal(limpo));
  return {
    titulo: tituloDoHtml(limpo),
    texto: textoDoHtml(corpo),
    arquivos: [...arquivosDoHtml(corpo, base).values()],
    atualizadoEm: atualizadoNoHtml(limpo),
  };
}

// ─── Volto (gov.br) ─────────────────────────────────────────────────────────

/** Endereço da API do Volto para uma página do gov.br: www.gov.br/<site>/++api++/<resto>. */
export function urlDaApiVolto(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "www.gov.br" || u.pathname.includes("++api++")) return null;
    const partes = u.pathname.split("/").filter(Boolean);
    if (partes.length < 2 || /@@|\.(pdf|docx?|xlsx?|odt|ods|zip)$/i.test(u.pathname)) return null;
    u.pathname = `/${partes[0]}/++api++/${partes.slice(1).join("/")}`;
    u.searchParams.set("b_size", "500");
    return u.toString();
  } catch {
    return null;
  }
}

type No = Record<string, unknown>;
const ehNo = (valor: unknown): valor is No => !!valor && typeof valor === "object" && !Array.isArray(valor);
const BLOCOS_SEM_TEXTO = new Set(["dateSocialShareBlock", "dividerLine", "image", "video", "maps", "search", "toc"]);

/** Texto de um valor do editor slate: parágrafos e itens em linhas, links guardados. */
function textoDoSlate(valor: unknown, arquivos: Map<string, ArquivoLigado>, base: string): string {
  const linhas: string[] = [];
  const blocos = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "tr", "div"]);
  const visitar = (no: unknown): string => {
    if (Array.isArray(no)) return no.map(visitar).join("");
    if (!ehNo(no)) return "";
    if (typeof no.text === "string") return no.text;
    const texto = visitar(no.children);
    if (no.type === "link" && ehNo(no.data) && typeof no.data.url === "string") {
      juntarArquivo(arquivos, texto, resolverUrl(no.data.url, base));
    }
    if (typeof no.type === "string" && blocos.has(no.type)) {
      linhas.push(texto);
      return "";
    }
    return texto;
  };
  const resto = visitar(valor);
  if (resto) linhas.push(resto);
  return linhas.join("\n");
}

function lerBlocoVolto(bloco: unknown, doc: No, linhas: string[], arquivos: Map<string, ArquivoLigado>, base: string) {
  if (!ehNo(bloco)) return;
  const tipo = bloco["@type"];
  if (tipo === "title") { if (typeof doc.title === "string") linhas.push(doc.title); return; }
  if (tipo === "description") { if (typeof doc.description === "string") linhas.push(doc.description); return; }
  if (tipo === "slate") { linhas.push(textoDoSlate(bloco.value, arquivos, base)); return; }
  if (tipo === "html" && typeof bloco.html === "string") {
    linhas.push(textoDoHtml(bloco.html));
    arquivosDoHtml(bloco.html, base, arquivos);
    return;
  }
  if (typeof tipo === "string" && BLOCOS_SEM_TEXTO.has(tipo)) return;
  // Blocos que agrupam outros (colunas, sanfona, abas) e os de chamada.
  for (const chave of ["title", "description", "text"]) {
    if (typeof bloco[chave] === "string" && bloco[chave]) linhas.push(bloco[chave] as string);
  }
  if (Array.isArray(bloco.href)) {
    for (const link of bloco.href) {
      if (ehNo(link) && typeof link["@id"] === "string") juntarArquivo(arquivos, String(link.title ?? ""), resolverUrl(link["@id"], base));
    }
  }
  const filhos = ehNo(bloco.blocks) ? bloco.blocks : null;
  if (filhos) {
    const ordem = ehNo(bloco.blocks_layout) && Array.isArray(bloco.blocks_layout.items) ? bloco.blocks_layout.items as string[] : Object.keys(filhos);
    for (const id of ordem) lerBlocoVolto(filhos[id], doc, linhas, arquivos, base);
  }
  if (ehNo(bloco.data)) lerBlocoVolto(bloco.data, doc, linhas, arquivos, base);
  if (Array.isArray(bloco.columns)) for (const coluna of bloco.columns) lerBlocoVolto(coluna, doc, linhas, arquivos, base);
}

/** Conteúdo de uma página Volto pela API; null quando o JSON não é de uma página. */
export function conteudoDoVolto(json: unknown, base: string): Omit<ConteudoDaPagina, "formato"> | null {
  if (!ehNo(json) || !ehNo(json.blocks)) return null;
  const linhas: string[] = [];
  const arquivos = new Map<string, ArquivoLigado>();
  const blocos = json.blocks;
  const ordem = ehNo(json.blocks_layout) && Array.isArray(json.blocks_layout.items)
    ? json.blocks_layout.items as string[]
    : Object.keys(blocos);
  if (!ordem.some(id => ehNo(blocos[id]) && blocos[id]["@type"] === "title") && typeof json.title === "string") linhas.push(json.title);
  for (const id of ordem) lerBlocoVolto(blocos[id], json, linhas, arquivos, base);
  // Arquivos guardados dentro da página (a pasta de modelos da LIE, por exemplo).
  if (Array.isArray(json.items)) {
    for (const item of json.items) {
      if (ehNo(item) && item["@type"] === "File" && typeof item["@id"] === "string") {
        juntarArquivo(arquivos, String(item.title ?? ""), `${item["@id"]}/@@download/file`);
      }
    }
  }
  return {
    titulo: typeof json.title === "string" ? json.title : null,
    texto: normalizarTexto(linhas.join("\n")),
    arquivos: [...arquivos.values()],
    atualizadoEm: typeof json.modified === "string" ? json.modified : null,
  };
}

// ─── Documentos de escritório ───────────────────────────────────────────────

/** Partes com texto dentro do .docx, .xlsx, .odt e .ods. */
export function ehParteComTexto(formato: FormatoDoConteudo, nome: string): boolean {
  if (formato === "docx") return /^word\/(document|header\d*|footer\d*|footnotes)\.xml$/.test(nome);
  if (formato === "xlsx") return nome === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(nome);
  if (formato === "odt" || formato === "ods") return nome === "content.xml";
  return false;
}

/** Texto de uma parte XML de documento de escritório, um parágrafo ou célula por linha. */
export function textoDoXmlOffice(xml: string): string {
  const comQuebras = xml
    .replace(/<w:tab\/>|<text:tab\/>|<text:s\/>/g, " ")
    .replace(/<\/(w:p|text:p|text:h|si|c|table:table-cell)>/g, "\n")
    .replace(/<v>[^<]*<\/v>/g, " ")
    .replace(/<[^>]*>/g, "");
  return normalizarTexto(decodificarEntidades(comQuebras));
}

export function formatoDoArquivo(url: string, contentType: string | null): FormatoDoConteudo {
  const tipo = (contentType ?? "").toLowerCase();
  const caminho = chaveDoArquivo(url).toLowerCase().replace(/[?#].*$/, "");
  if (tipo.includes("pdf") || caminho.endsWith(".pdf")) return "pdf";
  if (tipo.includes("wordprocessingml") || caminho.endsWith(".docx")) return "docx";
  if (tipo.includes("spreadsheetml") || caminho.endsWith(".xlsx")) return "xlsx";
  if (tipo.includes("opendocument.text") || caminho.endsWith(".odt")) return "odt";
  if (tipo.includes("opendocument.spreadsheet") || caminho.endsWith(".ods")) return "ods";
  if (tipo.includes("html") || tipo.includes("xml")) return "html";
  return "arquivo";
}

// ─── Recorte, hash e diferença ──────────────────────────────────────────────

/** A linha começa com a marca, como está escrita (maiúsculas contam: o índice da PRC 5 diz "Anexo LXXXVI"). */
function linhaCasa(linha: string, marca: string): boolean {
  const m = marca.normalize("NFC").replace(/\s+/g, " ").trim();
  return linha === m || (linha.startsWith(m) && !/[\p{L}\p{N}]/u.test(linha[m.length]));
}

/**
 * Parte do texto entre a linha que começa com `de` e a que começa com `ate`
 * (exclusive). Serve para fontes enormes, como a PRC 5 da Saúde, em que só um
 * anexo importa. `achou` é falso quando o início não está mais no texto.
 */
export function aplicarRecorte(texto: string, recorte?: Recorte | null): { texto: string; achou: boolean } {
  if (!recorte?.de?.trim()) return { texto, achou: true };
  const linhas = texto.split("\n");
  const inicio = linhas.findIndex(linha => linhaCasa(linha, recorte.de));
  if (inicio < 0) return { texto, achou: false };
  let fim = linhas.length;
  if (recorte.ate?.trim()) {
    const achado = linhas.findIndex((linha, i) => i > inicio && linhaCasa(linha, recorte.ate!));
    if (achado > 0) fim = achado;
  }
  return { texto: linhas.slice(inicio, fim).join("\n"), achou: true };
}

/** O que entra no hash de uma página: o texto e os arquivos ligados, em ordem estável. */
export function conteudoParaHash(conteudo: Pick<ConteudoDaPagina, "texto" | "arquivos">): string {
  const arquivos = conteudo.arquivos.map(a => `${a.nome} <${chaveDoArquivo(a.url)}>`).sort();
  return arquivos.length ? `${conteudo.texto}\n\nArquivos:\n${arquivos.join("\n")}` : conteudo.texto;
}

export async function sha256Hex(dado: string | Uint8Array): Promise<string> {
  const bytes = typeof dado === "string" ? new TextEncoder().encode(dado) : dado;
  const copia = new Uint8Array(bytes.length);
  copia.set(bytes);
  const resumo = new Uint8Array(await crypto.subtle.digest("SHA-256", copia));
  return Array.from(resumo, b => b.toString(16).padStart(2, "0")).join("");
}

export type TrechoDaDiferenca = { tipo: "igual" | "novo" | "retirado"; linhas: string[] };

/**
 * Myers sobre linhas, guardando só a faixa usada de cada passo. Acima de
 * `limite` passos (texto reescrito), devolve null.
 */
function myers(a: number[], b: number[], limite: number): ("=" | "-" | "+")[] | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  if (max === 0) return [];
  const deslocamento = max + 1;
  const v = new Int32Array(2 * max + 3);
  const passos: Int32Array[] = [];
  let terminou = -1;
  for (let d = 0; d <= max && terminou < 0; d++) {
    if (d > limite) return null;
    passos.push(v.slice(deslocamento - d - 1, deslocamento + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[deslocamento + k - 1] < v[deslocamento + k + 1])
        ? v[deslocamento + k + 1]
        : v[deslocamento + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[deslocamento + k] = x;
      if (x >= n && y >= m) { terminou = d; break; }
    }
  }
  const operacoes: ("=" | "-" | "+")[] = [];
  let x = n;
  let y = m;
  for (let d = terminou; d >= 0; d--) {
    const antes = passos[d];
    const em = (k: number) => antes[k + d + 1];
    const k = x - y;
    const kAnterior = k === -d || (k !== d && em(k - 1) < em(k + 1)) ? k + 1 : k - 1;
    const xAnterior = d === 0 ? 0 : em(kAnterior);
    const yAnterior = d === 0 ? 0 : xAnterior - kAnterior;
    while (x > xAnterior && y > yAnterior) { operacoes.push("="); x--; y--; }
    if (d > 0) {
      operacoes.push(x === xAnterior ? "+" : "-");
      if (x === xAnterior) y--; else x--;
    }
  }
  return operacoes.reverse();
}

/** Diferença linha a linha entre duas versões do texto. */
export function diferencaDeLinhas(antes: string[], depois: string[], limite = 2000): TrechoDaDiferenca[] {
  let inicio = 0;
  while (inicio < antes.length && inicio < depois.length && antes[inicio] === depois[inicio]) inicio++;
  let fimA = antes.length;
  let fimB = depois.length;
  while (fimA > inicio && fimB > inicio && antes[fimA - 1] === depois[fimB - 1]) { fimA--; fimB--; }
  const a = antes.slice(inicio, fimA);
  const b = depois.slice(inicio, fimB);
  const ids = new Map<string, number>();
  const id = (linha: string) => {
    let valor = ids.get(linha);
    if (valor === undefined) { valor = ids.size; ids.set(linha, valor); }
    return valor;
  };
  const operacoes = myers(a.map(id), b.map(id), limite)
    ?? [...a.map(() => "-" as const), ...b.map(() => "+" as const)];

  const trechos: TrechoDaDiferenca[] = [];
  const juntar = (tipo: TrechoDaDiferenca["tipo"], linha: string) => {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo?.tipo === tipo) ultimo.linhas.push(linha);
    else trechos.push({ tipo, linhas: [linha] });
  };
  for (const linha of antes.slice(0, inicio)) juntar("igual", linha);
  let i = 0;
  let j = 0;
  for (const operacao of operacoes) {
    if (operacao === "=") { juntar("igual", a[i]); i++; j++; }
    else if (operacao === "-") { juntar("retirado", a[i]); i++; }
    else { juntar("novo", b[j]); j++; }
  }
  for (const linha of antes.slice(fimA)) juntar("igual", linha);
  return trechos;
}

export type VersaoComparavel = { texto: string; arquivos: ArquivoLigado[] };

const nomes = (lista: ArquivoLigado[], maximo = 5) =>
  lista.slice(0, maximo).map(a => a.nome).join("; ") + (lista.length > maximo ? ` e mais ${lista.length - maximo}` : "");

/** Motivos da versão nova, para a lista e o aviso; e a primeira linha nova, como resumo. */
export function resumoDaMudanca(antes: VersaoComparavel | null, depois: VersaoComparavel): { motivos: string[]; resumo: string | null } {
  const linhasDepois = depois.texto ? depois.texto.split("\n") : [];
  if (!antes) {
    const motivos = [`primeira coleta: ${linhasDepois.length} ${linhasDepois.length === 1 ? "linha" : "linhas"}`];
    if (depois.arquivos.length) motivos.push(`${depois.arquivos.length} ${depois.arquivos.length === 1 ? "arquivo ligado" : "arquivos ligados"}`);
    return { motivos, resumo: null };
  }
  const motivos: string[] = [];
  const trechos = diferencaDeLinhas(antes.texto ? antes.texto.split("\n") : [], linhasDepois);
  const mudados = trechos.filter(t => t.tipo !== "igual");
  if (mudados.length) {
    const novas = mudados.filter(t => t.tipo === "novo").reduce((s, t) => s + t.linhas.length, 0);
    const retiradas = mudados.filter(t => t.tipo === "retirado").reduce((s, t) => s + t.linhas.length, 0);
    const blocos = trechos.reduce((s, t, i) => s + (t.tipo !== "igual" && trechos[i - 1]?.tipo !== "novo" && trechos[i - 1]?.tipo !== "retirado" ? 1 : 0), 0);
    const partes = [novas ? `${novas} ${novas === 1 ? "linha nova" : "linhas novas"}` : "", retiradas ? `${retiradas} ${retiradas === 1 ? "retirada" : "retiradas"}` : ""].filter(Boolean);
    motivos.push(`texto mudou em ${blocos} ${blocos === 1 ? "trecho" : "trechos"} (${partes.join(", ")})`);
  }
  const chavesAntes = new Set(antes.arquivos.map(a => chaveDoArquivo(a.url)));
  const chavesDepois = new Set(depois.arquivos.map(a => chaveDoArquivo(a.url)));
  const novos = depois.arquivos.filter(a => !chavesAntes.has(chaveDoArquivo(a.url)));
  const retirados = antes.arquivos.filter(a => !chavesDepois.has(chaveDoArquivo(a.url)));
  if (novos.length) motivos.push(`${novos.length === 1 ? "arquivo novo" : `${novos.length} arquivos novos`}: ${nomes(novos)}`);
  if (retirados.length) motivos.push(`${retirados.length === 1 ? "arquivo retirado" : `${retirados.length} arquivos retirados`}: ${nomes(retirados)}`);
  if (!motivos.length) motivos.push("o arquivo mudou, mas o texto lido é o mesmo");
  const primeira = mudados.find(t => t.tipo === "novo")?.linhas[0] ?? mudados[0]?.linhas[0] ?? (novos[0] ? novos[0].nome : null);
  return { motivos, resumo: primeira ? primeira.slice(0, 300) : null };
}
