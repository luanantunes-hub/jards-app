// Propostas de nova versão de regime (P6.2).
//
// Quando o super admin marca um ato do Diário ou uma mudança de página como
// "afeta um regime", a função agente-normativo (modo "ler") manda à IA o
// documento e o regime achatado em linhas "caminho = valor". A IA devolve as
// mudanças com o trecho literal que sustenta cada uma, e aqui elas são
// conferidas antes de virar proposta:
//   - a citação precisa estar no texto guardado (sem ela, a mudança cai);
//   - o caminho precisa existir no regime (ou a lista onde o item entra);
//   - o valor novo tem o mesmo tipo do atual e não é igual a ele;
//   - identidade do regime (código, versão, área, mecanismo) não muda.
// As mudanças aceitas são aplicadas numa cópia do regime, com a fonte do
// trecho apontando para o documento novo. O schema Zod do regime confere a
// cópia no app, antes da revisão e da publicação (P6.3): a função não
// carrega o Zod.
//
// Usado pela função, pela tela e pelos testes.

export type Operacao = "alterar" | "incluir" | "remover";
export const OPERACOES: readonly Operacao[] = ["alterar", "incluir", "remover"];

export type Classificacao = "irrelevante" | "informativo" | "altera_regra";

/** Mudança como a IA devolve: o valor vem em JSON dentro de um texto. */
export type MudancaLida = {
  operacao: string;
  caminho: string;
  valorProposto: string;
  dispositivo: string;
  citacao: string;
  explicacao: string;
  aConfirmar: boolean;
};

export type LeituraDaIa = {
  classificacao: Classificacao;
  resumo: string;
  vigencia: string | null;
  transicao: { aplicaEmAndamento: boolean | null; explicacao: string };
  mudancas: MudancaLida[];
  checagensNovas: { descricao: string; dispositivo: string; citacao: string }[];
};

export type MudancaConferida = {
  operacao: Operacao;
  caminho: string;
  valorAtual: unknown;
  valorProposto: unknown;
  dispositivo: string;
  citacao: string;
  explicacao: string;
  aConfirmar: boolean;
};

export type MudancaDescartada = { caminho: string; operacao: string; citacao: string; motivo: string };

export type ChecagemNova = { descricao: string; dispositivo: string; citacao: string; citacaoConferida: boolean };

// ─── Caminhos ───────────────────────────────────────────────────────────────

type Passo = { chave: string } | { codigo: string } | { indice: number };
type Objeto = Record<string, unknown>;

const ehObjeto = (valor: unknown): valor is Objeto => !!valor && typeof valor === "object" && !Array.isArray(valor);

/** "orcamento.tetos[codigo=administracao].percentual" em passos; null quando mal formado. */
export function passosDoCaminho(caminho: string): Passo[] | null {
  const texto = caminho.trim();
  if (!texto) return null;
  const passos: Passo[] = [];
  let i = 0;
  while (i < texto.length) {
    const nome = /^[A-Za-z_][A-Za-z0-9_]*/.exec(texto.slice(i));
    if (!nome) return null;
    passos.push({ chave: nome[0] });
    i += nome[0].length;
    while (texto[i] === "[") {
      const fim = texto.indexOf("]", i);
      if (fim < 0) return null;
      const dentro = texto.slice(i + 1, fim).trim();
      if (/^\d+$/.test(dentro)) passos.push({ indice: Number(dentro) });
      else {
        const m = /^codigo\s*=\s*["']?([^"'\]]+?)["']?$/.exec(dentro);
        if (!m) return null;
        passos.push({ codigo: m[1].trim() });
      }
      i = fim + 1;
    }
    if (i < texto.length) {
      if (texto[i] !== ".") return null;
      i += 1;
      if (i >= texto.length) return null;
    }
  }
  return passos;
}

