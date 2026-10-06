// Leitura de documento v2 (P2.10b): o que a leitura por IA do comprovante
// devolve, os motivos que ela pode apontar e o prompt montado com o regime da
// prestação. Cada motivo é um código do catálogo de checagens
// (lib/prestacao/checagens/catalogo.ts), e a fonte vem da regra do regime,
// nunca do texto da IA. Usado pela função extrair-comprovante e pelo app; sem
// dependências, para rodar no Deno e no Node.

export const TIPOS_DA_LEITURA = [
  "nfe", "nfse", "cupom", "recibo", "rpa", "rpci", "invoice", "fatura", "folha_pagamento", "guia_tributo", "apolice", "nota_debito",
  "contrato", "extrato", "cartao_embarque", "print_screenshot", "foto", "planilha", "outro",
] as const;

/**
 * O que a IA pode apontar no documento. O que o app confere sozinho (data no
 * período, número do projeto, chave, retenções) fica de fora: a IA só lê.
 */
export const MOTIVOS_DA_LEITURA = {
  DOC_ILEGIVEL: { quando: "o documento está ilegível, cortado ou rasurado a ponto de não dar para conferir valor, data, emitente ou descrição", regras: [] },
  DOC_SEM_VALOR_FISCAL: { quando: "o documento tem marca de cancelamento, ou é orçamento, pedido, pré-nota, proposta ou outro papel sem valor fiscal", regras: [] },
  DOC_TOMADOR: { quando: "o documento está em nome de outra pessoa ou empresa que não o proponente", regras: ["em_nome_do_proponente"] },
  DOC_DESCRICAO_VAGA: { quando: "a descrição é genérica (\"serviços prestados\", \"material diverso\") e não deixa ligar o gasto a um item do orçamento", regras: ["em_nome_do_proponente"] },
  DOC_RECIBO_INCOMPLETO: { quando: "recibo, RPA ou RPCI sem assinatura, sem CPF ou CNPJ de quem recebeu, ou sem dizer o serviço", regras: [] },
  PAGAMENTO_MEIO: { quando: "o documento diz que o pagamento foi em dinheiro, cheque ou saque", regras: ["saque_cheque_cartao"] },
  DESPESA_VEDADA: { quando: "o gasto parece uma das despesas vedadas do regime; diga qual no campo vedada, com o código da lista", regras: [] },
} as const satisfies Record<string, { quando: string; regras: readonly string[] }>;

export type MotivoDaLeitura = keyof typeof MOTIVOS_DA_LEITURA;
export const CODIGOS_DOS_MOTIVOS = Object.keys(MOTIVOS_DA_LEITURA) as MotivoDaLeitura[];

export type MotivoLido = { codigo: MotivoDaLeitura; texto: string; vedada?: string | null };

export type ParteLida = { documento: string | null; nome: string | null };

/** O que a função devolve em `leitura`. */
export type LeituraDoComprovante = {
  tipo: (typeof TIPOS_DA_LEITURA)[number] | null;
  valor: number | null;
  data_doc: string | null;
  descricao_servico: string | null;
  numero_documento: string | null;
  serie: string | null;
  chave_acesso: string | null;
  emitente: ParteLida;
  tomador: ParteLida;
  retencoes: { iss: number; inss: number; irrf: number; outras: number };
  identificador_no_documento: boolean | null;
  item_sugerido_id: string | null;
  motivos: MotivoLido[];
};

const parte = {
  type: "OBJECT",
  properties: { documento: { type: "STRING", nullable: true }, nome: { type: "STRING", nullable: true } },
  propertyOrdering: ["documento", "nome"],
};

