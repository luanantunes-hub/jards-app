// CNAE na prestação (P2.4): os itens do orçamento dizem que atividades
// aceitam, e a despesa confere se o fornecedor tem uma delas na Receita.
//
// Um CNAE aceito pode ser uma divisão (90), um grupo (90.0), uma classe
// (90.01-9) ou uma subclasse (9001-9/01); vale para todas as subclasses
// abaixo. Guardamos só os algarismos (2, 3, 5 ou 7), e a compatibilidade é
// por prefixo. O agrupador pode definir os CNAEs dos itens abaixo dele, como
// no grupo de custo; o item que define os seus não herda.
//
// A sugestão usa a tabela do IBGE (public/dados/cnae-subclasses.json, gerada
// por scripts/prestacao-gerar-cnae.ts): descrição e lista de atividades de
// cada subclasse, com alguns sinônimos de orçamento cultural. Sem React e sem
// Supabase.

export type NivelCnae = "divisao" | "grupo" | "classe" | "subclasse";

const NIVEL_POR_TAMANHO: Record<number, NivelCnae> = { 2: "divisao", 3: "grupo", 5: "classe", 7: "subclasse" };

export const ROTULO_NIVEL_CNAE: Record<NivelCnae, string> = {
  divisao: "divisão",
  grupo: "grupo",
  classe: "classe",
  subclasse: "subclasse",
};

/** Só os algarismos, quando formam um nível da CNAE; senão, null. */
export function normalizarCnae(valor: unknown): string | null {
  const algarismos = String(valor ?? "").replace(/\D/g, "");
  return NIVEL_POR_TAMANHO[algarismos.length] ? algarismos : null;
}

export function nivelDoCnae(codigo: string): NivelCnae | null {
  return NIVEL_POR_TAMANHO[codigo.replace(/\D/g, "").length] ?? null;
}

/** 90, 90.0, 90.01-9 e 9001-9/01, como a Receita e o IBGE escrevem. */
export function formatarCodigoCnae(codigo: string): string {
  const c = codigo.replace(/\D/g, "");
  if (c.length === 3) return `${c.slice(0, 2)}.${c.slice(2)}`;
  if (c.length === 5) return `${c.slice(0, 2)}.${c.slice(2, 4)}-${c.slice(4)}`;
  if (c.length === 7) return `${c.slice(0, 4)}-${c.slice(4, 5)}/${c.slice(5)}`;
  return c;
}

/** Lista sem repetição e sem código inválido, mantendo a ordem; o nível mais amplo cobre os de baixo. */
export function limparCnaesAceitos(lista: readonly unknown[]): string[] {
  const validos = [...new Set(lista.map(normalizarCnae).filter((c): c is string => c !== null))];
  return validos.filter(c => !validos.some(outro => outro !== c && c.startsWith(outro)));
}

/** O CNAE aceito cobre a subclasse do fornecedor? */
export function cnaeAbrange(aceito: string, subclasse: string): boolean {
  const a = normalizarCnae(aceito);
  const s = normalizarCnae(subclasse);
  return a !== null && s !== null && s.startsWith(a);
}

export type FornecedorComCnae = {
  cnae_principal: string | null;
  cnaes_secundarios: { codigo: string; descricao?: string | null }[] | null;
};

/** Subclasses do fornecedor na Receita (principal primeiro), só algarismos. */
export function cnaesDoFornecedor(f: FornecedorComCnae): string[] {
  const todos = [f.cnae_principal, ...(f.cnaes_secundarios ?? []).map(c => c.codigo)];
  return [...new Set(todos.map(normalizarCnae).filter((c): c is string => c !== null && c.length === 7))];
}

/** Subclasses do fornecedor que o item aceita; vazio quando nenhuma. */
export function cnaesCompativeis(aceitos: readonly string[], doFornecedor: readonly string[]): string[] {
  return doFornecedor.filter(s => aceitos.some(a => cnaeAbrange(a, s)));
}

export type NoComCnae = { id: string; parent_id: string | null; nome: string; cnaes_aceitos?: string[] | null };

/**
 * CNAEs que valem para o nó: os próprios ou os do agrupador mais próximo que
 * definir. `origem` diz de onde vieram (null quando ninguém definiu).
 */