function filho(atual: unknown, passo: Passo): { existe: boolean; valor: unknown } {
  if ("chave" in passo) {
    return ehObjeto(atual) && Object.prototype.hasOwnProperty.call(atual, passo.chave)
      ? { existe: true, valor: atual[passo.chave] }
      : { existe: false, valor: undefined };
  }
  if (!Array.isArray(atual)) return { existe: false, valor: undefined };
  const indice = "indice" in passo ? passo.indice : atual.findIndex(item => ehObjeto(item) && item.codigo === passo.codigo);
  return indice >= 0 && indice < atual.length ? { existe: true, valor: atual[indice] } : { existe: false, valor: undefined };
}

export function lerCaminho(raiz: unknown, caminho: string): { existe: boolean; valor: unknown } {
  const passos = passosDoCaminho(caminho);
  if (!passos) return { existe: false, valor: undefined };
  let atual: { existe: boolean; valor: unknown } = { existe: true, valor: raiz };
  for (const passo of passos) {
    atual = filho(atual.valor, passo);
    if (!atual.existe) return atual;
  }
  return atual;
}

function passoEmTexto(passo: Passo): string {
  if ("chave" in passo) return `.${passo.chave}`;
  return "codigo" in passo ? `[codigo=${passo.codigo}]` : `[${passo.indice}]`;
}

/** Os passos de volta em texto: o inverso de passosDoCaminho. */
export function caminhoDosPassos(passos: readonly Passo[]): string {
  return passos.map(passoEmTexto).join("").replace(/^\./, "");
}

export type { Passo };

/**
 * O regime em linhas "caminho = valor", para a IA citar caminhos que existem.
 * Fontes viram uma linha só (documento e dispositivo); o trecho citado e as
 * notas ficam de fora, para caber no pedido.
 */
export function regimeAchatado(regime: unknown): string {
  const linhas: string[] = [];
  const visitar = (valor: unknown, caminho: string) => {
    if (ehObjeto(valor)) {
      for (const [chave, filhoDoValor] of Object.entries(valor)) {
        const aqui = caminho ? `${caminho}.${chave}` : chave;
        if (chave === "fonte" && ehObjeto(filhoDoValor)) {
          const f = filhoDoValor as { documento?: unknown; dispositivo?: unknown; aConfirmar?: unknown };
          linhas.push(`${aqui} = ${[f.documento, f.dispositivo].filter(Boolean).join(", ")}${f.aConfirmar ? " (a confirmar)" : ""}`);
        } else {
          visitar(filhoDoValor, aqui);
        }
      }
      return;
    }
    if (Array.isArray(valor)) {
      if (valor.length === 0) { linhas.push(`${caminho} = []`); return; }
      if (valor.every(item => !ehObjeto(item) && !Array.isArray(item))) { linhas.push(`${caminho} = ${JSON.stringify(valor)}`); return; }
      valor.forEach((item, i) => {
        const passo: Passo = ehObjeto(item) && typeof item.codigo === "string" ? { codigo: item.codigo } : { indice: i };
        visitar(item, `${caminho}${passoEmTexto(passo)}`);
      });
      return;
    }
    linhas.push(`${caminho} = ${JSON.stringify(valor)}`);
  };
  visitar(regime, "");
  return linhas.join("\n");
}

// ─── Citação ────────────────────────────────────────────────────────────────

const INVISIVEIS = new RegExp("[" + [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0xad].map(c => String.fromCharCode(c)).join("") + "]", "g");

