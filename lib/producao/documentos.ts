// A pasta de documentos com validade (plano do módulo, PD4.8, primeiro corte): o contrato social, as certidões e a carta de exclusividade da organização, e a
// CNH, o passaporte e a identidade de uma pessoa da equipe. Guarda só o que serve para avisar: tipo, de quem é, título, emissão e validade. Sem número de
// documento e sem arquivo. Sem tela e sem banco.

import type { EscopoDoDocumento, TipoDeDocumento } from "@/lib/producao/estados";
import type { AvisoDeHoje } from "@/lib/producao/hoje";

export const ROTULO_DO_TIPO_DE_DOCUMENTO: Record<TipoDeDocumento, string> = {
  contrato_social: "Contrato social", certidao_negativa: "Certidão negativa", carta_exclusividade: "Carta de exclusividade",
  cnh: "CNH", passaporte: "Passaporte", identidade: "Identidade", outro: "Outro",
};

/** Os tipos que cada escopo aceita (o banco confere): "outro" vale nos dois. */
export const TIPOS_POR_ESCOPO: Record<EscopoDoDocumento, readonly TipoDeDocumento[]> = {
  organizacao: ["contrato_social", "certidao_negativa", "carta_exclusividade", "outro"],
  pessoa: ["cnh", "passaporte", "identidade", "outro"],
};

/** Quantos dias antes de vencer o Hoje começa a avisar. */
export const DIAS_DE_ANTECEDENCIA_DO_DOCUMENTO = 30;

export type DocumentoDaPasta = {
  id: string; escopo: EscopoDoDocumento; pessoa_id: string | null; tipo: TipoDeDocumento; titulo: string;
  emitido_em: string | null; validade: string | null; notas: string | null;
};

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);
const dataValida = (texto: string) => /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(`${texto}T00:00:00Z`));
const dia = (data: string) => data.split("-").reverse().join("/");

export type SituacaoDaValidade = { estado: "sem_validade" | "vencido" | "vence_em_breve" | "em_dia"; dias: number | null };

/** Onde a validade está: sem validade, vencida (dias negativos), a vencer nos próximos 30 dias ou em dia. Vence hoje conta como a vencer, com zero dias. */
export function situacaoDaValidade(validade: string | null, hoje: string): SituacaoDaValidade {
  if (!validade) return { estado: "sem_validade", dias: null };
  const dias = diasEntre(hoje, validade);
  if (dias < 0) return { estado: "vencido", dias };
  return { estado: dias <= DIAS_DE_ANTECEDENCIA_DO_DOCUMENTO ? "vence_em_breve" : "em_dia", dias };
}

/** A validade em palavras: "Venceu em 10/11/2026 (há 5 dias)", "Vence hoje", "Vence em 12 dias (27/11/2026)", "Válido até 10/03/2027" ou "Sem validade". */
export function textoDaValidade(validade: string | null, hoje: string): string {
  const { estado, dias } = situacaoDaValidade(validade, hoje);
  if (estado === "sem_validade" || validade === null || dias === null) return "Sem validade";
  if (estado === "vencido") return `Venceu em ${dia(validade)} (há ${-dias} ${-dias === 1 ? "dia" : "dias"})`;
  if (dias === 0) return "Vence hoje";
  if (estado === "vence_em_breve") return `Vence em ${dias} ${dias === 1 ? "dia" : "dias"} (${dia(validade)})`;
  return `Válido até ${dia(validade)}`;
}

/** Documento com algum número grande escrito no título ou na nota (CPF, RG, CNH, passaporte): a tela recusa, porque a pasta não guarda número de documento. */
export function temNumeroDeDocumento(texto: string): boolean {
  return /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(texto) || /\d{8,}/.test(texto.replace(/[\s.\-/]/g, ""));
}

export type LeituraDoDocumento =
  | { ok: true; valor: { escopo: EscopoDoDocumento; pessoa_id: string | null; tipo: TipoDeDocumento; titulo: string; emitido_em: string | null; validade: string | null; notas: string | null } }
  | { ok: false; erro: string; campo: string };

/**
 * O documento como o banco confere: título de 1 a 120 letras, tipo que combina com o escopo (CNH, passaporte e identidade só de pessoa; contrato social,
 * certidão e carta só da organização), a pessoa escolhida quando é de pessoa, datas válidas, validade que não vem antes da emissão e nota de até 300. Mais
 * uma regra da tela: nenhum número de documento no título nem na nota.
 */
