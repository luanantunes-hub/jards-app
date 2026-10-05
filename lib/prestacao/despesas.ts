// Despesa v2 (P2.4): o comprovante fiscal da prestação passa a ser a despesa,
// ligada ao fornecedor e ao item do orçamento, com o documento fiscal
// (número, série, chave de acesso) e as retenções.
//
// alertasDaDespesa junta o que a pessoa precisa resolver ou justificar antes
// de enviar: fornecedor (situação, sanções, cartão CNPJ, certidão perto da
// data), CNAE do fornecedor contra os CNAEs aceitos pelo item, chave de
// acesso (dígito, emitente, data, repetida), retenções e identificação do
// projeto. Os códigos são os do catálogo de checagens (estudo, seção 8); o
// motor da P2.7 vai registrar e cruzar com o regime. Sem React e sem Supabase.

import { cnaesCompativeis, cnaesDoFornecedor, formatarCodigoCnae } from "./cnae";
import { alertasDoFornecedor, faltaCartaoCnpj, limparDocumento } from "./fornecedores";
import type { PrestacaoComprovante, PrestacaoFornecedor, PrestacaoFornecedorDocumento, TipoComprovante } from "@/lib/supabase/types";

/** Documentos que são a despesa; os demais (contrato, extrato, foto…) só complementam. */
export const TIPOS_FISCAIS: TipoComprovante[] = [
  "nfe", "nfse", "cupom", "recibo", "rpa", "rpci", "invoice", "fatura", "folha_pagamento", "guia_tributo", "apolice", "nota_debito",
];

export const TIPOS_COMPLEMENTARES: TipoComprovante[] = ["contrato", "extrato", "cartao_embarque", "print_screenshot", "foto", "planilha", "outro"];

export function ehDespesa(tipo: TipoComprovante): boolean {
  return TIPOS_FISCAIS.includes(tipo);
}

/** Folha e guia de tributo não têm fornecedor no cadastro: a checagem é do recolhimento. */
const SEM_FORNECEDOR: TipoComprovante[] = ["folha_pagamento", "guia_tributo"];

export const IDENTIFICACAO_PROJETO = [
  { id: "presente", rotulo: "Consta no documento" },
  { id: "declaracao", rotulo: "Por declaração anexa" },
  { id: "ausente", rotulo: "Não consta" },
] as const;

// ─── Chave de acesso ────────────────────────────────────────────────────────

