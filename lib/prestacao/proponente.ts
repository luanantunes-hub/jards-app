// Espaço do proponente (P5.4): o cliente da consultoria acompanha as próprias
// prestações e envia despesas e evidências, que a equipe confere. Aqui ficam
// os tipos de documento oferecidos, a conferência dos formulários, a situação
// de cada envio e o resumo da prestação. Sem React e sem Supabase.

import { lerValorBRL } from "@/lib/valor";

export type MinhaPrestacao = {
  id: string;
  titulo: string;
  status: string;
  organizacao: string | null;
  proponente: string | null;
  regime: string | null;
  identificador_oficial: string | null;
  prazo: string | null;
  despesas: number;
  em_analise: number;
  recusadas: number;
  evidencias: number;
};

export type PrestacaoDoProponente = {
  id: string;
  titulo: string;
  status: string;
  identificador_oficial: string | null;
  regime: string | null;
  organizacao: { nome: string | null; avatar_url: string | null } | null;
  organization_id: string;
  proponente: string | null;
  responsavel: string | null;
  prazo: string | null;
  data_inicio_execucao: string | null;
  data_fim_execucao: string | null;
  data_envio: string | null;
};

/** Os documentos que o proponente costuma ter em mãos, na ordem do formulário. */
export const DOCUMENTOS_DO_PROPONENTE = [
  { id: "nfse", rotulo: "Nota fiscal de serviço (NFS-e)" },
  { id: "nfe", rotulo: "Nota fiscal de produto (NF-e)" },
  { id: "cupom", rotulo: "Cupom fiscal" },
  { id: "recibo", rotulo: "Recibo" },
  { id: "rpa", rotulo: "RPA (autônomo)" },
  { id: "fatura", rotulo: "Fatura" },
  { id: "invoice", rotulo: "Invoice (exterior)" },
  { id: "guia_tributo", rotulo: "Guia de tributo" },
  { id: "contrato", rotulo: "Contrato" },
  { id: "outro", rotulo: "Outro" },
] as const;
export type DocumentoDoProponente = (typeof DOCUMENTOS_DO_PROPONENTE)[number]["id"];

export const rotuloDoDocumento = (tipo: string) =>
  DOCUMENTOS_DO_PROPONENTE.find(d => d.id === tipo)?.rotulo ?? "Documento";

/** Tipos de evidência que o proponente envia. */
export const EVIDENCIAS_DO_PROPONENTE = [
  { id: "foto", rotulo: "Foto" },
  { id: "video", rotulo: "Vídeo" },
  { id: "lista_presenca", rotulo: "Lista de presença" },
  { id: "clipping", rotulo: "Clipping ou matéria" },
  { id: "declaracao", rotulo: "Declaração" },
  { id: "link", rotulo: "Link" },
  { id: "outro", rotulo: "Outro" },
] as const;

const TAMANHO_MAXIMO = 15 * 1024 * 1024;

export type FormularioDaDespesa = {
  arquivo: { name: string; size: number } | null;
  tipo: string;
  valor: string;
  data: string;
  descricao: string;
  numero: string;
};

/** O que o formulário da despesa confere antes de subir o arquivo (o banco confere de novo). */
export function erroDaDespesa(f: FormularioDaDespesa, hoje: string): string | null {
  if (!f.arquivo) return "Escolha o arquivo do documento.";
  if (f.arquivo.size > TAMANHO_MAXIMO) return "O arquivo tem até 15 MB.";
  if (!DOCUMENTOS_DO_PROPONENTE.some(d => d.id === f.tipo)) return "Escolha o tipo de documento.";
  const { valor, valido } = lerValorBRL(f.valor);
  if (!valido || valor === null || valor <= 0) return "Informe o valor do documento, como 1.500,00.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) return "Informe a data do documento.";
  if (f.data > hoje) return "A data do documento não pode ser futura.";
  const descricao = f.descricao.trim();
  if (descricao.length < 2) return "Diga o que foi pago.";
  if (descricao.length > 500) return "A descrição tem até 500 caracteres.";
  if (f.numero.trim().length > 60) return "O número tem até 60 caracteres.";
  return null;
}

export type FormularioDaEvidencia = {
  tipo: string;
  arquivo: { name: string; size: number } | null;
  url: string;
  descricao: string;
};

