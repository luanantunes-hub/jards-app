// Monta o estado da prestação que o motor de checagens recebe (P2.7, P2.8):
// despesas, fornecedores e documentos, nós e itens da versão em uso do
// orçamento com os CNAEs, pagamentos, lançamentos do extrato, alterações do
// orçamento, metas, locais, atividades e evidências do objeto, as datas da
// prestação e o regime. A rota de verificação usa o
// cliente do service role; o mesmo código roda com qualquer cliente do
// Supabase que enxergue a prestação.

import { itensDaArvore, montarArvore, type NoOrcamento } from "../orcamento";
import { regimeSchema } from "../regimes/schema";
import type { EvidenciaParaChecar } from "../evidencias";
import type { LinhaDistribuicao } from "../distribuicao";
import { lerCotacoes, type BemParaChecar } from "../bens";
import type { DefesoEleitoral, PecaParaChecar } from "../pecas";
import type { AlteracaoDoEstado, AtividadeDoEstado, DatasDaPrestacao, EstadoDaPrestacao, LocalDoEstado, MetaDoEstado } from "./catalogo";

const PAGINA = 1000;

type Resposta = { data: unknown; error: { message: string } | null };
type Consulta = PromiseLike<Resposta> & { range: (de: number, ate: number) => PromiseLike<Resposta> };
type Cliente = { from: (tabela: string) => { select: (colunas: string) => unknown } };

/** Todas as linhas, de mil em mil (o PostgREST corta em mil por resposta). */
async function todas<T>(consulta: () => Consulta): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta().range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = (data ?? []) as T[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA) return linhas;
  }
}

async function uma<T>(consulta: PromiseLike<Resposta>): Promise<T | null> {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return (data as T | null) ?? null;
}

