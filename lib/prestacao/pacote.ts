// Pacote e pré-pacote do envio (P4.5).
//
// O pacote junta num arquivo os documentos do checklist, os comprovantes das
// despesas, os comprovantes das devoluções e, quando o regime pede, os
// extratos, renomeados no padrão do sistema de destino:
// - Salic (Rouanet): na ordem do espelho, `comprovantes/001_fornecedor_numero.pdf`;
// - STR (ANCINE): pela linha da Relação de Pagamentos, a primeira é a 12,
//   `documentos-fiscais/00012_P.pdf` (uma linha por pagamento; o documento se
//   repete em cada linha que paga);
// - demais: por data, `comprovantes/001_2026-08-10_fornecedor_numero.pdf`.
// Contrato, foto e outros comprovantes que não são documento fiscal vão para
// `outros/`, por data.
// A regra de arquivo do regime (PDF e limite em MB) é conferida antes de
// gerar. O manifesto lista cada arquivo com a origem, o tamanho e o SHA-256.
// O pré-pacote sai a qualquer momento, com o que falta; o pacote, só sem
// obrigatório pendente e sem arquivo fora da regra. Sem React e sem Supabase.

import { ehDespesa } from "./despesas";
import { espelhoDoSalic } from "./espelho-salic";
import type { ArquivoDoChecklist, ChecklistDeEnvio, EtapaEnvio } from "./envio";
import { ROTULO_DA_ETAPA } from "./envio";
import type { EstadoDaPrestacao } from "./checagens/catalogo";
import { rotuloDoMotivo } from "./devolucoes";
import { definida, type Fonte, type RegimeNormativo } from "./regimes";
import type { PrestacaoComprovante, PrestacaoDevolucao, PrestacaoExtratoImportacao } from "@/lib/supabase/types";

export type TipoDoPacote = "pacote" | "pre-pacote";
export type PadraoDosNomes = "salic" | "str" | "geral";

export type ArquivoDaDespesa = Pick<PrestacaoComprovante, "id" | "storage_path" | "nome_arquivo">;
export type DevolucaoDoPacote = Pick<PrestacaoDevolucao, "id" | "motivo" | "situacao" | "storage_path" | "nome_arquivo" | "mime_type" | "valor_principal" | "valor_atualizado" | "valor_pago">;
export type ExtratoDoPacote = Pick<PrestacaoExtratoImportacao, "id" | "conta_id" | "nome_arquivo" | "storage_path" | "periodo_inicio" | "periodo_fim"> & { conta: string };
/** Tamanho e tipo do arquivo guardado, pela listagem do armazenamento. */
export type MetadadosDoArquivo = { tamanho: number | null; mime: string | null };

export type DadosDoPacote = {
  regime: RegimeNormativo | null;
  etapa: EtapaEnvio;
  checklist: ChecklistDeEnvio;
  estado: EstadoDaPrestacao;
  prestacao: { titulo: string; identificador_oficial: string | null };
  arquivosDasDespesas: readonly ArquivoDaDespesa[];
  arquivosDoEnvio: readonly ArquivoDoChecklist[];
  devolucoes: readonly DevolucaoDoPacote[];
  extratos: readonly ExtratoDoPacote[];
  /** Por caminho no armazenamento; sem entrada, o arquivo não foi achado. */
  metadados: ReadonlyMap<string, MetadadosDoArquivo>;
};

export type VinculoDoItem =
  | { tipo: "documento"; id: string; codigo: string }
  | { tipo: "despesa"; id: string; pagamentoId: string | null; linha: number | null }
  | { tipo: "devolucao"; id: string }
  | { tipo: "extrato"; id: string };

export type ItemDoPacote = {
  /** Caminho dentro do pacote. */
  caminho: string;
  /** De onde vem, para o manifesto. */
  origem: string;
  storagePath: string;
  nomeOriginal: string | null;
  tamanho: number | null;
  /** Fora da regra do regime ou não achado: aparece antes de gerar. */
  problemas: string[];
  vinculo: VinculoDoItem;
};

export type RegraDeArquivo = { mb: number; descricao: string; fonte: Fonte };

export type PlanoDoPacote = {
  padrao: PadraoDosNomes;
  regra: RegraDeArquivo | null;
  itens: ItemDoPacote[];
  /** Arquivos distintos a baixar (o mesmo documento pode ir em mais de uma linha). */
  aBaixar: number;
  tamanhoTotal: number;
  comProblema: number;
  /** O que o checklist ainda pede, com o obrigatório primeiro. */
  faltas: { texto: string; obrigatorio: boolean }[];
  podeGerarPacote: boolean;
  /** Por que o pacote ainda não sai (o pré-pacote sai sempre). */
  motivo: string | null;
};