export function erroDaEvidencia(f: FormularioDaEvidencia): string | null {
  if (!EVIDENCIAS_DO_PROPONENTE.some(e => e.id === f.tipo)) return "Escolha o tipo de evidência.";
  if (f.tipo === "link") {
    if (!/^https?:\/\/\S+\.\S+/i.test(f.url.trim())) return "Informe o endereço, começando por https://.";
  } else {
    if (!f.arquivo) return "Escolha o arquivo.";
    if (f.arquivo.size > TAMANHO_MAXIMO) return "O arquivo tem até 15 MB.";
  }
  const descricao = f.descricao.trim();
  if (descricao.length < 2) return "Diga o que a evidência mostra.";
  if (descricao.length > 1000) return "A descrição tem até 1.000 caracteres.";
  return null;
}

// ─── Situação do que foi enviado ────────────────────────────────────────────

export type SituacaoDaDespesa = { rotulo: string; cor: string; explicacao: string };

export function situacaoDaDespesa(status: string): SituacaoDaDespesa {
  if (status === "aceito") return { rotulo: "Aceita", cor: "#2E8932", explicacao: "Conferida pela equipe." };
  if (status === "rejeitado") return { rotulo: "Recusada", cor: "#B23B3B", explicacao: "A equipe recusou este documento. Veja o motivo e envie de novo, se for o caso." };
  return { rotulo: "Em análise", cor: "#B07A14", explicacao: "A equipe ainda vai conferir." };
}

/** Quanto foi enviado e como está: o que aparece no topo da prestação. */
export function resumoDasDespesas(despesas: readonly { status: string; valor_extraido: number | string | null }[]) {
  const soma = (filtro: (d: { status: string }) => boolean) =>
    despesas.filter(filtro).reduce((total, d) => total + (Number(d.valor_extraido) || 0), 0);
  return {
    total: despesas.length,
    aceitas: despesas.filter(d => d.status === "aceito").length,
    emAnalise: despesas.filter(d => d.status === "pendente").length,
    recusadas: despesas.filter(d => d.status === "rejeitado").length,
    valorAceito: Math.round(soma(d => d.status === "aceito") * 100) / 100,
    valorEmAnalise: Math.round(soma(d => d.status === "pendente") * 100) / 100,
  };
}

/** O que o proponente pode retirar: só o que ele mesmo enviou e ainda está em análise. */
export const podeRetirar = (d: { canal?: string | null; status: string; enviado_por: string | null }, usuarioId: string | null) =>
  d.canal === "proponente" && d.status === "pendente" && Boolean(usuarioId) && d.enviado_por === usuarioId;

/** Dias até o prazo, com o texto do topo; null sem prazo. */
export function textoDoPrazo(prazo: string | null, hoje: string): { texto: string; atrasado: boolean } | null {
  if (!prazo) return null;
  const dias = Math.round((Date.parse(`${prazo.slice(0, 10)}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
  const data = prazo.slice(0, 10).split("-").reverse().join("/");
  if (dias < 0) return { texto: `Prazo venceu em ${data}`, atrasado: true };
  if (dias === 0) return { texto: `Prazo vence hoje (${data})`, atrasado: false };
  return { texto: `Prazo em ${data}, daqui a ${dias} ${dias === 1 ? "dia" : "dias"}`, atrasado: false };
}

/** A situação da prestação dita para o cliente. */
export const SITUACAO_DA_PRESTACAO: Record<string, { rotulo: string; cor: string }> = {
  rascunho: { rotulo: "Em preparação", cor: "#6B6B6B" },
  revisao_interna: { rotulo: "Em revisão pela equipe", cor: "#2D72B0" },
  enviado: { rotulo: "Enviada ao órgão", cor: "#B07A14" },
  ajuste_solicitado: { rotulo: "Em ajuste", cor: "#B23B3B" },
  aprovado: { rotulo: "Aprovada", cor: "#2E8932" },
  arquivado: { rotulo: "Arquivada", cor: "#6B6B6B" },
};

export const situacaoDaPrestacao = (status: string) => SITUACAO_DA_PRESTACAO[status] ?? { rotulo: status, cor: "#6B6B6B" };