export async function estadoDaPrestacao(cliente: Cliente, prestacaoId: string, hoje: Date = new Date()): Promise<EstadoDaPrestacao> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
  const db = cliente as any;
  const prestacao = await uma<{ organization_id: string; regime_id: string | null; valor_aprovado: number | null } & DatasDaPrestacao>(
    db.from("prestacoes_contas")
      .select("organization_id, regime_id, valor_aprovado, data_aprovacao, data_liberacao, data_inicio_execucao, data_fim_execucao")
      .eq("id", prestacaoId).single());
  if (!prestacao) throw new Error("prestacao_inexistente");

  const [regimeLinha, versao, despesas, pagamentos, lancamentos, alteracoes, metas, locais, atividades, evidencias, distribuicao, bens, pecas, defesos] = await Promise.all([
    prestacao.regime_id
      ? uma<{ parametros: unknown }>(db.from("prestacao_regimes").select("parametros").eq("id", prestacao.regime_id).maybeSingle())
      : Promise.resolve(null),
    uma<{ id: string }>(db.from("prestacao_orcamento_versoes").select("id").eq("prestacao_id", prestacaoId).eq("ativa", true).maybeSingle()),
    todas<EstadoDaPrestacao["despesas"][number]>(() => db.from("prestacao_comprovantes")
      .select("id, nome_arquivo, status, no_id, tipo, data_doc, valor_extraido, valor_liquido, fornecedor_id, numero_documento, serie, chave_acesso, iss, inss, irrf, outras_retencoes, identificacao_projeto, justificativa, motivos_ia")
      .eq("prestacao_id", prestacaoId).order("id")),
    todas<EstadoDaPrestacao["pagamentos"][number]>(() => db.from("prestacao_pagamentos")
      .select("id, despesa_id, lancamento_id, forma, data, valor, favorecido_documento, numero_documento")
      .eq("prestacao_id", prestacaoId).order("id")),
    todas<EstadoDaPrestacao["lancamentos"][number]>(() => db.from("prestacao_lancamentos")
      .select("id, data, natureza, valor, historico, numero_documento, numero_normalizado, categoria")
      .eq("prestacao_id", prestacaoId).order("id")),
    todas<AlteracaoDoEstado>(() => db.from("prestacao_alteracoes")
      .select("id, numero, status, solicitada_em, tipo, justificativa, decidida_em").eq("prestacao_id", prestacaoId).order("id")),
    todas<MetaDoEstado>(() => db.from("prestacao_metas")
      .select("id, descricao, unidade, previsto, realizado, justificativa").eq("prestacao_id", prestacaoId).order("ordem").order("id")),
    todas<LocalDoEstado>(() => db.from("prestacao_locais")
      .select("id, pais, uf, municipio, status, latitude, longitude, espaco, inicio, fim, justificativa").eq("prestacao_id", prestacaoId).order("ordem").order("id")),
    todas<AtividadeDoEstado>(() => db.from("prestacao_atividades")
      .select("id, titulo, data_realizacao, data_inicio, data_fim, local_id, meta_id, status_realizacao, descricao, democratizacao_descricao, acessibilidade_descricao, justificativa_nao_realizacao").eq("prestacao_id", prestacaoId).order("id")),
    todas<EvidenciaParaChecar>(() => db.from("prestacao_evidencias")
      .select("id, tipo, requisitos, nome_arquivo, url, atividade_id, meta_id, local_id, capturada_em, latitude, longitude, justificativa, descricao")
      .eq("prestacao_id", prestacaoId).order("id")),
    todas<LinhaDistribuicao>(() => db.from("prestacao_distribuicao")
      .select("id, produto, categoria, quantidade, quantidade_meia, preco, quantidade_realizada, beneficiario, beneficiario_documento, justificativa")
      .eq("prestacao_id", prestacaoId).order("ordem").order("id")),
    todas<BemParaChecar>(() => db.from("prestacao_bens")
      .select("id, no_id, despesa_id, tipo, descricao, valor, registro_imovel, cotacoes, destinacao, beneficiario, doacao_storage_path, aceite_storage_path, justificativa, quantidade, beneficiario_documento")
      .eq("prestacao_id", prestacaoId).order("ordem").order("id")),
    todas<PecaParaChecar>(() => db.from("prestacao_pecas")
      .select("id, tipo, titulo, veiculacao_inicio, veiculacao_fim, marcas, aprovacao_status, aprovacao_enviada_em, aprovacao_decidida_em, storage_path, url, justificativa")
      .eq("prestacao_id", prestacaoId).order("ordem").order("id")),
    todas<DefesoEleitoral>(() => db.from("calendario_regulatorio")
      .select("inicio, fim, descricao").eq("tipo", "defeso_eleitoral").order("inicio")),
  ]);

  const nos = versao
    ? await todas<NoOrcamento>(() => db.from("prestacao_orcamento_nos").select("*").eq("versao_id", versao.id).order("id"))
    : [];
  const itens = itensDaArvore(montarArvore(nos, []).raizes)
    .map(linha => ({ id: linha.no.id, nome: linha.no.nome, cnaes: linha.cnaes, cnaesDe: linha.cnaesDe }));

  const idsFornecedores = [...new Set(despesas.map(d => d.fornecedor_id).filter((f): f is string => Boolean(f)))];
  const [fornecedores, documentos] = idsFornecedores.length
    ? await Promise.all([
      todas<EstadoDaPrestacao["fornecedores"][number]>(() => db.from("prestacao_fornecedores").select("*")
        .eq("organization_id", prestacao.organization_id).in("id", idsFornecedores).order("id")),
      todas<EstadoDaPrestacao["documentosDosFornecedores"][number]>(() => db.from("prestacao_fornecedor_documentos")
        .select("fornecedor_id, tipo, created_at").in("fornecedor_id", idsFornecedores).order("id")),
    ])
    : [[], []];

  const regime = regimeLinha ? regimeSchema.safeParse(regimeLinha.parametros) : null;
  return {
    regime: regime?.success ? regime.data : null,
    prestacao: {
      data_aprovacao: prestacao.data_aprovacao ?? null,
      data_liberacao: prestacao.data_liberacao ?? null,
      data_inicio_execucao: prestacao.data_inicio_execucao ?? null,
      data_fim_execucao: prestacao.data_fim_execucao ?? null,
    },
    despesas,
    fornecedores,
    documentosDosFornecedores: documentos,
    itens,
    nos,
    pagamentos,
    lancamentos,
    alteracoes,
    metas,
    locais,
    atividades,
    evidencias,
    distribuicao: distribuicao.map(l => ({ ...l, preco: l.preco === null ? null : Number(l.preco) })),
    bens: bens.map(b => ({ ...b, valor: b.valor === null ? null : Number(b.valor), cotacoes: lerCotacoes(b.cotacoes) })),
    pecas,
    defesos,
    valorAprovado: prestacao.valor_aprovado === null || prestacao.valor_aprovado === undefined ? null : Number(prestacao.valor_aprovado),
    hoje,
  };
}