export const ESQUEMA_DA_LEITURA = {
  type: "OBJECT",
  properties: {
    tipo: { type: "STRING", enum: [...TIPOS_DA_LEITURA], nullable: true },
    valor: { type: "NUMBER", nullable: true },
    data_doc: { type: "STRING", nullable: true },
    descricao_servico: { type: "STRING", nullable: true },
    numero_documento: { type: "STRING", nullable: true },
    serie: { type: "STRING", nullable: true },
    chave_acesso: { type: "STRING", nullable: true },
    emitente: parte,
    tomador: parte,
    retencoes: {
      type: "OBJECT",
      properties: { iss: { type: "NUMBER" }, inss: { type: "NUMBER" }, irrf: { type: "NUMBER" }, outras: { type: "NUMBER" } },
      required: ["iss", "inss", "irrf", "outras"],
      propertyOrdering: ["iss", "inss", "irrf", "outras"],
    },
    identificador_no_documento: { type: "BOOLEAN", nullable: true },
    item_sugerido_id: { type: "STRING", nullable: true },
    motivos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          codigo: { type: "STRING", enum: CODIGOS_DOS_MOTIVOS },
          texto: { type: "STRING" },
          vedada: { type: "STRING", nullable: true },
        },
        required: ["codigo", "texto"],
        propertyOrdering: ["codigo", "texto", "vedada"],
      },
    },
  },
  required: ["tipo", "valor", "data_doc", "emitente", "tomador", "retencoes", "motivos"],
  propertyOrdering: [
    "tipo", "valor", "data_doc", "descricao_servico", "numero_documento", "serie", "chave_acesso",
    "emitente", "tomador", "retencoes", "identificador_no_documento", "item_sugerido_id", "motivos",
  ],
};

// ─── Regime ─────────────────────────────────────────────────────────────────

type RegraDoRegime = { codigo: string; descricao: string };
type VedadaDoRegime = { codigo: string; descricao: string };

/** Regras das dimensões do regime (regras e documento fiscal), como o catálogo lê. */
export function regrasDoRegimeJson(regime: unknown): RegraDoRegime[] {
  const regras: RegraDoRegime[] = [];
  if (!regime || typeof regime !== "object") return regras;
  for (const valor of Object.values(regime as Record<string, unknown>)) {
    if (!valor || typeof valor !== "object" || Array.isArray(valor) || "lacuna" in valor) continue;
    const dimensao = valor as { regras?: unknown; documentoFiscal?: unknown };
    for (const lista of [dimensao.regras, dimensao.documentoFiscal]) {
      if (!Array.isArray(lista)) continue;
      for (const r of lista) {
        if (r && typeof r === "object" && typeof r.codigo === "string" && typeof r.descricao === "string") regras.push({ codigo: r.codigo, descricao: r.descricao });
      }
    }
  }
  return regras;
}

