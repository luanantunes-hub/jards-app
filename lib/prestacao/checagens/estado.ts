// Monta o estado da prestação que o motor de checagens recebe (P2.7, P2.8):
// despesas, fornecedores e documentos, nós e itens da versão em uso do
// orçamento com os CNAEs, pagamentos, lançamentos do extrato, alterações do
// orçamento, as datas da prestação e o regime. A rota de verificação usa o
// cliente do service role; o mesmo código roda com qualquer cliente do
// Supabase que enxergue a prestação.

import { itensDaArvore, montarArvore, type NoOrcamento } from "../orcamento";
import { regimeSchema } from "../regimes/schema";
import type { AlteracaoDoEstado, DatasDaPrestacao, EstadoDaPrestacao } from "./catalogo";

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
  const prestacao = await uma<{ organization_id: string; regime_id: string | null } & DatasDaPrestacao>(
    db.from("prestacoes_contas")
      .select("organization_id, regime_id, data_aprovacao, data_liberacao, data_inicio_execucao, data_fim_execucao")
      .eq("id", prestacaoId).single());
  if (!prestacao) throw new Error("prestacao_inexistente");

  const [regimeLinha, versao, despesas, pagamentos, lancamentos, alteracoes] = await Promise.all([
    prestacao.regime_id
      ? uma<{ parametros: unknown }>(db.from("prestacao_regimes").select("parametros").eq("id", prestacao.regime_id).maybeSingle())
      : Promise.resolve(null),
    uma<{ id: string }>(db.from("prestacao_orcamento_versoes").select("id").eq("prestacao_id", prestacaoId).eq("ativa", true).maybeSingle()),
    todas<EstadoDaPrestacao["despesas"][number]>(() => db.from("prestacao_comprovantes")
      .select("id, nome_arquivo, status, no_id, tipo, data_doc, valor_extraido, valor_liquido, fornecedor_id, numero_documento, chave_acesso, iss, inss, irrf, outras_retencoes, identificacao_projeto, justificativa")
      .eq("prestacao_id", prestacaoId).order("id")),
    todas<EstadoDaPrestacao["pagamentos"][number]>(() => db.from("prestacao_pagamentos")
      .select("id, despesa_id, lancamento_id, forma, data, valor, favorecido_documento, numero_documento")
      .eq("prestacao_id", prestacaoId).order("id")),
    todas<EstadoDaPrestacao["lancamentos"][number]>(() => db.from("prestacao_lancamentos")
      .select("id, data, natureza, valor, historico, numero_documento, numero_normalizado, categoria")
      .eq("prestacao_id", prestacaoId).order("id")),
    todas<AlteracaoDoEstado>(() => db.from("prestacao_alteracoes")
      .select("id, numero, status, solicitada_em").eq("prestacao_id", prestacaoId).order("id")),
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
    hoje,
  };
}
