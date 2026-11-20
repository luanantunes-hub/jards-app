// Vigia normativo mínimo (P1.10): leitura dos atos do Diário Oficial da União
// em XML (INLABS ou base de dados aberta, as duas da Imprensa Nacional) e triagem sem IA.
//
// A Imprensa Nacional publica, por dia e por seção, um .zip com um XML por ato
// (<article ...><body><Identifica/><Ementa/><Texto/></body></article>). A
// triagem descarta a maior parte do Diário: fica o ato normativo que cita uma
// norma dos regimes do módulo (Lei Rouanet, Lei de Incentivo ao Esporte,
// ANCINE, PRONON e PRONAS/PCD) ou que vem do Ministério da Cultura, da ANCINE
// ou do Ministério do Esporte e trata de prestação de contas ou de incentivo
// fiscal. Atos sobre um projeto, uma
// pessoa ou uma empresa (aprovação, captação, indeferimento, nomeação) são
// rotina: contam, mas não viram aviso. Sem dependências; usado pela edge
// function agente-normativo e pelos testes.

export type ArtigoDou = {
  id: string;
  idMateria: string;
  /** Edição do INLABS: DO1, DO1E (extra)… */
  edicao: string;
  tipo: string;
  orgao: string;
  /** AAAA-MM-DD */
  publicadoEm: string;
  pdf: string;
  titulo: string;
  ementa: string;
  texto: string;
};

export type Triagem = { categoria: "norma" | "rotina" | null; motivos: string[] };

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteiro, codigo: string) => {
    if (codigo[0] === "#") {
      const n = codigo[1] === "x" || codigo[1] === "X" ? parseInt(codigo.slice(2), 16) : parseInt(codigo.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : inteiro;
    }
    return ENTIDADES[codigo.toLowerCase()] ?? inteiro;
  });
}

const espacos = (texto: string) => texto.replace(/\s+/g, " ").trim();

/** Texto corrido de um trecho em HTML. */
export function textoDeHtml(html: string): string {
  return espacos(decodificar(html.replace(/<[^>]+>/g, " ")));
}

function atributo(xml: string, nome: string): string {
  const m = new RegExp(`\\s${nome}="([^"]*)"`).exec(xml);
  return m ? espacos(decodificar(m[1])) : "";
}

