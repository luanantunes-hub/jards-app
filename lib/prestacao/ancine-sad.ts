// Dados públicos do projeto na ANCINE (P7.5).
//
// Os dados abertos da ANCINE (dados.ancine.gov.br) recusam o acesso a partir
// dos nossos servidores (403 da própria origem; a API do dados.gov.br pede
// token). O que responde é a consulta pública de projetos do SAD/SIF, sem
// login, pelo SALIC sem hífen:
//   https://sad.ancine.gov.br/projetosaudiovisuais/ConsultaProjetosAudiovisuais.do?method=detalharProjeto&numSalic=NNNNNN
// A página é HTML em Latin-1, sem API. O formato muda com o Accept-Language do
// pedido: sem ele, valores como 1077175.5 e datas como 2024-04-03; com ele,
// "R$ 1.077.175,50" e 03/04/2024. O leitor aceita os dois. Este módulo lê dela o que importa para a
// prestação: situação, aprovações e período de captação, valores aprovados e
// captados por mecanismo e as contas de captação e de movimentação.
// Sem React e sem Supabase; quem busca a página é a rota /api/prestacoes/[id]/ancine.

export const URL_DO_SAD = "https://sad.ancine.gov.br/projetosaudiovisuais/ConsultaProjetosAudiovisuais.do?method=detalharProjeto&numSalic=";

export type ValorPorMecanismo = { mecanismo: string; aprovado: number; captado: number; saldo: number };
export type ContaNoSad = { mecanismo: string; agencia: string; conta: string; situacao: string };

export type ProjetoNoSad = {
  salic: string;
  projeto: string;
  processo: string | null;
  uf: string | null;
  segmento: string | null;
  situacao: string | null;
  dataSituacao: string | null;
  providencia: string | null;
  aprovacaoInicial: { data: string | null; ato: string | null } | null;
  primeiraLiberacao: string | null;
  ultimaProrrogacao: string | null;
  captacao: { inicio: string | null; fim: string | null } | null;
  /** Em reais, como a página mostra. */
  valores: ValorPorMecanismo[];
  total: { aprovado: number; captado: number; saldo: number } | null;
  contasDeCaptacao: ContaNoSad[];
  contasDeMovimentacao: ContaNoSad[];
};

/** SALIC como o SAD pede: só os seis dígitos. */
export const salicDoSad = (identificador: string | null | undefined) => {
  const digitos = (identificador ?? "").replace(/\D/g, "");
  return digitos.length === 6 ? digitos : null;
};

// ─── HTML ───────────────────────────────────────────────────────────────────

const ACENTOS: Record<string, string> = { acute: "́", grave: "̀", circ: "̂", tilde: "̃", uml: "̈", cedil: "̧" };
const NOMEADAS: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª", deg: "°" };

/** Entidades HTML da página (as do Latin-1 e as numéricas). */
export function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteira, nome: string) => {
    if (nome[0] === "#") return String.fromCodePoint(nome[1] === "x" || nome[1] === "X" ? parseInt(nome.slice(2), 16) : Number(nome.slice(1)));
    if (NOMEADAS[nome]) return NOMEADAS[nome];
    const m = /^([A-Za-z])(acute|grave|circ|tilde|uml|cedil)$/.exec(nome);
    return m ? (m[1] + ACENTOS[m[2]]).normalize("NFC") : inteira;
  });
}