export function lerDocumento(campos: { escopo: EscopoDoDocumento; pessoaId: string; tipo: TipoDeDocumento; titulo: string; emitidoEm: string; validade: string; notas: string }): LeituraDoDocumento {
  const titulo = campos.titulo.trim();
  if (titulo === "") return { ok: false, erro: "Escreva o nome do documento (por exemplo, Certidão negativa federal).", campo: "titulo" };
  if (titulo.length > 120) return { ok: false, erro: "O nome pode ter até 120 letras.", campo: "titulo" };
  if (!TIPOS_POR_ESCOPO[campos.escopo].includes(campos.tipo)) return { ok: false, erro: "Esse tipo de documento não vale aqui: CNH, passaporte e identidade são de pessoa; contrato social, certidão e carta são da organização.", campo: "tipo" };
  if (campos.escopo === "pessoa" && campos.pessoaId === "") return { ok: false, erro: "Escolha de quem é o documento.", campo: "pessoaId" };
  if (campos.emitidoEm !== "" && !dataValida(campos.emitidoEm)) return { ok: false, erro: "Escolha o dia da emissão.", campo: "emitidoEm" };
  if (campos.validade !== "" && !dataValida(campos.validade)) return { ok: false, erro: "Escolha o dia da validade.", campo: "validade" };
  if (campos.emitidoEm !== "" && campos.validade !== "" && campos.validade < campos.emitidoEm) return { ok: false, erro: "A validade não pode vir antes da emissão.", campo: "validade" };
  const notas = campos.notas.trim();
  if (notas.length > 300) return { ok: false, erro: "A nota pode ter até 300 letras.", campo: "notas" };
  if (temNumeroDeDocumento(titulo) || temNumeroDeDocumento(notas)) return { ok: false, erro: "Não escreva o número do documento (CPF, RG, CNH, passaporte): a pasta só guarda o tipo e a validade.", campo: "titulo" };
  return {
    ok: true,
    valor: {
      escopo: campos.escopo, pessoa_id: campos.escopo === "pessoa" ? campos.pessoaId : null, tipo: campos.tipo, titulo,
      emitido_em: campos.emitidoEm === "" ? null : campos.emitidoEm, validade: campos.validade === "" ? null : campos.validade, notas: notas === "" ? null : notas,
    },
  };
}

/** Os avisos do Hoje: documento vencido e documento que vence nos próximos 30 dias, o que vence primeiro antes. O de uma pessoa leva o nome dela. */
export function avisosDeDocumentosParaHoje(documentos: readonly DocumentoDaPasta[], nomeDaPessoa: (id: string) => string, hoje: string): AvisoDeHoje[] {
  const itens: { validade: string; aviso: AvisoDeHoje }[] = [];
  for (const documento of documentos) {
    const { estado } = situacaoDaValidade(documento.validade, hoje);
    if ((estado !== "vencido" && estado !== "vence_em_breve") || documento.validade === null) continue;
    const de = documento.pessoa_id ? ` de ${nomeDaPessoa(documento.pessoa_id)}` : "";
    itens.push({
      validade: documento.validade,
      aviso: {
        chave: `documento-${documento.id}-${estado}`, rotulo: "Documento", href: "/producoes/documentos",
        texto: `${ROTULO_DO_TIPO_DE_DOCUMENTO[documento.tipo]}${de}${documento.titulo && documento.tipo === "outro" ? ` (${documento.titulo})` : ""}: ${textoDaValidade(documento.validade, hoje).replace(/^V/, "v")}.`,
      },
    });
  }
  return itens.sort((a, b) => a.validade.localeCompare(b.validade)).map(item => item.aviso);
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeDocumento(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("pessoa_de_outra_organizacao")) return "Essa pessoa não é desta organização.";
  if (mensagem.includes("escopo_nao_muda") || mensagem.includes("pessoa_nao_muda")) return "De quem é o documento não muda: apague e crie outro.";
  if (erro.code === "42501") return "Você não pode alterar este documento (os de pessoa pedem a permissão de dinheiro).";
  if (erro.code === "23514") return "Confira o tipo, o nome e as datas do documento.";
  return "Não foi possível salvar. Tente de novo.";
}
