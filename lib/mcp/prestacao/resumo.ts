import type { EstadoDaPrestacao } from "@/lib/prestacao/checagens/catalogo";
import { situacaoDaCaptacao } from "@/lib/prestacao/captacao";
import type { DadosDoEnvio } from "@/lib/prestacao/dados-do-envio";
import { checklistDeEnvio } from "@/lib/prestacao/envio";
import { exerciciosEnviados, type EnvioDaLista } from "@/lib/prestacao/envios";
import { percentualExecutado, totalExecutado } from "@/lib/prestacao/execucao";
import { anuaisPendentes, exerciciosDaAnual } from "@/lib/prestacao/exercicios";
import { coberturaDaMeta } from "@/lib/prestacao/objeto";
import { itensDaArvore, montarArvore } from "@/lib/prestacao/orcamento";
import { avaliarProntidao, prazoDoSaldoEmAberto, prazosDaPrestacao, proximoPrazo, quandoVence, type DestinoPendencia } from "@/lib/prestacao/prontidao";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { STATUS_ROTULO } from "@/lib/mcp/prestacao/enums";

/** Aba da prestação onde cada pendência se resolve, como o endereço depois de /prestacoes/{id}. */
export const CAMINHO_DO_DESTINO: Record<DestinoPendencia, string> = {
  visao_geral: "",
  orcamento: "/orcamento",
  comprovantes: "/comprovantes",
  atividades: "/atividades",
  objeto: "/objeto",
  pendencias: "/pendencias",
  envio: "/envio",
};

export const linkDaPrestacao = (origem: string, id: string, destino: DestinoPendencia = "visao_geral") => `${origem}/prestacoes/${id}${CAMINHO_DO_DESTINO[destino]}`;

/** A prestação como o conector lê: só as colunas escolhidas (nunca o token do e-mail de captura nem o descarte de dados pessoais). */
export interface PrestacaoDoResumo {
  id: string;
  titulo: string;
  status: keyof typeof STATUS_ROTULO;
  prazo: string | null;
  prazo_final: string | null;
  prazo_final_override: string | null;
  prazo_final_justificativa: string | null;
  valor_aprovado: number | string | null;
  valor_realizado: number | string | null;
  regime_id: string | null;
  identificador_oficial: string | null;
  identificador_tipo: string | null;
  fonte_recurso: string | null;
  numero_processo: string | null;
  data_aprovacao: string | null;
  data_liberacao: string | null;
  data_termo: string | null;
  data_inicio_execucao: string | null;
  data_fim_execucao: string | null;
  data_conclusao_objeto: string | null;
  data_envio: string | null;
  data_fim_captacao: string | null;
  verificada_em: string | null;
  created_at: string | null;
  updated_at: string | null;
  captacao: { id: string; titulo: string | null; lei: string | null; valor_solicitado: number | null } | null;
  projeto: { id: string; nome: string } | null;
  proponente: { id: string; nome: string } | null;
}

export const COLUNAS_DA_PRESTACAO =
  "id,titulo,status,prazo,prazo_final,prazo_final_override,prazo_final_justificativa,valor_aprovado,valor_realizado,regime_id,identificador_oficial,identificador_tipo,fonte_recurso," +
  "numero_processo,data_aprovacao,data_liberacao,data_termo,data_inicio_execucao,data_fim_execucao,data_conclusao_objeto,data_envio,data_fim_captacao,verificada_em,created_at,updated_at," +
  "captacao:captacao_id(id,titulo,lei,valor_solicitado),projeto:projeto_id(id,nome),proponente:proponente_id(id,nome)";

export interface EntradaDoResumo {
  prestacao: PrestacaoDoResumo;
  regime: { id: string; codigo: string; nome: string; parametros: RegimeNormativo | null } | null;
  /** O estado que o motor de checagens usa: despesas, orçamento, pagamentos, metas, atividades, evidências, alterações. */
  estado: EstadoDaPrestacao;
  /** Dados do checklist de envio; null se não foi possível ler (a prontidão fica sem esse item, como na tela). */
  dadosDoEnvio: DadosDoEnvio | null;
  envios: readonly EnvioDaLista[];
  /** Verificações abertas (status "aberta"), só severidade. */
  verificacoesAbertas: ReadonlyArray<{ severidade: string }>;
  /** Aportes do extrato (visão da carteira), em reais. */
  captado: number;
  /** "AAAA-MM-DD" em Brasília. */
  hoje: string;
  origem: string;
}