const textoDaCelula = (html: string) => decodificar(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** As linhas das tabelas, da mais interna para fora, cada uma com o texto das células. */
function linhasDaPagina(html: string): string[][] {
  const limpo = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const linhas: string[][] = [];
  // A linha mais interna: <tr> sem outro <tr> dentro.
  for (const tr of limpo.matchAll(/<tr\b[^>]*>((?:(?!<tr\b)[\s\S])*?)<\/tr>/gi)) {
    const celulas = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(td => textoDaCelula(td[1]));
    if (celulas.length) linhas.push(celulas);
  }
  return linhas;
}

const numero = (t: string) => {
  const limpo = t.replace(/[^\d,.-]/g, "");
  if (!limpo) return 0;
  // "1077175.5" (sem Accept-Language) ou "1.077.175,50" (padrão brasileiro).
  const n = limpo.includes(",") ? Number(limpo.replace(/\./g, "").replace(",", ".")) : Number(limpo);
  return Number.isFinite(n) ? n : 0;
};
const DATA = /(\d{4})-(\d{2})-(\d{2})|(\d{2})\/(\d{2})\/(\d{4})/g;
/** As datas do texto, em ISO: aceita 2024-04-03 e 03/04/2024. */
const datas = (t: string | undefined) => [...(t ?? "").matchAll(DATA)].map(m => (m[1] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[6]}-${m[5]}-${m[4]}`));
const data = (t: string | undefined) => datas(t)[0] ?? null;
const ouNulo = (t: string | undefined) => (t && t.trim() ? t.trim() : null);
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

/** Lê a página de detalhe do projeto; null quando ela não traz o projeto (SALIC inexistente). */
export function lerProjetoDoSad(html: string): ProjetoNoSad | null {
  const linhas = linhasDaPagina(html);
  const campo = (rotulo: string) => {
    const alvo = semAcento(rotulo);
    return linhas.find(l => l.length >= 2 && semAcento(l[0]) === alvo)?.[1];
  };
  const projeto = ouNulo(campo("PROJETO"));
  const salic = ouNulo(campo("SALIC"));
  if (!projeto || !salic) return null;

  const aprovacao = (rotulo: string) => linhas.find(l => semAcento(l[0]) === semAcento(rotulo));
  const inicial = aprovacao("Aprovação Inicial");
  const periodo = aprovacao("Período de Captação")?.[1] ?? "";
  const datasDoPeriodo = datas(periodo);

  const valores: ValorPorMecanismo[] = [];
  let total: ProjetoNoSad["total"] = null;
  const contasDeCaptacao: ContaNoSad[] = [];
  const contasDeMovimentacao: ContaNoSad[] = [];
  let modo: "valores" | "captacao" | "movimentacao" | null = null;
  for (const l of linhas) {
    const primeiro = semAcento(l[0]);
    if (l.length === 1 && /CONTAS DE CAPTACAO/.test(primeiro)) { modo = "captacao"; continue; }
    if (l.length === 1 && /CONTAS DE MOVIMENTACAO/.test(primeiro)) { modo = "movimentacao"; continue; }
    if (primeiro === "MECANISMO") {
      if (semAcento(l[1] ?? "").startsWith("VALORES APROVADOS")) modo = "valores";
      continue;
    }
    if (modo === "valores" && l.length >= 4) {
      if (primeiro === "TOTAL") { total = { aprovado: numero(l[1]), captado: numero(l[2]), saldo: numero(l[3]) }; modo = null; continue; }
      valores.push({ mecanismo: l[0], aprovado: numero(l[1]), captado: numero(l[2]), saldo: numero(l[3]) });
      continue;
    }
    if ((modo === "captacao" || modo === "movimentacao") && l.length >= 4 && l[0]) {
      const conta = { mecanismo: l[0], agencia: l[1], conta: l[2].replace(/\s+/g, ""), situacao: l[3] };
      (modo === "captacao" ? contasDeCaptacao : contasDeMovimentacao).push(conta);
    }
  }

  return {
    salic,
    projeto,
    processo: ouNulo(campo("PROCESSO")),
    uf: ouNulo(campo("UF")),
    segmento: ouNulo(campo("SEGMENTO")),
    situacao: ouNulo(campo("SITUAÇÃO")),
    dataSituacao: data(campo("DATA DA SITUAÇÃO")),
    providencia: ouNulo(campo("PROVIDÊNCIA TOMADA")),
    aprovacaoInicial: inicial ? { data: data(inicial[1]), ato: ouNulo(inicial[2]) } : null,
    primeiraLiberacao: data(aprovacao("Primeira Liberação")?.[1]),
    ultimaProrrogacao: data(aprovacao("Última Prorrogação")?.[1]),
    captacao: datasDoPeriodo.length ? { inicio: datasDoPeriodo[0] ?? null, fim: datasDoPeriodo[1] ?? null } : null,
    valores,
    total,
    contasDeCaptacao,
    contasDeMovimentacao,
  };
}

// ─── Comparação com a prestação ─────────────────────────────────────────────

export type ComparacaoComSad = {
  /** Captado no SALIC × aportes no extrato, em centavos. */
  captadoNoSad: number;
  aportesNoExtrato: number;
  /** Contas do SAD que não estão cadastradas na prestação (pela conta, sem o dígito). */
  contasQueFaltam: ContaNoSad[];
};

/** A conta com e sem o último caractere: o dígito verificador vem ou não, com ou sem hífen. */
const formasDaConta = (c: string | null | undefined) => {
  const n = (c ?? "").replace(/[^0-9a-z]/gi, "").toUpperCase().replace(/^0+/, "");
  return n ? [n, n.slice(0, -1)].filter(Boolean) : [];
};

export function compararComSad(sad: ProjetoNoSad, prestacao: { aportes: number; contas: readonly { conta: string | null }[] }): ComparacaoComSad {
  const cadastradas = new Set(prestacao.contas.flatMap(c => formasDaConta(c.conta)));
  return {
    captadoNoSad: Math.round((sad.total?.captado ?? sad.valores.reduce((s, v) => s + v.captado, 0)) * 100),
    aportesNoExtrato: prestacao.aportes,
    contasQueFaltam: [...sad.contasDeCaptacao, ...sad.contasDeMovimentacao].filter(c => !formasDaConta(c.conta).some(f => cadastradas.has(f))),
  };
}