function bloco(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tag}>`).exec(xml);
  if (!m) return "";
  return m[1] !== undefined ? m[1] : decodificar(m[2] ?? "");
}

/** Um ato do XML do INLABS, ou null quando o arquivo não é um ato. */
export function lerArtigoDou(xml: string): ArtigoDou | null {
  const abertura = /<article\b[^>]*>/.exec(xml)?.[0];
  if (!abertura) return null;
  const data = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(atributo(abertura, "pubDate"));
  return {
    id: atributo(abertura, "id"),
    idMateria: atributo(abertura, "idMateria"),
    edicao: atributo(abertura, "pubName"),
    tipo: atributo(abertura, "artType"),
    orgao: atributo(abertura, "artCategory"),
    publicadoEm: data ? `${data[3]}-${data[2]}-${data[1]}` : "",
    pdf: atributo(abertura, "pdfPage"),
    titulo: textoDeHtml(bloco(xml, "Identifica")),
    ementa: textoDeHtml(bloco(xml, "Ementa")),
    texto: textoDeHtml(bloco(xml, "Texto")),
  };
}

/** Chave única do ato entre as coletas (a mesma matéria pode sair em mais de um arquivo). */
export function chaveDoArtigo(artigo: Pick<ArtigoDou, "id" | "idMateria">): string {
  return `dou:${artigo.idMateria || artigo.id}`;
}

/** Minúsculas e sem acentos, para comparar. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const NUMERO = "(?:n[ºo°.]*\\s*)?";

/** Normas dos regimes do módulo: citar uma delas num ato normativo basta. */
export const NORMAS_VIGIADAS: { nome: string; padrao: RegExp }[] = [
  { nome: "Lei Rouanet (Lei 8.313/1991)", padrao: new RegExp(`lei ${NUMERO}8\\.313|lei rouanet`) },
  { nome: "Lei de Incentivo ao Esporte (Lei 11.438/2006)", padrao: new RegExp(`lei ${NUMERO}11\\.438|lei (federal )?de incentivo ao esporte`) },
  { nome: "Lei Complementar 222", padrao: new RegExp(`lei complementar ${NUMERO}222\\b`) },
  { nome: "Decreto 12.861", padrao: new RegExp(`decreto ${NUMERO}12\\.861`) },
  { nome: "MP 2.228-1 (ANCINE)", padrao: /2\.228-1/ },
  { nome: "Lei do Audiovisual (Lei 8.685/1993)", padrao: new RegExp(`lei ${NUMERO}8\\.685`) },
  { nome: "PRONON", padrao: /\bpronon\b|programa nacional de apoio a atencao oncologica/ },
  { nome: "PRONAS/PCD", padrao: /\bpronas\s*\/\s*pcd\b|programa nacional de apoio a atencao da saude da pessoa com deficiencia/ },
  { nome: "Anexo LXXXVI da PRC 5/2017", padrao: /anexo lxxxvi/ },
];

/**
 * Órgãos dos regimes: o ato vale quando trata de prestação de contas ou
 * incentivo. A saúde entra só pelo nome do PRONON e do PRONAS/PCD: as demais
 * regras do ministério (emendas, SUS) não são de nenhum regime do módulo.
 */
export const ORGAOS_VIGIADOS: { nome: string; padrao: RegExp }[] = [
  { nome: "Ministério da Cultura", padrao: /^ministerio da cultura\/(gabinete do ministro|secretaria de fomento e incentivo a cultura|secretaria do audiovisual|secretaria-executiva)/ },
  { nome: "ANCINE", padrao: /agencia nacional do cinema/ },
  { nome: "Ministério do Esporte", padrao: /^ministerio do esporte\/(gabinete do ministro|secretaria executiva|secretaria-executiva)/ },
];

const ASSUNTOS = /presta(?:cao|coes) de contas|incentivo fiscal|renuncia fiscal|mecenato|lei de incentivo/;
/** O assunto achado, escrito como na norma (o texto comparado não tem acento). */
const NOME_DO_ASSUNTO: Record<string, string> = {
  "prestacao de contas": "prestação de contas",
  "prestacoes de contas": "prestação de contas",
  "renuncia fiscal": "renúncia fiscal",
};

/** Tipos de ato que podem mudar uma regra. Despachos, extratos e avisos ficam de fora. */
const TIPO_NORMATIVO = /^(lei|decreto|medida provisoria|instrucao normativa|portaria|resolucao|deliberacao)/;

/** Atos sobre um projeto, uma pessoa ou uma empresa: rotina, não mudança de regra. */
const ROTINA: RegExp[] = [
  /aprovar? (?:o|os|a|as) projetos?/, /da publicidade aos projetos/, /projetos? desportivos?/, /indefer/,
  /autoriza(?:r)? (?:a )?captacao/, /prorroga(?:r)? (?:o )?prazo de (?:captacao|execucao)/, /homologa/,
  /complementar o valor/, /reduzir o valor/, /readequacao/, /arquivar/, /tornar? sem efeito/,
  /inabilita/, /enquadramento, como prioritario/, /cnpj\/cpf/, /^area: \d/,
  /\b(?:nomear|exonerar|designar|dispensar)\b/, /^retifica/,
];

/** Classifica um ato: "norma" vira aviso; "rotina" só conta; null é de outro assunto. */
export function triarArtigo(artigo: Pick<ArtigoDou, "tipo" | "orgao" | "titulo" | "ementa" | "texto">): Triagem {
  const texto = normalizar(`${artigo.titulo} ${artigo.ementa} ${artigo.texto}`);
  const normas = NORMAS_VIGIADAS.filter(n => n.padrao.test(texto)).map(n => n.nome);
  const orgao = normalizar(artigo.orgao);
  const orgaos = ORGAOS_VIGIADOS.filter(o => o.padrao.test(orgao)).map(o => o.nome);
  if (normas.length === 0 && orgaos.length === 0) return { categoria: null, motivos: [] };

  const cabecalho = normalizar(`${artigo.titulo} ${artigo.ementa} ${artigo.texto.slice(0, 600)}`);
  if (ROTINA.some(padrao => padrao.test(cabecalho)) || !TIPO_NORMATIVO.test(normalizar(artigo.tipo))) {
    return { categoria: "rotina", motivos: [...normas, ...orgaos] };
  }
  if (normas.length > 0) return { categoria: "norma", motivos: [...normas, ...orgaos] };
  const assunto = ASSUNTOS.exec(texto)?.[0];
  if (assunto) return { categoria: "norma", motivos: [...orgaos, `cita "${NOME_DO_ASSUNTO[assunto] ?? assunto}"`] };
  return { categoria: null, motivos: [] };
}