const numero = (valor: number | string | null | undefined): number | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

const reais = (valor: number) => Math.round(valor * 100) / 100;

/**
 * O resumo da prestação para o assistente. É a mesma conta da tela de visão geral (prontidão, prazos, comprovado),
 * feita com as mesmas funções de lib/prestacao, de modo que o assistente e a tela dizem os mesmos números.
 */
export function montarResumoDaPrestacao(entrada: EntradaDoResumo) {
  const { prestacao, estado, dadosDoEnvio, envios, hoje, origem } = entrada;
  const regime = entrada.regime?.parametros ?? null;

  const nos = estado.nos ?? [];
  const itens = itensDaArvore(montarArvore(nos, []).raizes).map(linha => ({ id: linha.no.id, grupo: linha.grupo, vigente: linha.totais.vigente }));
  const comprovantes = estado.despesas;
  const alteracoes = estado.alteracoes ?? [];
  const alteracoesAguardando = alteracoes.filter(a => a.status === "solicitada");

  const metas = estado.metas ?? [];
  const atividades = estado.atividades ?? [];
  const evidencias = estado.evidencias ?? [];
  // A cobertura lê só id, meta e situação da atividade e o vínculo da evidência: o mesmo recorte que a tela faz.
  const atividadesDaCobertura = atividades.map(a => ({ id: a.id, meta_id: a.meta_id ?? null, status_realizacao: a.status_realizacao })) as Parameters<typeof coberturaDaMeta>[1];
  const evidenciasDaCobertura = evidencias.map(e => ({ atividade_id: e.atividade_id ?? null, meta_id: e.meta_id ?? null }));
  const objeto = { metas: metas.length, comprovadas: metas.filter(m => coberturaDaMeta(m, atividadesDaCobertura, evidenciasDaCobertura).comprovada).length };

  const bloqueios = entrada.verificacoesAbertas.filter(v => v.severidade === "bloqueio").length;
  const checklist = dadosDoEnvio ? checklistDeEnvio({ ...dadosDoEnvio, etapa: "final" }) : null;
  const resumoDoEnvio = checklist && !checklist.semChecklist ? checklist.resumo : undefined;

  const prontidao = avaliarProntidao({
    regime,
    identificadorOficial: prestacao.identificador_oficial,
    prazo: prestacao.prazo,
    itens,
    comprovantes: [...comprovantes],
    atividades: atividades.length,
    objeto,
    alteracoesAguardando: alteracoesAguardando.length,
    verificacoes: { verificada: Boolean(prestacao.verificada_em), bloqueios },
    envio: resumoDoEnvio,
  });

  const orcamentoVigente = itens.reduce((soma, item) => soma + item.vigente, 0);
  const totalAprovado = itens.length > 0 ? orcamentoVigente : (numero(prestacao.valor_aprovado) ?? 0);
  const totalComprovado = totalExecutado(comprovantes);

  const captacao = situacaoDaCaptacao(regime, {
    captado: Math.round(entrada.captado * 100),
    aprovado: numero(prestacao.valor_aprovado) ? Math.round((numero(prestacao.valor_aprovado) ?? 0) * 100) : null,
    orcamentoVigente: itens.length ? Math.round(totalAprovado * 100) : null,
    alteracoes,
    dataFimCaptacao: prestacao.data_fim_captacao,
  });
  const prazoReadequacao = captacao && !captacao.readequacaoPedida ? captacao.prazoDaReadequacao : null;
  const prazosAnuais = anuaisPendentes(exerciciosDaAnual(regime, prestacao, hoje), exerciciosEnviados(envios));
  const prazoSaldo = dadosDoEnvio ? prazoDoSaldoEmAberto(regime, prestacao, dadosDoEnvio.devolucoes ?? []) : null;
  const prazos = prazosDaPrestacao(
    { ...prestacao, prazo_readequacao: prazoReadequacao, prazos_anuais: prazosAnuais, prazo_saldo: prazoSaldo },
    regime,
    alteracoesAguardando,
    hoje,
  );
  const proximo = proximoPrazo(prazos);

  const porStatus: Record<string, number> = {};
  for (const despesa of comprovantes) porStatus[despesa.status] = (porStatus[despesa.status] ?? 0) + 1;

  const prazoEmUso = prestacao.prazo_final_override ?? prestacao.prazo_final ?? prestacao.prazo;
  return {
    id: prestacao.id,
    titulo: prestacao.titulo,
    status: prestacao.status,
    status_rotulo: STATUS_ROTULO[prestacao.status] ?? prestacao.status,
    identificador_oficial: prestacao.identificador_oficial,
    identificador_tipo: prestacao.identificador_tipo,
    numero_do_processo: prestacao.numero_processo,
    fonte_do_recurso: prestacao.fonte_recurso,
    regime: entrada.regime ? { codigo: entrada.regime.codigo, nome: entrada.regime.nome } : null,
    proponente: prestacao.proponente ? { nome: prestacao.proponente.nome } : null,
    projeto: prestacao.projeto ? { nome: prestacao.projeto.nome } : null,
    captacao: prestacao.captacao ? { titulo: prestacao.captacao.titulo, lei: prestacao.captacao.lei } : null,
    marcos: {
      aprovacao: prestacao.data_aprovacao,
      termo: prestacao.data_termo,
      liberacao_dos_recursos: prestacao.data_liberacao,
      inicio_da_execucao: prestacao.data_inicio_execucao,
      fim_da_execucao: prestacao.data_fim_execucao,
      fim_da_captacao: prestacao.data_fim_captacao,
      conclusao_do_objeto: prestacao.data_conclusao_objeto,
      envio: prestacao.data_envio,
    },
    prazo: prazoEmUso
      ? {
          data: prazoEmUso,
          origem: prestacao.prazo_final_override ? "informado" : prestacao.prazo_final ? "calculado_pelo_regime" : "informado",
          justificativa: prestacao.prazo_final_justificativa,
        }
      : null,
    prazos: prazos.map(prazo => ({ data: prazo.data, rotulo: prazo.rotulo, quem: prazo.quem, dias: prazo.dias, quando: quandoVence(prazo.dias) })),
    proximo_prazo: proximo ? { data: proximo.data, rotulo: proximo.rotulo, quem: proximo.quem, dias: proximo.dias, quando: quandoVence(proximo.dias) } : null,
    financeiro: {
      valor_aprovado: numero(prestacao.valor_aprovado),
      orcamento_vigente: itens.length > 0 ? reais(orcamentoVigente) : null,
      comprovado: reais(totalComprovado),
      a_comprovar: reais(totalAprovado - totalComprovado),
      percentual_comprovado: percentualExecutado(totalComprovado, totalAprovado),
      captado: reais(entrada.captado),
    },
    despesas: { total: comprovantes.length, por_status: porStatus },
    verificacoes: {
      ultima_verificacao_em: prestacao.verificada_em,
      abertas: entrada.verificacoesAbertas.length,
      bloqueios_abertos: bloqueios,
      impede_o_envio: bloqueios > 0 || !prestacao.verificada_em,
    },
    prontidao: {
      percentual: prontidao.percentual,
      pendencias: prontidao.pendencias.map(p => ({
        codigo: p.codigo,
        titulo: p.titulo,
        detalhe: p.detalhe,
        progresso_percentual: Math.round(p.progresso * 100),
        onde_resolver: linkDaPrestacao(origem, prestacao.id, p.destino),
      })),
      itens_prontos: prontidao.checagens.filter(c => c.situacao === "ok").map(c => ({ codigo: c.codigo, titulo: c.titulo })),
    },
    checklist_de_envio: checklist ? (checklist.semChecklist ? { disponivel: false, motivo: checklist.semChecklist } : { disponivel: true, ...checklist.resumo }) : { disponivel: false, motivo: "Não foi possível ler os dados do checklist agora." },
    criada_em: prestacao.created_at,
    atualizada_em: prestacao.updated_at,
    url: linkDaPrestacao(origem, prestacao.id),
  };
}