/** Só letras e algarismos, em maiúsculas (o CNPJ alfanumérico entra na chave). */
export function limparChave(valor: unknown): string {
  return String(valor ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export type ChaveLida =
  | {
    ok: true;
    familia: "nfe";
    /** 55 NF-e, 65 NFC-e, 57 CT-e, 67 CT-e OS, 59 CF-e SAT… */
    modelo: string;
    uf: string;
    /** AAAA-MM da emissão. */
    anoMes: string;
    emitente: string;
    serie: string | null;
    numero: string;
  }
  | { ok: true; familia: "nfse"; municipio: string; anoMes: string; emitente: string; numero: string }
  | { ok: false; motivo: string };

/** Mód. 11 com pesos de 2 a 9 da direita; cada caractere vale o código ASCII menos 48, como no CNPJ alfanumérico. */
function digitoDaChave(base: string): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += (base.charCodeAt(base.length - 1 - i) - 48) * (2 + (i % 8));
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

const MODELOS: Record<string, string> = { "55": "NF-e", "65": "NFC-e", "57": "CT-e", "67": "CT-e OS", "59": "CF-e SAT", "58": "MDF-e" };

export function rotuloDoModelo(modelo: string): string {
  return MODELOS[modelo] ?? `modelo ${modelo}`;
}

/**
 * Lê a chave da NF-e e família (44 posições, com dígito verificador) ou da
 * NFS-e nacional (50 posições). Devolve null quando a chave está vazia.
 */
export function lerChaveAcesso(valor: unknown): ChaveLida | null {
  const chave = limparChave(valor);
  if (!chave) return null;
  if (chave.length === 44) {
    if (!/^\d{6}[0-9A-Z]{12}\d{26}$/.test(chave)) return { ok: false, motivo: "A chave de 44 posições tem letra fora do CNPJ do emitente." };
    if (digitoDaChave(chave.slice(0, 43)) !== Number(chave[43])) return { ok: false, motivo: "O dígito verificador da chave não confere; confira a digitação." };
    const modelo = chave.slice(20, 22);
    const sat = modelo === "59";
    return {
      ok: true,
      familia: "nfe",
      modelo,
      uf: chave.slice(0, 2),
      anoMes: `20${chave.slice(2, 4)}-${chave.slice(4, 6)}`,
      emitente: chave.slice(6, 20),
      serie: sat ? null : chave.slice(22, 25),
      numero: sat ? chave.slice(31, 37) : chave.slice(25, 34),
    };
  }
  if (chave.length === 50) {
    // Município (7), ambiente (1), tipo de inscrição (1: CPF, 2: CNPJ), inscrição (14), número (13), AAMM (4), aleatório (9), DV (1).
    if (!/^\d{9}[0-9A-Z]{12}\d{29}$/.test(chave)) return { ok: false, motivo: "A chave da NFS-e tem caractere fora do lugar." };
    const inscricao = chave.slice(9, 23);
    return {
      ok: true,
      familia: "nfse",
      municipio: chave.slice(0, 7),
      anoMes: `20${chave.slice(36, 38)}-${chave.slice(38, 40)}`,
      emitente: chave[8] === "1" ? inscricao.slice(3) : inscricao,
      numero: chave.slice(23, 36),
    };
  }
  return { ok: false, motivo: `A chave tem ${chave.length} posições; a da NF-e tem 44 e a da NFS-e nacional, 50.` };
}

// ─── Valores ────────────────────────────────────────────────────────────────

export type ValoresDaDespesa = Pick<PrestacaoComprovante, "valor_extraido" | "iss" | "inss" | "irrf" | "outras_retencoes">;

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export function totalRetido(d: ValoresDaDespesa): number {
  return Math.round((numero(d.iss) + numero(d.inss) + numero(d.irrf) + numero(d.outras_retencoes)) * 100) / 100;
}

/** O que sai para o fornecedor: bruto menos as retenções (o banco guarda a mesma conta). */
export function valorLiquido(d: ValoresDaDespesa): number | null {
  if (d.valor_extraido === null || d.valor_extraido === undefined) return null;
  return Math.round((numero(d.valor_extraido) - totalRetido(d)) * 100) / 100;
}

// ─── Alertas ────────────────────────────────────────────────────────────────

export type CodigoAlertaDespesa =
  | "DESPESA_SEM_FORNECEDOR"
  | "DESPESA_SEM_ITEM"
  | "DESPESA_SEM_VALOR"
  | "FORNECEDOR_CNAE"
  | "FORNECEDOR_SEM_CARTAO_CNPJ"
  | "FORNECEDOR_CERTIDAO_DA_DATA"
  | "DOC_CHAVE_INVALIDA"
  | "NFE_CHAVE_REPETIDA"
  | "DOC_RETENCOES"
  | "DOC_PJ_SEM_NF"
  | "DOC_IDENTIFICACAO_PROJETO"
  // Pagamentos (P2.5, lib/prestacao/pagamentos.ts)
  | "PAGAMENTO_FALTANDO"
  | "PAGAMENTO_EXCEDE"
  | "PAGAMENTO_ANTECIPADO"
  | "PAGAMENTO_MEIO"
  | "PAGAMENTO_SEM_NUMERO"
  | "FAVORECIDO_DIFERENTE";

export type AlertaDespesa = {
  codigo: CodigoAlertaDespesa | ReturnType<typeof alertasDoFornecedor>[number]["codigo"];
  nivel: "alerta" | "info";
  texto: string;
};

export type DespesaParaChecar = Pick<
  PrestacaoComprovante,
  "tipo" | "data_doc" | "valor_extraido" | "fornecedor_id" | "numero_documento" | "chave_acesso" | "iss" | "inss" | "irrf" | "outras_retencoes" | "identificacao_projeto"
>;

export type ItemParaChecar = {
  nome: string;
  /** CNAEs que valem para o item (os próprios ou herdados), só algarismos. */
  cnaes: readonly string[];
  /** De onde vieram os CNAEs, quando de um agrupador. */
  origem: { nome: string } | null;
};

/** Até quantos dias da data do documento a certidão de sanções conta como "da data". */
export const DIAS_CERTIDAO_DA_DATA = 30;

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const mesBr = (anoMes: string) => anoMes.split("-").reverse().join("/");
const diasEntre = (a: string, b: string) => Math.round(Math.abs(Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
const listaCnaes = (cnaes: readonly string[]) => cnaes.map(formatarCodigoCnae).join(", ");

/**
 * O que a despesa tem a resolver ou justificar. Vazio para documento
 * complementar (contrato, extrato, foto…), que não é a despesa.
 */
export function alertasDaDespesa(p: {
  despesa: DespesaParaChecar;
  fornecedor: PrestacaoFornecedor | null;
  documentosDoFornecedor?: readonly Pick<PrestacaoFornecedorDocumento, "tipo" | "created_at">[];
  item: ItemParaChecar | null;
  /** Chaves de acesso das outras despesas da prestação, para achar a repetida. */
  outrasChaves?: readonly string[];
  hoje?: Date;
}): AlertaDespesa[] {
  const { despesa: d, fornecedor: f, item } = p;
  if (!ehDespesa(d.tipo)) return [];
  const alertas: AlertaDespesa[] = [];
  const add = (codigo: AlertaDespesa["codigo"], nivel: AlertaDespesa["nivel"], texto: string) => alertas.push({ codigo, nivel, texto });

  if (d.valor_extraido === null || d.valor_extraido === undefined) {
    add("DESPESA_SEM_VALOR", "alerta", "Informe o valor do documento.");
  } else if (totalRetido(d) > numero(d.valor_extraido)) {
    add("DOC_RETENCOES", "alerta", "As retenções passam do valor do documento.");
  }
  if (!item) add("DESPESA_SEM_ITEM", "alerta", "Ligue a despesa a um item do orçamento.");

  const precisaFornecedor = !SEM_FORNECEDOR.includes(d.tipo);
  if (!f && precisaFornecedor) {
    add("DESPESA_SEM_FORNECEDOR", "alerta", "Ligue a despesa a um fornecedor cadastrado: CNPJ, sanções e CNAE são conferidos por ele.");
  }

  if (f) {
    for (const a of alertasDoFornecedor(f, p.hoje)) {
      if (a.codigo !== "FORNECEDOR_TIPO") alertas.push(a);
    }
    const pj = f.tipo_pessoa === "pj" || f.tipo_pessoa === "mei";

    if (pj && faltaCartaoCnpj(f, p.documentosDoFornecedor ?? [])) {
      add("FORNECEDOR_SEM_CARTAO_CNPJ", "info", "Falta o cartão CNPJ do fornecedor; anexe em Fornecedores.");
    }

    if (pj && d.data_doc) {
      const certidoes = (p.documentosDoFornecedor ?? []).filter(doc => doc.tipo === "certidao_tcu");
      if (!certidoes.length) {
        add("FORNECEDOR_CERTIDAO_DA_DATA", "alerta", "O fornecedor não tem certidão de sanções guardada; consulte em Fornecedores.");
      } else {
        const maisPerto = Math.min(...certidoes.map(c => diasEntre(c.created_at, d.data_doc!)));
        if (maisPerto > DIAS_CERTIDAO_DA_DATA) {
          add("FORNECEDOR_CERTIDAO_DA_DATA", "info", `A certidão de sanções mais próxima é de ${maisPerto} dias da data do documento (${dataBr(d.data_doc)}).`);
        }
      }
    }

    if (pj && item) {
      const doFornecedor = cnaesDoFornecedor(f);
      if (!item.cnaes.length) {
        if (doFornecedor.length) add("FORNECEDOR_CNAE", "info", `O item "${item.nome}" não define CNAEs aceitos; defina no orçamento para conferir.`);
      } else if (!doFornecedor.length) {
        add("FORNECEDOR_CNAE", "info", "Consulte o fornecedor na Receita para conferir o CNAE com o item.");
      } else if (!cnaesCompativeis(item.cnaes, doFornecedor).length) {
        const deOnde = item.origem && item.origem.nome !== item.nome ? ` (definidos em "${item.origem.nome}")` : "";
        add("FORNECEDOR_CNAE", "alerta",
          `Nenhum CNAE do fornecedor (${listaCnaes(doFornecedor.slice(0, 3))}${doFornecedor.length > 3 ? ` e mais ${doFornecedor.length - 3}` : ""}) está entre os aceitos pelo item "${item.nome}": ${listaCnaes(item.cnaes)}${deOnde}.`);
      }
    }

    if (pj && (d.tipo === "recibo" || d.tipo === "fatura")) {
      add("DOC_PJ_SEM_NF", "alerta", "Fornecedor com CNPJ e despesa sem nota fiscal: anexe a dispensa legal ou troque pela nota.");
    }
    if (f.tipo_pessoa === "pf" && d.tipo === "rpa" && numero(d.inss) === 0) {
      add("DOC_RETENCOES", "alerta", "RPA sem INSS retido do autônomo (11%, até o teto).");
    }
    if (f.tipo_pessoa === "pj" && d.tipo === "nfse" && totalRetido(d) === 0) {
      add("DOC_RETENCOES", "info", "Serviço sem ISS, INSS ou IRRF retidos: confira se o fornecedor é do Simples ou se a retenção não se aplica.");
    }
  }

  const chave = limparChave(d.chave_acesso);
  const lida = lerChaveAcesso(chave);
  if (lida && !lida.ok) {
    add("DOC_CHAVE_INVALIDA", "alerta", lida.motivo);
  } else if (lida?.ok) {
    const documento = f ? limparDocumento(f.documento) : "";
    if (documento && lida.emitente.replace(/^0+/, "") !== documento.replace(/^0+/, "")) {
      add("DOC_CHAVE_INVALIDA", "alerta", "A chave de acesso é de outro emitente, não do fornecedor ligado.");
    }
    if (d.data_doc && d.data_doc.slice(0, 7) !== lida.anoMes) {
      add("DOC_CHAVE_INVALIDA", "info", `A chave indica emissão em ${mesBr(lida.anoMes)}, e a data do documento é ${dataBr(d.data_doc)}.`);
    }
    const informado = (d.numero_documento ?? "").replace(/\D/g, "").replace(/^0+/, "");
    if (informado && informado !== lida.numero.replace(/^0+/, "")) {
      add("DOC_CHAVE_INVALIDA", "info", `O número na chave é ${lida.numero.replace(/^0+/, "")}, e o informado é ${informado}.`);
    }
    if (p.outrasChaves?.some(c => limparChave(c) === chave)) {
      add("NFE_CHAVE_REPETIDA", "alerta", "Esta chave de acesso já está em outra despesa da prestação.");
    }
  } else if ((d.tipo === "nfe" || d.tipo === "cupom") && f && f.tipo_pessoa !== "pf") {
    add("DOC_CHAVE_INVALIDA", "info", "Informe a chave de acesso (44 posições) para conferir emitente, data e número.");
  }

  if (d.identificacao_projeto === "ausente") {
    add("DOC_IDENTIFICACAO_PROJETO", "info", "O documento não identifica o projeto; LIE, ANCINE e saúde exigem (no documento ou por declaração).");
  }
  return alertas;
}

/** Alerta (não info) sem justificativa escrita: a despesa ainda não está pronta para revisão. */
export function faltaJustificativa(alertas: readonly AlertaDespesa[], justificativa: string | null | undefined): boolean {
  return alertas.some(a => a.nivel === "alerta") && !(justificativa ?? "").trim();
}