const MB = 1024 * 1024;
const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const reais = (v: unknown) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const zeros = (n: number, casas: number) => String(n).padStart(casas, "0");

/** Texto para nome de arquivo: sem acento, minúsculo, só letras, algarismos e hífen; corta entre palavras. */
export function slug(texto: string | null | undefined, max = 40): string {
  const limpo = String(texto ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, max + 1).lastIndexOf("-");
  return (corte >= max / 2 ? limpo.slice(0, corte) : limpo.slice(0, max)).replace(/-+$/, "");
}

/** Rótulo dos comprovantes que não são documento fiscal, para o manifesto. */
const ROTULO_COMPLEMENTAR: Record<string, string> = {
  contrato: "Contrato", extrato: "Extrato", cartao_embarque: "Cartão de embarque", print_screenshot: "Captura de tela",
  foto: "Foto", planilha: "Planilha", outro: "Documento",
};

/** Extensão do nome original, em minúsculas; "pdf" quando não há. */
export function extensao(nome: string | null | undefined, mime?: string | null): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(nome ?? "");
  if (m) return m[1].toLowerCase();
  if (mime === "application/pdf") return "pdf";
  const tipo = /^image\/(png|jpe?g|webp|gif)$/.exec(mime ?? "");
  return tipo ? tipo[1].replace("jpeg", "jpg") : "pdf";
}

const ehPdf = (nome: string | null, mime: string | null) => mime === "application/pdf" || /\.pdf$/i.test(nome ?? "");

/** Regras do envio e do documento fiscal, onde o regime diz como mandar os arquivos. */
function regrasDeArquivo(regime: RegimeNormativo | null | undefined) {
  if (!regime) return [];
  const pagamentos = definida(regime.pagamentos);
  return [...(definida(regime.envio)?.regras ?? []), ...(pagamentos?.documentoFiscal ?? []), ...(pagamentos?.regras ?? [])];
}

/** A regra de arquivo do regime: a primeira com limite em MB (Rouanet, PDF até 5 MB; ANCINE, 15 MB por documento). */
export function regraDeArquivo(regime: RegimeNormativo | null | undefined): RegraDeArquivo | null {
  const regra = regrasDeArquivo(regime).find(r => Number(r.parametros?.mb) > 0);
  return regra ? { mb: Number(regra.parametros!.mb), descricao: regra.descricao, fonte: regra.fonte } : null;
}

/** O padrão dos nomes: o do STR quando o regime pede arquivo por linha da RP; o do Salic; ou o geral. */
export function padraoDosNomes(regime: RegimeNormativo | null | undefined): PadraoDosNomes {
  if (regrasDeArquivo(regime).some(r => r.codigo === "arquivo_por_documento")) return "str";
  if (regime?.sistemaOficial === "Salic") return "salic";
  return "geral";
}

/** Nome do arquivo do pacote. */
export function nomeDoPacote(tipo: TipoDoPacote, prestacao: DadosDoPacote["prestacao"], etapa: EtapaEnvio, quando: Date, exercicio = 0): string {
  const id = slug(prestacao.identificador_oficial || prestacao.titulo, 40) || "prestacao";
  const p = (n: number) => zeros(n, 2);
  const carimbo = `${quando.getFullYear()}${p(quando.getMonth() + 1)}${p(quando.getDate())}-${p(quando.getHours())}${p(quando.getMinutes())}`;
  return `${tipo}-${id}-${etapa}${exercicio ? `-${exercicio}` : ""}-${carimbo}.zip`;
}

