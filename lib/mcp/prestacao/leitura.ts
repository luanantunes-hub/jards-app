import type { Admin } from "@/lib/mcp/crm";
import { hojeEmSaoPaulo } from "@/lib/mcp/datas";
import { COLUNAS_DA_PRESTACAO, type PrestacaoDoResumo } from "@/lib/mcp/prestacao/resumo";
import { ErroMcp, erroDoBanco } from "@/lib/mcp/validacao";
import { COLUNAS_DA_FILA } from "@/lib/mcp/prestacao/pendencias";
import { estadoDaPrestacao } from "@/lib/prestacao/checagens/estado";
import type { NoOrcamento } from "@/lib/prestacao/orcamento";
import { carregarDadosDoEnvio } from "@/lib/prestacao/dados-do-envio";
import type { EnvioDaLista } from "@/lib/prestacao/envios";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { regimeSchema } from "@/lib/prestacao/regimes/schema";

/** Mensagem única para "não existe" e "é de outra organização": quem pergunta não descobre a existência do que não é dele. */
export const PRESTACAO_NAO_ENCONTRADA = "Prestação não encontrada nesta organização. Confira o id com listar_prestacoes.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A prestação da organização, ou 404. Toda leitura por id passa por aqui antes de tocar em qualquer tabela filha:
 * o conector lê com a chave de serviço (sem o RLS do app), então é este filtro por organização que impede ver a prestação de outro.
 */
export async function prestacaoDaOrganizacao(admin: Admin, orgId: string, id: string | null): Promise<PrestacaoDoResumo> {
  if (!id || !UUID.test(id)) throw new ErroMcp(400, "Informe o id da prestação (um UUID de listar_prestacoes).");
  const { data, error } = await admin
    .from("prestacoes_contas")
    .select(COLUNAS_DA_PRESTACAO)
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw new ErroMcp(404, PRESTACAO_NAO_ENCONTRADA);
  return data as unknown as PrestacaoDoResumo;
}

export type RegimeLido = { id: string; codigo: string; nome: string; parametros: RegimeNormativo | null };

/** O regime da prestação com as regras já validadas pelo mesmo esquema que a tela usa; regra que não passa fica de fora em vez de quebrar. */
export async function regimeDaPrestacao(admin: Admin, regimeId: string | null): Promise<RegimeLido | null> {
  if (!regimeId) return null;
  const { data, error } = await admin.from("prestacao_regimes").select("id,codigo,nome,parametros").eq("id", regimeId).maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) return null;
  const linha = data as unknown as { id: string; codigo: string; nome: string; parametros: unknown };
  const lido = regimeSchema.safeParse(linha.parametros);
  return { id: linha.id, codigo: linha.codigo, nome: linha.nome, parametros: lido.success ? lido.data : null };
}

/** Tudo que a visão geral lê além do estado do motor de checagens: envios, aportes e verificações abertas. */
export async function leituraDoResumo(admin: Admin, prestacao: PrestacaoDoResumo, origem: string) {
  const [regime, estado, abertas, envios, carteira] = await Promise.all([
    regimeDaPrestacao(admin, prestacao.regime_id),
    estadoDaPrestacao(admin as never, prestacao.id),
    admin.from("prestacao_verificacoes").select("severidade").eq("prestacao_id", prestacao.id).eq("status", "aberta"),
    // Dos envios só interessa quais exercícios já têm prestação anual valendo: etapa, exercício e situação.
    admin.from("prestacao_envios").select("id,etapa,exercicio,situacao").eq("prestacao_id", prestacao.id),
    admin.from("prestacao_carteira").select("captado").eq("prestacao_id", prestacao.id).maybeSingle(),
  ]);
  for (const consulta of [abertas, envios, carteira]) if (consulta.error) throw erroDoBanco(consulta.error);

  const { dados: dadosDoEnvio } = await carregarDadosDoEnvio(admin as never, prestacao.id, estado);
  return {
    prestacao,
    regime,
    estado,
    dadosDoEnvio,
    envios: (envios.data ?? []) as unknown as EnvioDaLista[],
    verificacoesAbertas: (abertas.data ?? []) as unknown as { severidade: string }[],
    captado: Number((carteira.data as { captado?: number | string } | null)?.captado) || 0,
    hoje: hojeEmSaoPaulo(),
    origem,
  };
}

/**
 * O estado que o motor de checagens usa e os dados do checklist de envio de uma prestação já conferida, para quem monta
 * algo que depende dos dois (o relatório do objeto). Como leituraDoResumo, recebe a prestação inteira: o tipo é a garantia
 * de que prestacaoDaOrganizacao já conferiu a organização antes de qualquer leitura por id.
 */
export async function estadoEDadosDoEnvio(admin: Admin, prestacao: PrestacaoDoResumo) {
  const estado = await estadoDaPrestacao(admin as never, prestacao.id);
  const { dados, erro } = await carregarDadosDoEnvio(admin as never, prestacao.id, estado);
  return { estado, dadosDoEnvio: dados, erroDoEnvio: erro };
}

const PAGINA = 1000;

/** Todas as linhas de uma consulta, de mil em mil (o PostgREST corta em mil por resposta). */
export async function lerTodas<T>(consulta: () => PromiseLike<{ data: unknown; error: { message: string } | null }> & { range: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> }): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta().range(de, de + PAGINA - 1);
    if (error) throw erroDoBanco(error);
    const pagina = (data ?? []) as T[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA) return linhas;
  }
}

export type VersaoAtiva = { id: string; nome: string | null; tipo: string; ato: string | null; data_ato: string | null };

/** A versão do orçamento em uso e os nós dela (agrupadores e itens); sem versão ativa, a prestação ainda não tem orçamento. */
export async function orcamentoAtivo(admin: Admin, prestacaoId: string): Promise<{ versao: VersaoAtiva | null; nos: NoOrcamento[] }> {
  const { data, error } = await admin
    .from("prestacao_orcamento_versoes")
    .select("id,nome,tipo,ato,data_ato")
    .eq("prestacao_id", prestacaoId)
    .eq("ativa", true)
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  const versao = (data as VersaoAtiva | null) ?? null;
  if (!versao) return { versao: null, nos: [] };
  const nos = await lerTodas<NoOrcamento>(() => admin.from("prestacao_orcamento_nos").select(COLUNAS_DA_FILA.nos).eq("versao_id", versao.id).order("id") as never);
  return { versao, nos };
}
