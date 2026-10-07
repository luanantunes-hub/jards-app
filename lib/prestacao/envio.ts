// Checklist de envio (P4.1).
//
// O regime diz o que o envio pede: os documentos de cada etapa (final e, quando
// há, parcial), com os obrigatórios, e as condições do sistema oficial (na
// Rouanet, o que o Salic exige para liberar o botão de envio; na parcial, também
// as regras da prestação parcial). As condições de severidade "info" viram
// orientação, sem marcação.
//
// O que os dados respondem vem deles: metas comprovadas, evidências de
// acessibilidade, peças com amostra, bens, despesas, extratos, saldo pelo último
// extrato, alterações em aberto, as verificações abertas por assunto e as guias
// do saldo e dos rendimentos registradas em Devoluções (P4.4). O resto
// a pessoa resolve: arquivo anexado, "pronto" (ou, na condição, "conferido") e,
// para o que não é obrigatório, "não se aplica" com o motivo. Sem React e sem
// Supabase.

import { CATALOGO_CHECAGENS, dataBr, reais, centavos, type DestinoDaChecagem, type EstadoDaPrestacao } from "./checagens/catalogo";
import { despesasSemBem } from "./bens";
import { recolhimentoDoEncerramento } from "./devolucoes";
import { coberturaDaMeta } from "./objeto";
import { definida, type Fonte, type RegimeNormativo } from "./regimes";
import type { Regra } from "./regimes/tipos";
import type { PrestacaoContaBancaria, PrestacaoDevolucao, PrestacaoEnvioArquivo, PrestacaoEnvioMarcacao, PrestacaoExtratoImportacao } from "@/lib/supabase/types";

export type EtapaEnvio = PrestacaoEnvioMarcacao["etapa"];
export type TipoDoItem = PrestacaoEnvioMarcacao["tipo"];
export type SituacaoDoItem = "pronto" | "pendente" | "nao_se_aplica";
/** A aba onde o item se resolve. */
export type DestinoDoEnvio = DestinoDaChecagem | "pendencias" | "devolucoes";

export const ROTULO_DA_ETAPA: Record<EtapaEnvio, string> = { final: "Prestação final", parcial: "Prestação parcial" };

export type MarcacaoDoChecklist = Pick<PrestacaoEnvioMarcacao, "etapa" | "tipo" | "codigo" | "situacao" | "justificativa" | "marcado_por" | "updated_at">;
export type ArquivoDoChecklist = Pick<PrestacaoEnvioArquivo, "id" | "etapa" | "codigo" | "storage_path" | "nome_arquivo" | "mime_type" | "tamanho_bytes" | "created_at">;
export type DevolucaoDoChecklist = Pick<PrestacaoDevolucao, "motivo" | "situacao" | "valor_principal" | "valor_atualizado" | "valor_pago" | "pago_em" | "storage_path">;
export type ContaDoChecklist = Pick<PrestacaoContaBancaria, "id" | "tipo" | "apelido" | "banco" | "conta" | "data_encerramento"> & {
  extratos: readonly Pick<PrestacaoExtratoImportacao, "periodo_fim" | "saldo_final" | "created_at">[];
};

export type DadosDoChecklist = {
  regime: RegimeNormativo | null;
  etapa: EtapaEnvio;
  estado: EstadoDaPrestacao;
  /** Verificações da prestação; só as abertas pedem algo. */
  verificacoes: readonly { check_codigo: string; status: string }[];
  contas: readonly ContaDoChecklist[];
  marcacoes: readonly MarcacaoDoChecklist[];
  arquivos: readonly ArquivoDoChecklist[];
  /** Devoluções registradas; o recolhimento do encerramento sai delas. */
  devolucoes?: readonly DevolucaoDoChecklist[];
  /** "AAAA-MM-DD"; sem ele, a data do estado. */
  hoje?: string;
};