function normalizarCitavel(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(INVISIVEIS, "")
    .replace(/[“”«»„"]/g, '"')
    .replace(/[‘’‚`´]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const PEDACO_MINIMO = 12;

/**
 * O trecho está no texto, letra por letra (sem diferença de espaços, aspas,
 * travessões ou maiúsculas). "..." ou "[...]" pulam partes: cada pedaço precisa
 * aparecer, na ordem, e ter ao menos 12 caracteres.
 */
export function citacaoNoTexto(texto: string, citacao: string): boolean {
  const alvo = normalizarCitavel(texto);
  const pedacos = citacao
    .split(/\[\s*(?:\.\.\.|…)\s*\]|\.\.\.|…/)
    .map(p => normalizarCitavel(p).replace(/^["'\s(]+|["'\s);:,.]+$/g, ""))
    .filter(Boolean);
  if (pedacos.length === 0 || pedacos.some(p => p.length < PEDACO_MINIMO)) return false;
  if (pedacos.join(" ").length < 20) return false;
  let desde = 0;
  for (const pedaco of pedacos) {
    const achado = alvo.indexOf(pedaco, desde);
    if (achado < 0) return false;
    desde = achado + pedaco.length;
  }
  return true;
}

// ─── Aplicação ──────────────────────────────────────────────────────────────

const PROTEGIDOS = new Set(["codigo", "versao", "area", "mecanismo"]);

const tipoDe = (valor: unknown) => (valor === null ? "null" : Array.isArray(valor) ? "lista" : typeof valor);
const NOME_DO_TIPO: Record<string, string> = { number: "número", string: "texto", boolean: "sim ou não", lista: "lista", object: "objeto", null: "vazio" };

function lerValorProposto(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A fonte do trecho mais próximo do valor mudado passa a ser o documento novo. */
function atualizarFonte(raiz: Objeto, passos: Passo[], fonte: Objeto) {
  let atual: unknown = raiz;
  let dono: Objeto | null = null;
  for (const passo of passos) {
    if (ehObjeto(atual) && ehObjeto(atual.fonte)) dono = atual;
    atual = filho(atual, passo).valor;
  }
  if (ehObjeto(atual) && ehObjeto(atual.fonte)) dono = atual;
  if (dono) dono.fonte = fonte;
}

export type Resultado = { ok: true; valorAtual: unknown } | { ok: false; motivo: string };

function aplicarUma(raiz: Objeto, passos: Passo[], operacao: Operacao, valor: unknown, fonte: Objeto): Resultado {
  const pai = passos.slice(0, -1).reduce<{ existe: boolean; valor: unknown }>((atual, passo) => (atual.existe ? filho(atual.valor, passo) : atual), { existe: true, valor: raiz });
  if (!pai.existe) return { ok: false, motivo: "o caminho não existe no regime" };
  const ultimo = passos[passos.length - 1];
  const alvo = filho(pai.valor, ultimo);

  if (operacao === "alterar") {
    if (!alvo.existe) return { ok: false, motivo: "o caminho não existe no regime" };
    const antes = tipoDe(alvo.valor);
    const depois = tipoDe(valor);
    if (antes !== "null" && antes !== depois) return { ok: false, motivo: `o valor proposto é ${NOME_DO_TIPO[depois] ?? depois}, e o atual é ${NOME_DO_TIPO[antes] ?? antes}` };
    if (igual(alvo.valor, valor)) return { ok: false, motivo: "o valor proposto é igual ao atual" };
    if ("chave" in ultimo) (pai.valor as Objeto)[ultimo.chave] = valor;
    else {
      const lista = pai.valor as unknown[];
      lista[lista.indexOf(alvo.valor)] = valor;
    }
    atualizarFonte(raiz, passos, fonte);
    return { ok: true, valorAtual: alvo.valor };
  }

  if (operacao === "incluir") {
    if (alvo.existe && Array.isArray(alvo.valor)) {
      if (ehObjeto(valor) && typeof valor.codigo === "string"
          && alvo.valor.some(item => ehObjeto(item) && item.codigo === valor.codigo)) {
        return { ok: false, motivo: `a lista já tem um item com o código ${valor.codigo}` };
      }
      const item = ehObjeto(valor) && !ehObjeto(valor.fonte) && alvo.valor.some(x => ehObjeto(x) && ehObjeto(x.fonte)) ? { ...valor, fonte } : valor;
      alvo.valor.push(item);
      return { ok: true, valorAtual: null };
    }
    if (!alvo.existe && "chave" in ultimo && ehObjeto(pai.valor)) {
      pai.valor[ultimo.chave] = ehObjeto(valor) && !ehObjeto(valor.fonte) ? { ...valor, fonte } : valor;
      return { ok: true, valorAtual: null };
    }
    return { ok: false, motivo: "para incluir, o caminho precisa ser uma lista do regime ou uma chave nova" };
  }

  if (!alvo.existe) return { ok: false, motivo: "o caminho não existe no regime" };
  if ("chave" in ultimo) delete (pai.valor as Objeto)[ultimo.chave];
  else {
    const lista = pai.valor as unknown[];
    lista.splice(lista.indexOf(alvo.valor), 1);
  }
  return { ok: true, valorAtual: alvo.valor };
}

/**
 * Aplica uma mudança no regime (que é alterado no lugar), com as mesmas travas
 * da leitura: caminho que existe, mesmo tipo de valor e identidade intocada.
 * A fonte do trecho passa a ser `fonte`. Usada também na revisão (P6.3).
 */
export function aplicarMudanca(raiz: Objeto, caminho: string, operacao: Operacao, valor: unknown, fonte: Objeto): Resultado {
  if (!OPERACOES.includes(operacao)) return { ok: false, motivo: "operação desconhecida" };
  const passos = passosDoCaminho(caminho);
  if (!passos) return { ok: false, motivo: "caminho mal escrito" };
  if ("chave" in passos[0] && PROTEGIDOS.has(passos[0].chave) && passos.length === 1) {
    return { ok: false, motivo: "código, versão, área e mecanismo do regime não mudam por proposta" };
  }
  return aplicarUma(raiz, passos, operacao, operacao === "remover" ? null : valor, fonte);
}

export type DocumentoDaProposta = { documento: string; url: string | null; texto: string };

export type PropostaConferida = {
  mudancas: MudancaConferida[];
  descartadas: MudancaDescartada[];
  checagensNovas: ChecagemNova[];
  /** O regime com as mudanças aceitas e a versão seguinte; null quando nada mudou. */
  regimeProposto: Objeto | null;
};

/** Confere cada mudança lida pela IA e aplica as aceitas numa cópia do regime. */
export function conferirLeitura(regime: Objeto, leitura: LeituraDaIa, doc: DocumentoDaProposta): PropostaConferida {
  const copia = structuredClone(regime);
  const mudancas: MudancaConferida[] = [];
  const descartadas: MudancaDescartada[] = [];
  const descartar = (m: MudancaLida, motivo: string) => descartadas.push({ caminho: m.caminho, operacao: m.operacao, citacao: m.citacao, motivo });

  for (const m of leitura.mudancas) {
    const operacao = m.operacao as Operacao;
    if (!OPERACOES.includes(operacao)) { descartar(m, "operação desconhecida"); continue; }
    const passos = passosDoCaminho(m.caminho);
    if (!passos) { descartar(m, "caminho mal escrito"); continue; }
    if ("chave" in passos[0] && PROTEGIDOS.has(passos[0].chave) && passos.length === 1) {
      descartar(m, "código, versão, área e mecanismo do regime não mudam por proposta");
      continue;
    }
    // A citação vem antes do tipo: sem trecho no texto, nem vale conferir o valor.
    if (!citacaoNoTexto(doc.texto, m.citacao)) { descartar(m, "o trecho citado não está no texto guardado"); continue; }
    const valor = operacao === "remover" ? null : lerValorProposto(m.valorProposto);
    const fonte: Objeto = {
      documento: doc.documento,
      dispositivo: m.dispositivo || "dispositivo não indicado",
      citacao: m.citacao.replace(/\s+/g, " ").trim().slice(0, 400),
      ...(m.aConfirmar ? { aConfirmar: true } : {}),
    };
    const resultado = aplicarUma(copia, passos, operacao, valor, fonte);
    if (!resultado.ok) { descartar(m, resultado.motivo); continue; }
    mudancas.push({
      operacao,
      caminho: m.caminho.trim(),
      valorAtual: resultado.valorAtual,
      valorProposto: valor,
      dispositivo: m.dispositivo,
      citacao: m.citacao,
      explicacao: m.explicacao,
      aConfirmar: m.aConfirmar,
    });
  }

  if (mudancas.length > 0) {
    copia.versao = (typeof regime.versao === "number" ? regime.versao : 0) + 1;
    if (doc.url && Array.isArray(copia.fontes) && !copia.fontes.some(f => ehObjeto(f) && f.url === doc.url)) {
      copia.fontes.push({ documento: doc.documento, url: doc.url });
    }
  }

  return {
    mudancas,
    descartadas,
    checagensNovas: leitura.checagensNovas.map(c => ({ ...c, citacaoConferida: citacaoNoTexto(doc.texto, c.citacao) })),
    regimeProposto: mudancas.length > 0 ? copia : null,
  };
}

// ─── Pedido à IA ────────────────────────────────────────────────────────────

export const ESQUEMA_DA_PROPOSTA = {
  type: "OBJECT",
  properties: {
    classificacao: { type: "STRING", enum: ["irrelevante", "informativo", "altera_regra"] },
    resumo: { type: "STRING" },
    vigencia: { type: "STRING", nullable: true },
    transicao: {
      type: "OBJECT",
      properties: { aplicaEmAndamento: { type: "BOOLEAN", nullable: true }, explicacao: { type: "STRING" } },
      required: ["explicacao"],
      propertyOrdering: ["aplicaEmAndamento", "explicacao"],
    },
    mudancas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          operacao: { type: "STRING", enum: [...OPERACOES] },
          caminho: { type: "STRING" },
          valorProposto: { type: "STRING" },
          dispositivo: { type: "STRING" },
          citacao: { type: "STRING" },
          explicacao: { type: "STRING" },
          aConfirmar: { type: "BOOLEAN" },
        },
        required: ["operacao", "caminho", "valorProposto", "dispositivo", "citacao", "explicacao", "aConfirmar"],
        propertyOrdering: ["operacao", "caminho", "valorProposto", "dispositivo", "citacao", "explicacao", "aConfirmar"],
      },
    },
    checagensNovas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { descricao: { type: "STRING" }, dispositivo: { type: "STRING" }, citacao: { type: "STRING" } },
        required: ["descricao", "dispositivo", "citacao"],
        propertyOrdering: ["descricao", "dispositivo", "citacao"],
      },
    },
  },
  required: ["classificacao", "resumo", "transicao", "mudancas", "checagensNovas"],
  propertyOrdering: ["classificacao", "resumo", "vigencia", "transicao", "mudancas", "checagensNovas"],
};

const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");

/** Lê a resposta da IA sem confiar no formato; o que não vier vira vazio. */
export function lerLeituraDaIa(bruta: unknown): LeituraDaIa | null {
  if (!ehObjeto(bruta)) return null;
  const classificacao = ["irrelevante", "informativo", "altera_regra"].includes(texto(bruta.classificacao))
    ? bruta.classificacao as Classificacao
    : null;
  if (!classificacao) return null;
  const transicao = ehObjeto(bruta.transicao) ? bruta.transicao : {};
  const vigencia = texto(bruta.vigencia);
  return {
    classificacao,
    resumo: texto(bruta.resumo).slice(0, 2000),
    vigencia: /^\d{4}-\d{2}-\d{2}$/.test(vigencia) ? vigencia : null,
    transicao: {
      aplicaEmAndamento: typeof transicao.aplicaEmAndamento === "boolean" ? transicao.aplicaEmAndamento : null,
      explicacao: texto(transicao.explicacao).slice(0, 2000),
    },
    mudancas: (Array.isArray(bruta.mudancas) ? bruta.mudancas : []).filter(ehObjeto).slice(0, 40).map(m => ({
      operacao: texto(m.operacao),
      caminho: texto(m.caminho).slice(0, 300),
      valorProposto: typeof m.valorProposto === "string" ? m.valorProposto : JSON.stringify(m.valorProposto ?? null),
      dispositivo: texto(m.dispositivo).slice(0, 300),
      citacao: texto(m.citacao).slice(0, 2000),
      explicacao: texto(m.explicacao).slice(0, 1000),
      aConfirmar: m.aConfirmar === true,
    })),
    checagensNovas: (Array.isArray(bruta.checagensNovas) ? bruta.checagensNovas : []).filter(ehObjeto).slice(0, 20).map(c => ({
      descricao: texto(c.descricao).slice(0, 1000),
      dispositivo: texto(c.dispositivo).slice(0, 300),
      citacao: texto(c.citacao).slice(0, 2000),
    })),
  };
}

export type ContextoDaLeituraNormativa = {
  documento: { titulo: string; tipo: string | null; orgao: string; publicadoEm: string; url: string | null };
  /** Texto inteiro do ato ou da versão atual da página. */
  texto: string;
  /** Página vigiada: os trechos que mudaram, com "ANTES" e "AGORA". */
  trechosQueMudaram: string | null;
  regime: { codigo: string; nome: string; versao: number; normaReferencia: string; achatado: string };
};

const TEXTO_NO_PEDIDO = 150_000;

export function promptDaLeituraNormativa(c: ContextoDaLeituraNormativa): string {
  const data = c.documento.publicadoEm.split("-").reverse().join("/");
  const cabecalho = c.trechosQueMudaram
    ? `Página vigiada: ${c.documento.titulo} (${c.documento.orgao}), coletada em ${data}. A página mudou desde a versão anterior.`
    : `Documento: ${c.documento.titulo} (${[c.documento.tipo, c.documento.orgao].filter(Boolean).join(", ")}), publicado em ${data}.`;
  const corpo = c.texto.length > TEXTO_NO_PEDIDO ? `${c.texto.slice(0, TEXTO_NO_PEDIDO)}\n[texto cortado]` : c.texto;
  return [
    "Você mantém o catálogo de regras de prestação de contas de leis de incentivo do Jards. Leia o documento e diga se ele muda alguma regra do regime abaixo.",
    "",
    cabecalho,
    ...(c.trechosQueMudaram ? ["", "Trechos que mudaram (ANTES é a versão anterior; AGORA, a atual):", c.trechosQueMudaram] : []),
    "",
    c.trechosQueMudaram ? "Texto atual inteiro:" : "Texto do documento:",
    corpo,
    "",
    `Regime: ${c.regime.nome} (código ${c.regime.codigo}, versão ${c.regime.versao}). Norma de referência: ${c.regime.normaReferencia}.`,
    "Parâmetros do regime, um por linha (caminho = valor). As linhas \".fonte\" dizem de que norma veio cada regra:",
    c.regime.achatado,
    "",
    "Responda em JSON:",
    "1. classificacao: \"altera_regra\" se o documento muda um valor, prazo, limite, documento exigido, vedação ou regra listada acima; \"informativo\" se trata do mesmo programa ou lei, mas não muda nenhum parâmetro listado; \"irrelevante\" se não tem relação com o regime.",
    "2. resumo: em até 3 frases, o que o documento muda para quem presta contas neste regime.",
    "3. mudancas: uma por parâmetro que muda.",
    "   - operacao: \"alterar\" troca o valor de um caminho que existe; \"incluir\" acrescenta um item a uma lista (o caminho é o da lista) ou cria uma chave nova; \"remover\" tira um caminho.",
    "   - caminho: exatamente como na lista acima. Em listas, use [codigo=...] para itens com código.",
    "   - valorProposto: o valor novo em JSON (número sem aspas, texto entre aspas, item completo ao incluir, no mesmo formato dos itens da lista). Ao remover, use null.",
    "   - dispositivo: artigo, parágrafo, inciso e alínea do documento.",
    "   - citacao: o trecho do documento que sustenta o valor, copiado letra por letra, sem resumir nem corrigir, de uma a três frases. Use ... para pular partes. Sem trecho literal no documento, não proponha a mudança.",
    "   - explicacao: por que o parâmetro muda, em uma frase.",
    "   - aConfirmar: true quando o texto é ambíguo ou depende de outro ato.",
    "4. Não proponha mudança de redação, nem de parâmetro que o documento não toca, nem valor que não esteja escrito no documento.",
    "5. checagensNovas: regra nova que não cabe em nenhum caminho do regime e pediria uma checagem nova no sistema, com o trecho literal.",
    "6. vigencia: a data em que a mudança passa a valer (AAAA-MM-DD), se o documento disser; senão null.",
    "7. transicao: aplicaEmAndamento diz se a mudança vale para projetos já aprovados ou em execução (null se o documento não diz), com a explicação e o dispositivo.",
  ].join("\n");
}