export function planoDoPacote(dados: DadosDoPacote): PlanoDoPacote {
  const { checklist, estado, metadados } = dados;
  const regra = regraDeArquivo(dados.regime);
  const padrao = padraoDosNomes(dados.regime);
  const itens: ItemDoPacote[] = [];

  const problemasDe = (storagePath: string, nome: string | null, mimeGuardado: string | null): { tamanho: number | null; problemas: string[] } => {
    const meta = metadados.get(storagePath);
    if (!meta) return { tamanho: null, problemas: ["Não foi achado no armazenamento."] };
    const problemas: string[] = [];
    if (regra && !ehPdf(nome, mimeGuardado ?? meta.mime)) problemas.push("Não está em PDF.");
    if (regra && meta.tamanho !== null && meta.tamanho > regra.mb * MB) {
      problemas.push(`Tem ${(meta.tamanho / MB).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB; o limite é ${regra.mb} MB.`);
    }
    return { tamanho: meta.tamanho, problemas };
  };

  // Documentos do checklist, na ordem do regime.
  checklist.documentos.forEach((doc, i) => {
    const arquivos = dados.arquivosDoEnvio.filter(a => a.etapa === dados.etapa && (a.exercicio ?? 0) === dados.checklist.exercicio && a.codigo === doc.codigo);
    arquivos.forEach((a, j) => {
      const sufixo = arquivos.length > 1 ? `_${zeros(j + 1, 2)}` : "";
      const { tamanho, problemas } = problemasDe(a.storage_path, a.nome_arquivo, a.mime_type);
      itens.push({
        caminho: `documentos/${zeros(i + 1, 2)}_${slug(doc.codigo, 30)}${sufixo}.${extensao(a.nome_arquivo, a.mime_type)}`,
        origem: `Checklist: ${doc.descricao}${a.nome_arquivo ? ` (${a.nome_arquivo})` : ""}`,
        storagePath: a.storage_path, nomeOriginal: a.nome_arquivo, tamanho, problemas,
        vinculo: { tipo: "documento", id: a.id, codigo: doc.codigo },
      });
    });
  });

  // Comprovantes das despesas: os fiscais no padrão do destino; contrato, foto e outros em "outros".
  const aceitos = estado.despesas.filter(d => d.status !== "rejeitado");
  const validas = aceitos.filter(d => ehDespesa(d.tipo));
  const arquivoDe = new Map(dados.arquivosDasDespesas.map(a => [a.id, a]));
  const fornecedorDe = new Map(estado.fornecedores.map(f => [f.id, f.nome_fantasia || f.razao_social || f.nome || null]));
  const despesaPorId = new Map(aceitos.map(d => [d.id, d]));
  const descreverDespesa = (id: string) => {
    const d = despesaPorId.get(id)!;
    const fornecedor = d.fornecedor_id ? fornecedorDe.get(d.fornecedor_id) : null;
    return `${ehDespesa(d.tipo) ? "Despesa" : ROTULO_COMPLEMENTAR[d.tipo] ?? "Documento"}: ${[fornecedor, d.numero_documento ? `nº ${d.numero_documento}` : null, dataBr(d.data_doc) || null, d.valor_extraido !== null && d.valor_extraido !== undefined ? reais(d.valor_extraido) : null].filter(Boolean).join(", ") || arquivoDe.get(id)?.nome_arquivo || "sem dados"}`;
  };
  const itemDaDespesa = (id: string, caminho: string, origemExtra: string, vinculo: VinculoDoItem) => {
    const a = arquivoDe.get(id);
    if (!a?.storage_path) return;
    const { tamanho, problemas } = problemasDe(a.storage_path, a.nome_arquivo, null);
    itens.push({ caminho, origem: descreverDespesa(id) + origemExtra, storagePath: a.storage_path, nomeOriginal: a.nome_arquivo, tamanho, problemas, vinculo });
  };
  const partesDoNome = (id: string) => {
    const d = despesaPorId.get(id)!;
    return [slug(d.fornecedor_id ? fornecedorDe.get(d.fornecedor_id) : null, 30), slug(d.numero_documento, 20)].filter(Boolean).join("_");
  };

  if (padrao === "str") {
    // Uma linha da RP por pagamento, na ordem da data; despesa sem pagamento ocupa uma linha.
    const pagamentos = estado.pagamentos.filter(p => despesaPorId.has(p.despesa_id))
      .slice().sort((a, b) => a.data.localeCompare(b.data) || a.despesa_id.localeCompare(b.despesa_id) || (a.id ?? "").localeCompare(b.id ?? ""));
    const pagas = new Set(pagamentos.map(p => p.despesa_id));
    const semPagamento = validas.filter(d => !pagas.has(d.id))
      .sort((a, b) => (a.data_doc ?? "9999").localeCompare(b.data_doc ?? "9999") || a.id.localeCompare(b.id));
    const linhas = [
      ...pagamentos.map(p => ({ despesaId: p.despesa_id, pagamentoId: p.id ?? null, extra: ` · pagamento de ${dataBr(p.data)}, ${reais(p.valor)}` })),
      ...semPagamento.map(d => ({ despesaId: d.id, pagamentoId: null, extra: " · sem pagamento" })),
    ];
    linhas.forEach((l, i) => {
      const linha = 12 + i;
      const a = arquivoDe.get(l.despesaId);
      itemDaDespesa(l.despesaId, `documentos-fiscais/${zeros(linha, 5)}_P.${extensao(a?.nome_arquivo)}`, ` · linha ${linha} da RP${l.extra}`,
        { tipo: "despesa", id: l.despesaId, pagamentoId: l.pagamentoId, linha });
    });
  } else {
    let ordem: string[];
    if (padrao === "salic") {
      const espelho = espelhoDoSalic(estado);
      ordem = [...new Set(espelho.grupos.flatMap(g => g.linhas.map(l => l.despesaId)))].filter(id => despesaPorId.has(id));
      for (const d of validas) if (!ordem.includes(d.id)) ordem.push(d.id);
    } else {
      ordem = validas.slice().sort((a, b) => (a.data_doc ?? "9999").localeCompare(b.data_doc ?? "9999") || a.id.localeCompare(b.id)).map(d => d.id);
    }
    ordem.forEach((id, i) => {
      const d = despesaPorId.get(id)!;
      const a = arquivoDe.get(id);
      const meio = padrao === "geral" ? [d.data_doc?.slice(0, 10), partesDoNome(id)].filter(Boolean).join("_") : partesDoNome(id);
      itemDaDespesa(id, `comprovantes/${zeros(i + 1, 3)}${meio ? `_${meio}` : ""}.${extensao(a?.nome_arquivo)}`, padrao === "salic" ? ` · ${i + 1}ª do espelho do Salic` : "",
        { tipo: "despesa", id, pagamentoId: null, linha: null });
    });
  }

  aceitos.filter(d => !ehDespesa(d.tipo))
    .sort((a, b) => (a.data_doc ?? "9999").localeCompare(b.data_doc ?? "9999") || a.id.localeCompare(b.id))
    .forEach((d, i) => {
      const a = arquivoDe.get(d.id);
      const meio = [slug(d.tipo, 20), partesDoNome(d.id)].filter(Boolean).join("_");
      itemDaDespesa(d.id, `outros/${zeros(i + 1, 3)}_${meio}.${extensao(a?.nome_arquivo)}`, "", { tipo: "despesa", id: d.id, pagamentoId: null, linha: null });
    });

  // Comprovantes das devoluções pagas.
  dados.devolucoes.filter(d => d.storage_path).forEach((d, i) => {
    const { tamanho, problemas } = problemasDe(d.storage_path!, d.nome_arquivo, d.mime_type);
    itens.push({
      caminho: `devolucoes/${zeros(i + 1, 2)}_gru-${slug(d.motivo, 20)}.${extensao(d.nome_arquivo, d.mime_type)}`,
      origem: `Devolução: ${rotuloDoMotivo(d.motivo)}${d.nome_arquivo ? ` (${d.nome_arquivo})` : ""}`,
      storagePath: d.storage_path!, nomeOriginal: d.nome_arquivo, tamanho, problemas,
      vinculo: { tipo: "devolucao", id: d.id },
    });
  });

  // Extratos guardados, quando o checklist da etapa pede extrato.
  if (checklist.documentos.some(doc => doc.codigo === "extratos" || doc.codigo === "extrato")) {
    dados.extratos.filter(e => e.storage_path).forEach(e => {
      const { tamanho, problemas } = problemasDe(e.storage_path!, e.nome_arquivo, null);
      if (problemas.includes("Não está em PDF.")) problemas.splice(problemas.indexOf("Não está em PDF."), 1, "Não está em PDF: baixe o extrato em PDF no banco e anexe no checklist.");
      itens.push({
        caminho: `extratos/${[slug(e.conta, 30), e.periodo_inicio, e.periodo_fim].filter(Boolean).join("_")}.${extensao(e.nome_arquivo)}`,
        origem: `Extrato: ${e.conta}${e.periodo_inicio || e.periodo_fim ? `, ${dataBr(e.periodo_inicio)} a ${dataBr(e.periodo_fim)}` : ""}${e.nome_arquivo ? ` (${e.nome_arquivo})` : ""}`,
        storagePath: e.storage_path!, nomeOriginal: e.nome_arquivo, tamanho, problemas,
        vinculo: { tipo: "extrato", id: e.id },
      });
    });
  }

  // Nomes repetidos (dois extratos do mesmo período, por exemplo) ganham sufixo.
  const usados = new Map<string, number>();
  for (const item of itens) {
    const n = usados.get(item.caminho) ?? 0;
    usados.set(item.caminho, n + 1);
    if (n > 0) item.caminho = item.caminho.replace(/(\.[a-z0-9]+)$/, `_${n + 1}$1`);
  }

  const pendentes = [...checklist.documentos, ...checklist.condicoes].filter(l => l.situacao === "pendente");
  const faltas = [
    ...pendentes.filter(l => l.obrigatorio).map(l => ({ texto: `${l.descricao.replace(/\.$/, "")}: ${l.detalhe}`, obrigatorio: true })),
    ...pendentes.filter(l => !l.obrigatorio).map(l => ({ texto: `${l.descricao.replace(/\.$/, "")}: ${l.detalhe}`, obrigatorio: false })),
  ];
  const comProblema = itens.filter(i => i.problemas.length > 0).length;
  const distintos = new Map(itens.map(i => [i.storagePath, i.tamanho ?? 0]));
  const motivo = checklist.semChecklist
    ? checklist.semChecklist
    : checklist.resumo.obrigatoriosPendentes > 0
      ? `${plural(checklist.resumo.obrigatoriosPendentes, "item obrigatório do checklist está pendente", "itens obrigatórios do checklist estão pendentes")}.`
      : comProblema > 0
        ? `${plural(comProblema, "arquivo está fora da regra", "arquivos estão fora da regra")} do regime.`
        : itens.length === 0 ? "Nenhum arquivo para o pacote ainda." : null;

  return {
    padrao,
    regra,
    itens,
    aBaixar: distintos.size,
    tamanhoTotal: itens.reduce((s, i) => s + (i.tamanho ?? 0), 0),
    comProblema,
    faltas,
    podeGerarPacote: motivo === null,
    motivo,
  };
}