export type LinhaDoChecklist = {
  tipo: TipoDoItem;
  codigo: string;
  descricao: string;
  /** Documento obrigatório ou condição que bloqueia o envio. */
  obrigatorio: boolean;
  severidade: Regra["severidade"] | null;
  fonte: Fonte;
  /** "dados": o sistema responde; "pessoa": a marcação ou o arquivo. */
  origem: "dados" | "pessoa";
  situacao: SituacaoDoItem;
  /** O porquê da situação, ou o que fazer. */
  detalhe: string;
  destino: DestinoDoEnvio | null;
  marcacao: MarcacaoDoChecklist | null;
  arquivos: ArquivoDoChecklist[];
  /** "Não se aplica" é possível: não obrigatório e marcado pela pessoa. */
  dispensavel: boolean;
  /** Documento aceita arquivo; condição, não. */
  aceitaArquivo: boolean;
};

export type OrientacaoDoEnvio = { codigo: string; descricao: string; fonte: Fonte };

export type ChecklistDeEnvio = {
  etapa: EtapaEnvio;
  /** Etapas que o regime tem (a final sempre; a parcial quando algum documento é dela). */
  etapas: EtapaEnvio[];
  sistema: string | null;
  descricao: string | null;
  fonte: Fonte | null;
  documentos: LinhaDoChecklist[];
  condicoes: LinhaDoChecklist[];
  orientacoes: OrientacaoDoEnvio[];
  resumo: { total: number; resolvidos: number; pendentes: number; obrigatoriosPendentes: number };
  /** Sem regime, ou regime sem a dimensão do envio: o motivo. */
  semChecklist: string | null;
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const hojeDe = (d: Date) => d.toISOString().slice(0, 10);

/** Etapas do envio no regime: a final e, quando algum documento é dela, a parcial. */
export function etapasDoRegime(regime: RegimeNormativo | null | undefined): EtapaEnvio[] {
  const envio = regime ? definida(regime.envio) : null;
  return envio?.documentos.some(d => d.em.includes("parcial")) ? ["final", "parcial"] : ["final"];
}

// ─── O que os dados respondem ───────────────────────────────────────────────

type Resposta = { situacao: SituacaoDoItem; detalhe: string; destino: DestinoDoEnvio | null };
/** null: a pessoa resolve; com `dica`, o texto para orientar a marcação. */
type Avaliador = (ctx: Contexto, item: { obrigatorio: boolean; regra?: Regra }) => Resposta | { dica: string } | null;

type Contexto = DadosDoChecklist & {
  abertas: (filtro: (codigo: string) => boolean) => number;
  hojeIso: string;
  sistema: string;
};

const pronto = (detalhe: string): Resposta => ({ situacao: "pronto", detalhe, destino: null });
const pendente = (detalhe: string, destino: DestinoDoEnvio | null): Resposta => ({ situacao: "pendente", detalhe, destino });

const doCatalogo = (codigo: string) => (CATALOGO_CHECAGENS as Record<string, { grupo: string; destino: DestinoDaChecagem }>)[codigo];
const comDestino = (...destinos: DestinoDaChecagem[]) => (codigo: string) => destinos.includes(doCatalogo(codigo)?.destino);
const doGrupo = (...grupos: string[]) => (codigo: string) => grupos.includes(doCatalogo(codigo)?.grupo);

const despesasValidas = (ctx: Contexto) => ctx.estado.despesas.filter(d => d.status !== "rejeitado");

const objeto: Avaliador = ctx => {
  const metas = ctx.estado.metas ?? [];
  if (metas.length === 0) return pendente("Cadastre as metas do objeto, com o previsto e o resultado de cada uma.", "objeto");
  const atividades = (ctx.estado.atividades ?? []).map(a => ({ id: a.id, meta_id: a.meta_id ?? null, status_realizacao: a.status_realizacao ?? "realizado" as const }));
  const evidencias = ctx.estado.evidencias ?? [];
  const comprovadas = metas.filter(m => coberturaDaMeta(m, atividades, evidencias).comprovada).length;
  const semResultado = metas.filter(m => m.realizado === null || m.realizado === undefined).length;
  const abertas = ctx.abertas(comDestino("objeto", "atividades", "distribuicao"));
  if (semResultado > 0) return pendente(`${plural(semResultado, "meta está", "metas estão")} sem o resultado informado.`, "objeto");
  if (comprovadas < metas.length) return pendente(`${comprovadas} de ${plural(metas.length, "meta comprovada", "metas comprovadas")} por evidência.`, "objeto");
  if (abertas > 0) return pendente(`${plural(abertas, "pendência aberta", "pendências abertas")} no objeto e na distribuição.`, "objeto");
  return pronto(`${plural(metas.length, "meta", "metas")} com resultado e evidência, sem pendência aberta.`);
};

const acessibilidade: Avaliador = ctx => {
  const evidencias = ctx.estado.evidencias ?? [];
  const de = (requisito: "acessibilidade" | "democratizacao") => evidencias.filter(e => e.requisitos?.includes(requisito)).length;
  const acessivel = de("acessibilidade");
  const democratico = de("democratizacao");
  if (acessivel && democratico) {
    return pronto(`${plural(acessivel, "evidência", "evidências")} de acessibilidade e ${democratico} de democratização do acesso.`);
  }
  const falta = !acessivel && !democratico ? "acessibilidade e democratização do acesso" : !acessivel ? "acessibilidade" : "democratização do acesso";
  return pendente(`Falta evidência de ${falta}: marque o requisito nas evidências do objeto.`, "objeto");
};

const fotosDeAcessibilidade: Avaliador = ctx => {
  const n = (ctx.estado.evidencias ?? []).filter(e => e.tipo === "foto" && e.requisitos?.includes("acessibilidade")).length;
  return n ? pronto(`${plural(n, "foto", "fotos")} de acessibilidade.`) : pendente("Nenhuma foto marcada como evidência de acessibilidade.", "objeto");
};

const fotos: Avaliador = ctx => {
  const n = (ctx.estado.evidencias ?? []).filter(e => ["foto", "video", "clipping", "print"].includes(e.tipo)).length;
  return n ? pronto(`${plural(n, "foto ou registro", "fotos e registros")} nas evidências.`) : pendente("Anexe fotos e registros da execução nas evidências do objeto.", "objeto");
};

const pecas: Avaliador = ctx => {
  const todas = ctx.estado.pecas ?? [];
  if (todas.length === 0) return pendente("Cadastre as peças de divulgação, com a amostra de cada uma.", "divulgacao");
  const semAmostra = todas.filter(p => p.veiculacao_inicio && p.veiculacao_inicio <= ctx.hojeIso && !p.storage_path && !p.url).length;
  if (semAmostra) return pendente(`${plural(semAmostra, "peça veiculada está", "peças veiculadas estão")} sem amostra.`, "divulgacao");
  const comAmostra = todas.filter(p => p.storage_path || p.url).length;
  return pronto(`${plural(comAmostra, "peça com amostra", "peças com amostra")}.`);
};

const bens: Avaliador = (ctx, { obrigatorio }) => {
  const itensDeBem = new Set((ctx.estado.nos ?? []).filter(n => n.bem_permanente).map(n => n.id));
  const cadastrados = ctx.estado.bens ?? [];
  const despesas = despesasValidas(ctx).filter(d => d.no_id !== null && itensDeBem.has(d.no_id));
  if (cadastrados.length === 0 && despesas.length === 0) {
    const texto = itensDeBem.size ? "Nenhuma despesa nos itens de bem permanente." : "Nenhum item do orçamento é bem permanente e nenhum bem foi cadastrado.";
    return obrigatorio ? pronto(`${texto} A relação vai sem bens.`) : { situacao: "nao_se_aplica", detalhe: texto, destino: null };
  }
  const semBem = despesasSemBem(despesas, itensDeBem, cadastrados).length;
  if (semBem) return pendente(`${plural(semBem, "despesa de bem permanente está", "despesas de bem permanente estão")} sem o bem cadastrado.`, "bens");
  const semDestinacao = cadastrados.filter(b => !b.destinacao).length;
  if (semDestinacao) return pendente(`${plural(semDestinacao, "bem está", "bens estão")} sem destinação.`, "bens");
  const abertas = ctx.abertas(comDestino("bens"));
  if (abertas) return pendente(`${plural(abertas, "pendência aberta", "pendências abertas")} nos bens.`, "bens");
  return pronto(`${plural(cadastrados.length, "bem", "bens")} com destinação, sem pendência aberta.`);
};

const despesas: Avaliador = ctx => {
  const validas = despesasValidas(ctx);
  if (validas.length === 0) return pendente("Nenhuma despesa lançada.", "comprovantes");
  const aguardando = validas.filter(d => d.status === "pendente").length;
  if (aguardando) return pendente(`${plural(aguardando, "despesa aguarda", "despesas aguardam")} avaliação.`, "comprovantes");
  const abertas = ctx.abertas(doGrupo("despesa", "fornecedor", "pagamento", "conciliacao"));
  if (abertas) return pendente(`${plural(abertas, "pendência aberta", "pendências abertas")} nas despesas, nos pagamentos e na conciliação.`, "pendencias");
  return pronto(`${plural(validas.length, "despesa aceita", "despesas aceitas")}, sem pendência aberta.`);
};

/** O último extrato importado de cada conta: o de período mais recente. */
export function ultimoExtrato(conta: ContaDoChecklist) {
  return [...conta.extratos].sort((a, b) =>
    (b.periodo_fim ?? "").localeCompare(a.periodo_fim ?? "") || b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export const nomeDaConta = (c: ContaDoChecklist) => c.apelido?.trim() || [c.banco, c.conta].filter(Boolean).join(" ") || `conta ${c.tipo}`;

const extratos: Avaliador = ctx => {
  if (ctx.contas.length === 0) return pendente("Cadastre as contas do projeto e importe os extratos.", "extrato");
  const semExtrato = ctx.contas.filter(c => c.extratos.length === 0);
  if (semExtrato.length) return pendente(`Sem extrato importado: ${semExtrato.map(nomeDaConta).join(", ")}.`, "extrato");
  const fins = ctx.contas.map(c => ultimoExtrato(c)?.periodo_fim ?? null);
  const ate = fins.every(Boolean) ? (fins as string[]).sort()[0] : null;
  return pronto(`${plural(ctx.contas.length, "conta", "contas")} com extrato${ate ? `, todas até ${dataBr(ate)} ou depois` : ""}.`);
};

const locais: Avaliador = ctx => {
  const todos = ctx.estado.locais ?? [];
  if (todos.length === 0) return pendente("Cadastre os locais de realização.", "objeto");
  const previstos = todos.filter(l => l.status === "previsto").length;
  if (previstos) return pendente(`${plural(previstos, "local ainda está", "locais ainda estão")} como previsto: informe se foi realizado.`, "objeto");
  return pronto(`${plural(todos.length, "local", "locais")} com a situação informada.`);
};

const itens: Avaliador = ctx => {
  const validas = despesasValidas(ctx);
  if (validas.length === 0) return pendente("Nenhuma despesa lançada.", "comprovantes");
  const aguardando = validas.filter(d => d.status === "pendente").length;
  if (aguardando) return pendente(`${plural(aguardando, "despesa aguarda", "despesas aguardam")} avaliação.`, "comprovantes");
  const semItem = validas.filter(d => !d.no_id).length;
  if (semItem) return pendente(`${plural(semItem, "despesa está", "despesas estão")} sem item do orçamento.`, "comprovantes");
  const debitos = ctx.abertas(c => c === "DEBITO_SEM_COMPROVANTE");
  if (debitos) return pendente(`${plural(debitos, "débito do extrato está", "débitos do extrato estão")} sem despesa.`, "conciliacao");
  return pronto("Despesas avaliadas e ligadas aos itens; nenhum débito do extrato sem despesa.");
};

const alteracoes: Avaliador = ctx => {
  const abertas = (ctx.estado.alteracoes ?? []).filter(a => a.status === "rascunho" || a.status === "solicitada");
  if (abertas.length) {
    return pendente(`${plural(abertas.length, "alteração do orçamento está", "alterações do orçamento estão")} em aberto (nº ${abertas.map(a => a.numero).join(", ")}).`, "orcamento");
  }
  return pronto("Nenhuma alteração do orçamento em aberto.");
};

const saldo: Avaliador = ctx => {
  if (ctx.contas.length === 0) return pendente("Cadastre as contas e importe o extrato final.", "extrato");
  const ultimos = ctx.contas.map(c => ({ conta: c, extrato: ultimoExtrato(c) }));
  const semExtrato = ultimos.filter(u => !u.extrato);
  if (semExtrato.length) return pendente(`Sem extrato importado: ${semExtrato.map(u => nomeDaConta(u.conta)).join(", ")}.`, "extrato");
  if (ultimos.some(u => u.extrato!.saldo_final === null)) {
    return { dica: "O último extrato de alguma conta não traz o saldo final: confira no banco e marque quando estiver zerado." };
  }
  const comSaldo = ultimos.filter(u => centavos(u.extrato!.saldo_final) !== 0);
  if (comSaldo.length) {
    const total = comSaldo.reduce((s, u) => s + centavos(u.extrato!.saldo_final), 0);
    const contas = comSaldo.map(u => `${nomeDaConta(u.conta)}, ${reais(centavos(u.extrato!.saldo_final))}${u.extrato!.periodo_fim ? ` em ${dataBr(u.extrato!.periodo_fim)}` : ""}`).join("; ");
    return pendente(`Saldo de ${reais(total)} pelo último extrato (${contas}): recolha ou transfira antes de enviar.`, "extrato");
  }
  return pronto("Saldo zerado no último extrato de cada conta.");
};

/** O comprovante do recolhimento do saldo e dos rendimentos: pelas guias registradas em Devoluções. */
const recolhimento: Avaliador = ctx => {
  const r = recolhimentoDoEncerramento(ctx.devolucoes ?? []);
  if (r.guias === 0) {
    return { dica: "Registre a guia do saldo e dos rendimentos em Devoluções, ou anexe aqui o comprovante do recolhimento ou da transferência do saldo." };
  }
  if (r.aPagar) return pendente(`${plural(r.aPagar, "guia do saldo e dos rendimentos está", "guias do saldo e dos rendimentos estão")} a pagar, ${reais(r.valorAPagar)}.`, "devolucoes");
  if (r.semComprovante) return pendente(`${plural(r.semComprovante, "guia paga está", "guias pagas estão")} sem o comprovante.`, "devolucoes");
  const ultima = r.pagasEm[r.pagasEm.length - 1];
  return pronto(`${reais(r.valorPago)} ${r.guias === 1 ? "recolhido em 1 guia" : `recolhidos em ${r.guias} guias`}${ultima ? `, paga${r.guias === 1 ? "" : "s"} até ${dataBr(ultima)}` : ""}, com comprovante.`);
};

const ehPdf = (a: { nome_arquivo: string | null; mime_type?: string | null }) =>
  a.mime_type === "application/pdf" || /\.pdf$/i.test(a.nome_arquivo ?? "");

const anexos: Avaliador = (ctx, { regra }) => {
  const mb = Number(regra?.parametros?.mb);
  if (!Number.isFinite(mb) || mb <= 0) return null;
  const limite = mb * 1024 * 1024;
  const doEnvio = ctx.arquivos.filter(a => a.etapa === ctx.etapa);
  const foraDoFormato = doEnvio.filter(a => !ehPdf(a)).map(a => a.nome_arquivo);
  const grandes = doEnvio.filter(a => (a.tamanho_bytes ?? 0) > limite).map(a => a.nome_arquivo);
  const validas = despesasValidas(ctx);
  if (validas.length === 0 && doEnvio.length === 0) return pendente("Nenhum comprovante nem arquivo anexado para conferir ainda.", null);
  const comprovantes = validas.filter(d => !ehPdf(d)).length;
  const problemas = [
    foraDoFormato.length ? `fora de PDF aqui: ${foraDoFormato.join(", ")}` : null,
    grandes.length ? `acima de ${mb} MB: ${grandes.join(", ")}` : null,
    comprovantes ? `${plural(comprovantes, "comprovante não está", "comprovantes não estão")} em PDF` : null,
  ].filter(Boolean);
  if (problemas.length) {
    return pendente(`${problemas.join("; ")}.`.replace(/^./, c => c.toUpperCase()), comprovantes && !foraDoFormato.length && !grandes.length ? "comprovantes" : null);
  }
  return pronto(`Comprovantes${doEnvio.length ? " e arquivos anexados aqui" : ""} em PDF${doEnvio.length ? `, até ${mb} MB` : ""}.`);
};

/** Documentos que os dados respondem, pelo código no regime. */
const DOCUMENTOS: Record<string, Avaliador> = {
  relatorio_objeto: objeto,
  rco: objeto,
  objeto,
  acessibilidade_democratizacao: acessibilidade,
  fotos_acessibilidade: fotosDeAcessibilidade,
  fotos,
  fotos_reportagens: fotos,
  pecas_divulgacao: pecas,
  divulgacao: pecas,
  bens,
  equipamentos: bens,
  comprovantes_despesa: despesas,
  documentos_fiscais: despesas,
  extratos,
  extrato: extratos,
  recolhimento_fnc: recolhimento,
  gru_saldos: recolhimento,
  gru_ou_transferencia: recolhimento,
  gru: recolhimento,
};

/** Condições do sistema oficial que os dados respondem. */
const CONDICOES: Record<string, Avaliador> = {
  locais_comprovados: locais,
  itens_comprovados: itens,
  sem_readequacao_em_analise: alteracoes,
  saldo_liquidado: saldo,
  anexos,
  arquivos: anexos,
};

// ─── O checklist ────────────────────────────────────────────────────────────

/** O checklist da etapa no regime, com a situação de cada item. */
export function checklistDeEnvio(dados: DadosDoChecklist): ChecklistDeEnvio {
  const { regime, etapa } = dados;
  const vazio = (semChecklist: string): ChecklistDeEnvio => ({
    etapa, etapas: ["final"], sistema: null, descricao: null, fonte: null, documentos: [], condicoes: [], orientacoes: [],
    resumo: { total: 0, resolvidos: 0, pendentes: 0, obrigatoriosPendentes: 0 }, semChecklist,
  });
  if (!regime) return vazio("Escolha o regime da prestação para ver o que o envio pede.");
  const envio = definida(regime.envio);
  if (!envio) return vazio("O regime ainda não descreve o envio: confira o manual do órgão.");

  const abertasPorCodigo = new Map<string, number>();
  for (const v of dados.verificacoes) {
    if (v.status === "aberta") abertasPorCodigo.set(v.check_codigo, (abertasPorCodigo.get(v.check_codigo) ?? 0) + 1);
  }
  const ctx: Contexto = {
    ...dados,
    hojeIso: dados.hoje ?? hojeDe(dados.estado.hoje ?? new Date()),
    sistema: envio.sistema,
    abertas: filtro => [...abertasPorCodigo].reduce((soma, [codigo, n]) => soma + (filtro(codigo) ? n : 0), 0),
  };

  const linha = (tipo: TipoDoItem, codigo: string, descricao: string, obrigatorio: boolean, severidade: Regra["severidade"] | null,
    fonte: Fonte, avaliador: Avaliador | undefined, regra?: Regra): LinhaDoChecklist => {
    const marcacao = dados.marcacoes.find(m => m.etapa === etapa && m.tipo === tipo && m.codigo === codigo) ?? null;
    const arquivos = tipo === "documento" ? dados.arquivos.filter(a => a.etapa === etapa && a.codigo === codigo) : [];
    const base = { tipo, codigo, descricao, obrigatorio, severidade, fonte, arquivos, aceitaArquivo: tipo === "documento" };
    const resposta = avaliador?.(ctx, { obrigatorio, regra }) ?? null;
    if (resposta && "situacao" in resposta) {
      return { ...base, ...resposta, origem: "dados", marcacao: null, dispensavel: false };
    }
    const dispensavel = !obrigatorio;
    if (marcacao?.situacao === "nao_se_aplica" && dispensavel) {
      return { ...base, origem: "pessoa", situacao: "nao_se_aplica", detalhe: marcacao.justificativa?.trim() || "Não se aplica.", destino: null, marcacao, dispensavel };
    }
    if (marcacao?.situacao === "pronto") {
      const detalhe = tipo === "condicao" ? `Conferido no ${envio.sistema}.`
        : arquivos.length ? `Pronto, com ${plural(arquivos.length, "arquivo anexado", "arquivos anexados")}.` : "Marcado como pronto.";
      return { ...base, origem: "pessoa", situacao: "pronto", detalhe, destino: null, marcacao, dispensavel };
    }
    if (arquivos.length) {
      return { ...base, origem: "pessoa", situacao: "pronto", detalhe: `${plural(arquivos.length, "arquivo anexado", "arquivos anexados")}.`, destino: null, marcacao: null, dispensavel };
    }
    const dica = resposta && "dica" in resposta ? resposta.dica
      : tipo === "documento" ? "Anexe o arquivo, ou marque como pronto se ele já está no sistema oficial."
      : `Confira no ${envio.sistema} e marque como conferido.`;
    return { ...base, origem: "pessoa", situacao: "pendente", detalhe: dica, destino: null, marcacao: null, dispensavel };
  };

  const documentos = envio.documentos
    .filter(d => d.em.includes(etapa))
    .map(d => linha("documento", d.codigo, d.descricao, d.obrigatorio, null, d.fonte, DOCUMENTOS[d.codigo]));

  const parcial = etapa === "parcial" ? definida(regime.prestacaoParcial)?.regras ?? [] : [];
  const regras = [...parcial, ...envio.regras].filter((r, i, todas) => todas.findIndex(o => o.codigo === r.codigo) === i);
  const condicoes = regras
    .filter(r => r.severidade !== "info")
    .map(r => linha("condicao", r.codigo, r.descricao, r.severidade === "bloqueio", r.severidade, r.fonte, CONDICOES[r.codigo], r));
  const orientacoes = regras.filter(r => r.severidade === "info").map(r => ({ codigo: r.codigo, descricao: r.descricao, fonte: r.fonte }));

  const todas = [...documentos, ...condicoes];
  const pendentes = todas.filter(l => l.situacao === "pendente");
  return {
    etapa,
    etapas: etapasDoRegime(regime),
    sistema: envio.sistema,
    descricao: envio.descricao,
    fonte: envio.fonte,
    documentos,
    condicoes,
    orientacoes,
    resumo: {
      total: todas.length,
      resolvidos: todas.length - pendentes.length,
      pendentes: pendentes.length,
      obrigatoriosPendentes: pendentes.filter(l => l.obrigatorio).length,
    },
    semChecklist: null,
  };
}

/** O mesmo que o banco confere antes de gravar a marcação. */
export function erroDaMarcacao(linha: Pick<LinhaDoChecklist, "obrigatorio" | "dispensavel">, situacao: PrestacaoEnvioMarcacao["situacao"], justificativa: string | null): string | null {
  if (situacao === "nao_se_aplica") {
    if (linha.obrigatorio || !linha.dispensavel) return "Item obrigatório não pode ficar como \"não se aplica\".";
    if ((justificativa ?? "").trim().length < 5) return "Explique por que não se aplica (pelo menos 5 letras).";
    if ((justificativa ?? "").length > 1000) return "O motivo tem até 1.000 caracteres.";
  }
  return null;
}