export function vedadasDoRegimeJson(regime: unknown): VedadaDoRegime[] {
  const despesas = (regime as { despesas?: { vedadas?: unknown } } | null)?.despesas;
  if (!despesas || !Array.isArray(despesas.vedadas)) return [];
  return despesas.vedadas.filter((v): v is VedadaDoRegime => v && typeof v.codigo === "string" && typeof v.descricao === "string")
    .map(v => ({ codigo: v.codigo, descricao: v.descricao }));
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

export type ContextoDaLeitura = {
  regime: { nome: string; parametros: unknown } | null;
  identificador: { valor: string; tipo: string | null } | null;
  proponente: ParteLida | null;
  periodo: { inicio: string | null; fim: string | null };
  itens: { id: string; nome: string; descricao: string | null }[];
};

const linha = (texto: string | null | undefined) => (texto ? texto.replace(/\s+/g, " ").trim() : "");

export function promptDaLeitura(c: ContextoDaLeitura): string {
  const regras = c.regime ? regrasDoRegimeJson(c.regime.parametros) : [];
  const vedadas = c.regime ? vedadasDoRegimeJson(c.regime.parametros) : [];
  const motivos = CODIGOS_DOS_MOTIVOS
    .filter(codigo => codigo !== "DESPESA_VEDADA" || vedadas.length > 0)
    .map(codigo => {
      const m = MOTIVOS_DA_LEITURA[codigo];
      const regra = (m.regras as readonly string[]).map(r => regras.find(x => x.codigo === r)).find(Boolean);
      return `- ${codigo}: quando ${m.quando}.${regra ? ` Regra do regime: ${linha(regra.descricao)}` : ""}`;
    });

  const contexto = [
    c.regime ? `Regime da prestação de contas: ${linha(c.regime.nome)}.` : "Regime da prestação de contas: não informado.",
    c.proponente && (c.proponente.nome || c.proponente.documento)
      ? `Proponente (o tomador esperado): ${[linha(c.proponente.nome), c.proponente.documento].filter(Boolean).join(", CPF/CNPJ ")}.`
      : "Proponente: não informado.",
    c.identificador ? `Número do projeto (${linha(c.identificador.tipo) || "identificador"}): ${linha(c.identificador.valor)}.` : null,
    c.periodo.inicio || c.periodo.fim ? `Período de execução: ${c.periodo.inicio ?? "?"} a ${c.periodo.fim ?? "?"}.` : null,
  ].filter(Boolean).join("\n");

  return `Você lê comprovantes de despesa de projetos incentivados (leis de incentivo à cultura, ao esporte e à saúde) para a prestação de contas.
Leia o documento anexo e preencha o JSON do esquema. Copie o que está escrito; não invente nem complete dados que não aparecem: o que não estiver no documento fica null (retenções sem destaque ficam 0).

${contexto}

Campos:
- tipo: nfe (NF-e ou DANFE), nfse (nota de serviço), cupom (cupom fiscal ou NFC-e), recibo, rpa, rpci, invoice (documento do exterior), fatura, folha_pagamento, guia_tributo, apolice, nota_debito; se não for despesa: contrato, extrato, cartao_embarque, print_screenshot, foto, planilha ou outro.
- valor: o valor bruto do documento, com ponto decimal. data_doc: a data de emissão em AAAA-MM-DD.
- descricao_servico: o serviço ou produto, em até 120 caracteres, nas palavras do documento.
- numero_documento e serie: como estão no documento. chave_acesso: só os 44 (NF-e) ou 50 (NFS-e nacional) caracteres da chave, sem espaços, se estiver legível; senão null.
- emitente e tomador: nome e CPF ou CNPJ, só os caracteres, de quem emitiu e de quem consta como tomador ou destinatário.
- retencoes: valores retidos destacados no documento: iss (ISS retido), inss, irrf e outras (PIS, COFINS, CSLL e demais). ISS que não foi retido fica 0.
- identificador_no_documento: true se o número do projeto aparece no documento, false se não aparece, null se não foi informado acima.
- item_sugerido_id: o id do item do orçamento que melhor corresponde ao gasto, ou null se nenhum corresponde.
- motivos: só o que você vê no documento, com uma frase curta e concreta em texto (cite o trecho quando ajudar). Lista vazia quando não há nada. Códigos:
${motivos.join("\n")}
${vedadas.length ? `\nDespesas vedadas do regime (para DESPESA_VEDADA, use o código em vedada):\n${vedadas.map(v => `- ${v.codigo}: ${linha(v.descricao)}`).join("\n")}` : ""}

Itens do orçamento aprovado:
${c.itens.length ? JSON.stringify(c.itens.map(i => ({ id: i.id, item: linha(i.nome), descricao: linha(i.descricao) || undefined }))) : "[] (sem orçamento cadastrado)"}`;
}

// ─── Resposta ───────────────────────────────────────────────────────────────

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const naoNegativo = (v: unknown) => Math.max(numero(v) ?? 0, 0);
const documento = (v: unknown) => texto(v)?.toUpperCase().replace(/[^0-9A-Z]/g, "") || null;

/** Confere a resposta da IA contra o esquema: tipos, códigos e item da lista. */
export function lerRespostaDaLeitura(bruta: unknown, idsDosItens: readonly string[], vedadas: readonly string[]): LeituraDoComprovante {
  const r = (bruta && typeof bruta === "object" ? bruta : {}) as Record<string, unknown>;
  const parteDe = (v: unknown): ParteLida => {
    const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return { documento: documento(p.documento), nome: texto(p.nome) };
  };
  const ret = (r.retencoes && typeof r.retencoes === "object" ? r.retencoes : {}) as Record<string, unknown>;
  const data = texto(r.data_doc);
  const motivos = (Array.isArray(r.motivos) ? r.motivos : [])
    .map(m => (m && typeof m === "object" ? m as Record<string, unknown> : {}))
    .filter(m => typeof m.codigo === "string" && m.codigo in MOTIVOS_DA_LEITURA && texto(m.texto))
    .map(m => {
      const vedada = texto(m.vedada);
      return {
        codigo: m.codigo as MotivoDaLeitura,
        texto: texto(m.texto)!.slice(0, 300),
        ...(m.codigo === "DESPESA_VEDADA" ? { vedada: vedada && vedadas.includes(vedada) ? vedada : null } : {}),
      };
    })
    // DESPESA_VEDADA sem uma vedada da lista não diz qual regra: fica de fora.
    .filter(m => m.codigo !== "DESPESA_VEDADA" || m.vedada)
    .slice(0, 10);
  const item = texto(r.item_sugerido_id);
  return {
    tipo: (TIPOS_DA_LEITURA as readonly string[]).includes(r.tipo as string) ? r.tipo as LeituraDoComprovante["tipo"] : null,
    valor: numero(r.valor),
    data_doc: data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null,
    descricao_servico: texto(r.descricao_servico)?.slice(0, 200) ?? null,
    numero_documento: texto(r.numero_documento),
    serie: texto(r.serie),
    chave_acesso: documento(r.chave_acesso),
    emitente: parteDe(r.emitente),
    tomador: parteDe(r.tomador),
    retencoes: { iss: naoNegativo(ret.iss), inss: naoNegativo(ret.inss), irrf: naoNegativo(ret.irrf), outras: naoNegativo(ret.outras) },
    identificador_no_documento: typeof r.identificador_no_documento === "boolean" ? r.identificador_no_documento : null,
    item_sugerido_id: item && idsDosItens.includes(item) ? item : null,
    motivos,
  };
}

// ─── Custo ──────────────────────────────────────────────────────────────────

export type UsoDaChamada = { entrada: number | null; saida: number | null; total: number | null };

/** usageMetadata do Gemini; o raciocínio (thoughts) é cobrado como saída. */
export function usoDaResposta(corpo: unknown): UsoDaChamada {
  const u = ((corpo as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const entrada = n(u.promptTokenCount);
  const candidatos = n(u.candidatesTokenCount);
  const raciocinio = n(u.thoughtsTokenCount);
  const saida = candidatos === null && raciocinio === null ? null : (candidatos ?? 0) + (raciocinio ?? 0);
  return { entrada, saida, total: n(u.totalTokenCount) };
}

/**
 * Custo em dólares pelo preço por milhão de tokens do secret
 * GOOGLE_AI_PRECOS ({"modelo": [entrada, saida]}); sem preço, null.
 */
export function custoDaChamada(precosJson: string | null | undefined, modelo: string, uso: UsoDaChamada): number | null {
  if (!precosJson || uso.entrada === null || uso.saida === null) return null;
  try {
    const precos = JSON.parse(precosJson) as Record<string, unknown>;
    const preco = precos[modelo];
    if (!Array.isArray(preco) || preco.length !== 2 || !preco.every(p => typeof p === "number" && p >= 0)) return null;
    return Math.round(((uso.entrada * preco[0] + uso.saida * preco[1]) / 1_000_000) * 1_000_000) / 1_000_000;
  } catch {
    return null;
  }
}