// ─── Manifesto ──────────────────────────────────────────────────────────────

export type LinhaDoManifesto = { arquivo: string; origem: string; tamanho: number; sha256: string; observacao: string };

export type Manifesto = {
  tipo: TipoDoPacote;
  geradoEm: string;
  prestacao: { titulo: string; identificadorOficial: string | null };
  regime: { codigo: string; versao: number; sistema: string | null } | null;
  etapa: EtapaEnvio;
  /** P9.2: o ano da prestação anual, quando há. */
  exercicio?: number | null;
  padrao: PadraoDosNomes;
  /** storagePath: o arquivo guardado de onde veio (o relatório é gerado, não guardado). */
  arquivos: (LinhaDoManifesto & { vinculo: VinculoDoItem | null; storagePath: string | null })[];
  faltas: string[];
};

const celula = (v: string | number) => {
  const s = String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** O manifesto em CSV (separado por ponto e vírgula, como o Excel em português abre). */
export function manifestoCsv(linhas: readonly LinhaDoManifesto[]): string {
  const cabecalho = ["arquivo", "origem", "tamanho_bytes", "sha256", "observacao"];
  return [cabecalho, ...linhas.map(l => [l.arquivo, l.origem, l.tamanho, l.sha256, l.observacao])]
    .map(c => c.map(celula).join(";")).join("\r\n") + "\r\n";
}

/** O que falta, em texto simples, para o pré-pacote. */
export function textoDasFaltas(plano: PlanoDoPacote, etapa: EtapaEnvio, exercicio = 0): string {
  const rotulo = etapa === "parcial" && exercicio ? `prestação anual de ${exercicio}` : ROTULO_DA_ETAPA[etapa].toLowerCase();
  const linhas = [`O que falta para a ${rotulo}`, ""];
  if (!plano.faltas.length && !plano.comProblema) linhas.push("Nada: o checklist está completo e os arquivos estão na regra.");
  for (const f of plano.faltas) linhas.push(`- ${f.obrigatorio ? "[obrigatório] " : ""}${f.texto}`);
  const comProblema = plano.itens.filter(i => i.problemas.length);
  if (comProblema.length) {
    linhas.push("", "Arquivos fora da regra do regime" + (plano.regra ? ` (${plano.regra.descricao})` : ""), "");
    for (const i of comProblema) linhas.push(`- ${i.caminho}: ${i.problemas.join(" ")} (${i.origem})`);
  }
  return linhas.join("\r\n") + "\r\n";
}

/** SHA-256 em hexadecimal, pela Web Crypto (navegador e Node). */
export async function sha256(dados: Uint8Array): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", dados as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}