export function cnaesDoNo(noId: string, nos: readonly NoComCnae[]): { cnaes: string[]; origem: { id: string; nome: string } | null } {
  const porId = new Map(nos.map(n => [n.id, n]));
  const vistos = new Set<string>();
  let atual = porId.get(noId);
  while (atual && !vistos.has(atual.id)) {
    vistos.add(atual.id);
    const proprios = limparCnaesAceitos(atual.cnaes_aceitos ?? []);
    if (proprios.length) return { cnaes: proprios, origem: { id: atual.id, nome: atual.nome } };
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined;
  }
  return { cnaes: [], origem: null };
}

// ─── Tabela do IBGE ─────────────────────────────────────────────────────────

/** Subclasse como fica no arquivo: código de 7 algarismos, descrição e atividades. */
export type SubclasseCnae = [codigo: string, descricao: string, atividades: string[]];

export type TabelaCnae = {
  fonte: string;
  gerado_em: string;
  subclasses: SubclasseCnae[];
  /** Descrição das divisões, grupos e classes, pelo código em algarismos. */
  niveis: Record<string, string>;
};

/** "PRODUÇÃO TEATRAL" vira "Produção teatral". */
function legivel(texto: string): string {
  const t = texto.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type ItemIbge = {
  id?: unknown;
  descricao?: unknown;
  atividades?: unknown;
  classe?: { id?: unknown; descricao?: unknown; grupo?: { id?: unknown; descricao?: unknown; divisao?: { id?: unknown; descricao?: unknown } } };
};

/** Resposta de GET servicodados.ibge.gov.br/api/v2/cnae/subclasses no formato do arquivo. */
export function lerTabelaIbge(bruto: unknown, fonte: string, geradoEm: string): TabelaCnae {
  const subclasses: SubclasseCnae[] = [];
  const niveis: Record<string, string> = {};
  for (const item of (Array.isArray(bruto) ? bruto : []) as ItemIbge[]) {
    const codigo = normalizarCnae(item.id);
    if (!codigo || codigo.length !== 7 || typeof item.descricao !== "string") continue;
    const descricao = legivel(item.descricao);
    const atividades = [...new Set((Array.isArray(item.atividades) ? item.atividades : [])
      .filter((a): a is string => typeof a === "string")
      .map(a => a.trim().toLowerCase())
      .filter(a => a && a !== descricao.toLowerCase()))].sort();
    subclasses.push([codigo, descricao, atividades]);
    const classe = item.classe;
    const grupo = classe?.grupo;
    const divisao = grupo?.divisao;
    for (const nivel of [classe, grupo, divisao]) {
      const c = normalizarCnae(nivel?.id);
      if (c && typeof nivel?.descricao === "string") niveis[c] = legivel(nivel.descricao);
    }
  }
  subclasses.sort((a, b) => a[0].localeCompare(b[0]));
  return { fonte, gerado_em: geradoEm, subclasses, niveis };
}

/** Descrição do código em qualquer nível, quando a tabela tem. */
export function descricaoDoCnae(codigo: string, tabela: Pick<TabelaCnae, "subclasses" | "niveis">): string | null {
  const c = normalizarCnae(codigo);
  if (!c) return null;
  if (c.length === 7) return tabela.subclasses.find(s => s[0] === c)?.[1] ?? null;
  return tabela.niveis[c] ?? null;
}

// ─── Busca e sugestão ───────────────────────────────────────────────────────

const PARADAS = new Set([
  "a", "o", "as", "os", "ao", "aos", "um", "uma", "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos",
  "para", "pra", "por", "com", "sem", "ou", "que", "se", "sua", "seu", "suas", "seus", "outro", "outra", "outros", "outras",
  "exceto", "nao", "especificada", "especificado", "especificadas", "especificados", "anteriormente", "atividade",
  "atividades", "servico", "servicos", "geral", "gerais", "tipo", "tipos", "item", "itens", "custo", "custos", "despesa",
  "despesas", "projeto", "projetos", "taxa", "valor", "total", "mes", "meses", "dia", "dias", "hora", "horas", "unidade",
  "local", "material", "materiai", "consumo", "apoio", "similar", "similare", "diverso", "diversa",
]);

/** Minúsculas, sem acento, e o plural mais comum reduzido ao singular. */
function radical(palavra: string): string {
  const p = palavra;
  if (p.length <= 3) return p;
  if (p.endsWith("coes")) return `${p.slice(0, -4)}cao`;
  if (p.endsWith("oes") || p.endsWith("aes")) return `${p.slice(0, -3)}ao`;
  if (p.endsWith("ais")) return `${p.slice(0, -3)}al`;
  if (p.endsWith("eis")) return `${p.slice(0, -3)}el`;
  if (p.endsWith("ns")) return `${p.slice(0, -2)}m`;
  if (/[rz]es$/.test(p)) return p.slice(0, -2);
  if (p.endsWith("s") && !p.endsWith("ss")) return p.slice(0, -1);
  return p;
}

export function palavrasDoTexto(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(p => p.length >= 3 && !PARADAS.has(p) && !/^\d+$/.test(p))
    .map(radical);
}

/**
 * Atalhos de orçamento cultural: termos comuns nos itens e os CNAEs que
 * costumam atender. A descrição do IBGE nem sempre usa a palavra do
 * orçamento (cenografia, músico e assessoria de imprensa só aparecem nas
 * atividades de subclasses genéricas), então estes vêm antes da busca no
 * texto. Um teste confere que todos os códigos existem na tabela.
 */
export const ATALHOS_CNAE: { termos: string[]; cnaes: string[] }[] = [
  { termos: ["ator", "atriz", "elenco", "interprete", "performer", "palhaco", "teatro", "dramaturgia"], cnaes: ["9001901", "9001999", "9001904"] },
  { termos: ["musico", "musica", "banda", "cantor", "cantora", "instrumentista", "dj", "show", "orquestra"], cnaes: ["9001902", "5920100", "9001999"] },
  { termos: ["danca", "bailarino", "bailarina", "dancarino", "dancarina", "coreografo", "coreografa", "coreografia"], cnaes: ["9001903", "9001999", "8592901"] },
  { termos: ["cache"], cnaes: ["9001999", "9001901", "9001902", "9002701"] },
  { termos: ["produtor", "produtora", "producao executiva", "produtor executivo", "producao cultural", "producao"], cnaes: ["9001999", "8230001", "7490104"] },
  { termos: ["diretor artistico", "direcao artistica", "diretor de conteudo", "direcao geral"], cnaes: ["9001999", "9001901", "5911199"] },
  { termos: ["cenografo", "cenografa", "cenografia", "cenografica", "cenario", "cenotecnico", "adereco"], cnaes: ["9001999", "7410299"] },
  { termos: ["figurino", "figurinista", "costureira", "costura"], cnaes: ["9001999", "1412601", "1412602"] },
  { termos: ["iluminacao", "iluminador", "luz"], cnaes: ["9001906", "7739099"] },
  { termos: ["som", "sonorizacao", "audio", "tecnico de som", "sonoplastia"], cnaes: ["9001906", "5920100", "7739099"] },
  { termos: ["palco", "tenda", "estrutura", "arquibancada", "camarim", "infraestrutura"], cnaes: ["7739003", "9001999"] },
  { termos: ["fotografo", "fotografa", "fotografia", "foto"], cnaes: ["7420001", "7420004"] },
  { termos: ["filmagem", "video", "videomaker", "audiovisual", "making", "edicao de video", "documentario"], cnaes: ["5911199", "7420004", "5912099", "5911102"] },
  { termos: ["designer", "design", "diagramacao", "diagramador", "identidade visual", "arte grafica", "projeto grafico"], cnaes: ["7410299", "1821100", "7410203"] },
  { termos: ["impressao", "grafica", "cartaz", "banner", "folder", "flyer", "panfleto", "adesivo", "lona"], cnaes: ["1813001", "1813099", "1821100"] },
  { termos: ["livro", "editora", "publicacao", "catalogo", "revista"], cnaes: ["5811500", "5821200", "1813099"] },
  { termos: ["escritor", "roteirista", "roteiro", "redator", "redacao", "texto", "jornalista"], cnaes: ["9002701", "7319099"] },
  { termos: ["artista plastico", "artes visuai", "ilustrador", "ilustracao", "grafite", "mural", "artista"], cnaes: ["9002701", "7410299"] },
  { termos: ["curador", "curadora", "curadoria", "pesquisador", "pesquisa"], cnaes: ["9002701", "7490199", "7320300"] },
  { termos: ["assessoria de imprensa", "imprensa", "relacoes publica", "comunicacao"], cnaes: ["7020400", "9002701", "7319099"] },
  { termos: ["divulgacao", "publicidade", "propaganda", "midia", "impulsionamento", "anuncio", "rede sociai", "marketing", "social media"], cnaes: ["7311400", "7312200", "7319002", "7319003", "7319099"] },
  { termos: ["site", "plataforma", "aplicativo", "app", "sistema", "software", "web", "digital", "realidade virtual", "calculadora", "conteudo digital"], cnaes: ["6201501", "6201502", "6319400", "6311900"] },
  { termos: ["hospedagem", "hotel", "pousada", "alojamento"], cnaes: ["5510801", "5510802", "5590699"] },
  { termos: ["passagem", "aerea", "aereo", "viagem", "bilhete"], cnaes: ["7911200", "5111100"] },
  { termos: ["transporte", "van", "onibus", "translado", "traslado", "motorista", "veiculo"], cnaes: ["4929901", "4929902", "4923002", "7711000"] },
  { termos: ["frete", "logistica", "carga", "mudanca"], cnaes: ["4930201", "4930202", "5250804"] },
  { termos: ["alimentacao", "refeicao", "lanche", "catering", "coffee break", "buffet", "bufe", "agua"], cnaes: ["5620102", "5611201", "5620101", "5611203"] },
  { termos: ["seguro"], cnaes: ["6512000", "6511101", "6622300"] },
  { termos: ["contador", "contadora", "contabilidade", "contabil"], cnaes: ["6920601", "6920602"] },
  { termos: ["auditoria", "auditor"], cnaes: ["6920602"] },
  { termos: ["advogado", "advogada", "juridico", "juridica", "advocacia"], cnaes: ["6911701"] },
  { termos: ["gerente", "coordenador", "coordenadora", "coordenacao", "gestor", "gestora", "gestao", "diretor executivo", "diretora executiva", "administrativo", "financeiro"], cnaes: ["7020400", "8211300"] },
  { termos: ["educador", "educadora", "professor", "professora", "oficina", "oficineiro", "curso", "arte educador", "mediador", "mediadora", "pedagogo", "monitor"], cnaes: ["8592999", "8599699", "8550302", "8599604"] },
  { termos: ["traducao", "tradutor", "libra", "interprete de libra", "audiodescricao", "legendagem", "legenda", "acessibilidade"], cnaes: ["7490101", "5912099"] },
  { termos: ["seguranca", "vigilancia", "vigilante", "brigadista", "brigada"], cnaes: ["8011101"] },
  { termos: ["limpeza", "faxina"], cnaes: ["8121400"] },
  { termos: ["locacao de equipamento", "aluguel de equipamento", "equipamento"], cnaes: ["7739099", "7729202", "7733100"] },
  { termos: ["oculo", "computador", "notebook", "projetor", "tablet"], cnaes: ["7733100", "7739099", "4751201"] },
  { termos: ["espaco", "sala", "auditorio", "galpao", "deposito", "coworking", "wework", "aluguel de imovel"], cnaes: ["6810202", "9003500", "5211799", "8230002"] },
  { termos: ["papelaria", "escritorio", "suprimento"], cnaes: ["4761003", "4789099"] },
  { termos: ["agendamento", "recepcao", "producao de campo", "credenciamento", "evento", "festa", "exposicao", "feira"], cnaes: ["8230001", "8299799"] },
];

type Entrada = { codigo: string; descricao: string; titulo: string[]; corpo: string[] };

export type IndiceCnae = { entradas: Entrada[]; porCodigo: Map<string, Entrada>; niveis: Record<string, string> };

/** Prepara a tabela para buscas repetidas (palavras da descrição e das atividades). */
export function indexarCnaes(tabela: Pick<TabelaCnae, "subclasses" | "niveis">): IndiceCnae {
  const entradas = tabela.subclasses.map(([codigo, descricao, atividades]) => {
    const titulo = [...new Set(palavrasDoTexto(descricao))];
    const corpo = [...new Set(atividades.flatMap(palavrasDoTexto))].filter(p => !titulo.includes(p));
    return { codigo, descricao, titulo, corpo };
  });
  return { niveis: tabela.niveis, entradas, porCodigo: new Map(entradas.map(e => [e.codigo, e])) };
}

/**
 * A prestação de contas cultural compra sobretudo serviços. Agropecuária,
 * extração, indústria e utilidades (divisões 01 a 39) pesam metade; obras e
 * comércio (41 a 47), três quartos.
 */
function pesoDoSetor(codigo: string): number {
  const divisao = Number(codigo.slice(0, 2));
  if (divisao <= 39) return 0.5;
  if (divisao <= 47) return 0.75;
  return 1;
}

/** 3 quando a palavra está na descrição, 1 quando só nas atividades, 0 quando não aparece. */
function pesoDaPalavra(palavra: string, e: Entrada, parcial: boolean): number {
  const igual = (t: string) => t === palavra || (parcial && palavra.length >= 3 && t.startsWith(palavra));
  if (e.titulo.some(igual)) return 3;
  if (e.corpo.some(igual)) return 1;
  return 0;
}

export type SugestaoCnae = { codigo: string; descricao: string; pontos: number; porAtalho: boolean };

/** Todas as palavras do termo aparecem no texto (exatas, já sem plural e acento). */
function termoNoTexto(termo: string, palavras: ReadonlySet<string>): boolean {
  const doTermo = palavrasDoTexto(termo);
  return doTermo.length > 0 && doTermo.every(p => palavras.has(p));
}

/**
 * Subclasses para o item (nome e descrição): primeiro os atalhos cujos
 * termos aparecem no texto, na ordem da lista; depois as que a descrição ou
 * as atividades do IBGE citam, com a indústria e o comércio pesando menos.
 */
export function sugerirCnaes(texto: string, indice: IndiceCnae, limite = 6): SugestaoCnae[] {
  const palavras = [...new Set(palavrasDoTexto(texto))];
  if (!palavras.length) return [];
  const conjunto = new Set(palavras);
  const saida: SugestaoCnae[] = [];
  const incluidos = new Set<string>();

  for (const atalho of ATALHOS_CNAE) {
    if (!atalho.termos.some(t => termoNoTexto(t, conjunto))) continue;
    for (const codigo of atalho.cnaes) {
      const e = indice.porCodigo.get(codigo);
      if (!e || incluidos.has(codigo)) continue;
      incluidos.add(codigo);
      saida.push({ codigo, descricao: e.descricao, pontos: 10, porAtalho: true });
    }
  }

  const pelaTabela: SugestaoCnae[] = [];
  for (const e of indice.entradas) {
    if (incluidos.has(e.codigo)) continue;
    let pontos = 0;
    let achadas = 0;
    for (const p of palavras) {
      const peso = pesoDaPalavra(p, e, false);
      if (peso) achadas++;
      pontos += peso;
    }
    if (achadas === palavras.length && palavras.length > 1) pontos += 2;
    pontos *= pesoDoSetor(e.codigo);
    // Só atividade solta é fraco demais para sugerir.
    if (pontos >= 3) pelaTabela.push({ codigo: e.codigo, descricao: e.descricao, pontos, porAtalho: false });
  }
  pelaTabela.sort((a, b) => b.pontos - a.pontos || a.codigo.localeCompare(b.codigo));
  return [...saida, ...pelaTabela].slice(0, limite);
}

export type ResultadoBuscaCnae = { codigo: string; descricao: string; nivel: NivelCnae };

/**
 * Busca de quem escolhe: por código (qualquer nível, também com pontos e
 * traços) ou por palavras, que precisam aparecer todas (a última pode estar
 * pela metade, enquanto a pessoa digita). O código digitado vem primeiro,
 * para aceitar a divisão, o grupo ou a classe inteira.
 */
export function buscarCnaes(consulta: string, indice: IndiceCnae, limite = 30): ResultadoBuscaCnae[] {
  const texto = consulta.trim();
  if (!texto) return [];
  const saida: ResultadoBuscaCnae[] = [];
  if (/^[\d.\-/\s]+$/.test(texto)) {
    const prefixo = texto.replace(/\D/g, "");
    if (!prefixo) return [];
    const exato = normalizarCnae(prefixo);
    if (exato && exato.length < 7 && indice.niveis[exato]) {
      saida.push({ codigo: exato, descricao: indice.niveis[exato], nivel: nivelDoCnae(exato)! });
    }
    for (const e of indice.entradas) {
      if (saida.length >= limite) break;
      if (e.codigo.startsWith(prefixo)) saida.push({ codigo: e.codigo, descricao: e.descricao, nivel: "subclasse" });
    }
    return saida;
  }
  const palavras = [...new Set(palavrasDoTexto(texto))];
  if (!palavras.length) return [];
  const achadas: { e: Entrada; pontos: number }[] = [];
  for (const e of indice.entradas) {
    let pontos = 0;
    for (const p of palavras) {
      const peso = pesoDaPalavra(p, e, true);
      if (!peso) { pontos = 0; break; }
      pontos += peso;
    }
    if (pontos) achadas.push({ e, pontos: pontos * pesoDoSetor(e.codigo) });
  }
  return achadas
    .sort((a, b) => b.pontos - a.pontos || a.e.codigo.localeCompare(b.e.codigo))
    .slice(0, limite)
    .map(({ e }) => ({ codigo: e.codigo, descricao: e.descricao, nivel: "subclasse" as const }));
}
