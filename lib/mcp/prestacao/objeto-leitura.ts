import type { Admin } from "@/lib/mcp/crm";
import { lerTodas } from "@/lib/mcp/prestacao/leitura";
import { erroDoBanco } from "@/lib/mcp/validacao";
import { periodoDoLocal, quantidade, resumoDaMeta, rotuloDoLocal, STATUS_LOCAL } from "@/lib/prestacao/objeto";

/**
 * O objeto da prestação como o assistente lê (a aba Objeto e a aba Atividades do app): as metas com o previsto, o
 * realizado e o que falta justificar; os locais de realização; e as atividades, paginadas. Os números da meta vêm da mesma
 * conta da tela (resumoDaMeta), então o assistente nunca recalcula.
 */

export const COLUNAS_DA_META = "id,descricao,unidade,previsto,realizado,justificativa,ordem";
export const COLUNAS_DO_LOCAL = "id,pais,uf,municipio,espaco,inicio,fim,status,justificativa,ordem";
export const COLUNAS_DA_ATIVIDADE =
  "id,titulo,descricao,data_realizacao,data_inicio,data_fim,local,cidade,estado,publico_atingido,meta_prevista,empregos_diretos,empregos_indiretos," +
  "democratizacao_descricao,acessibilidade_descricao,status_realizacao,justificativa_nao_realizacao,meta_id,local_id,ordem";

export interface MetaLida {
  id: string;
  descricao: string;
  unidade: string | null;
  previsto: number | string;
  realizado: number | string | null;
  justificativa: string | null;
  ordem: number;
}

export interface LocalLido {
  id: string;
  pais: string;
  uf: string | null;
  municipio: string | null;
  espaco: string | null;
  inicio: string | null;
  fim: string | null;
  status: "previsto" | "realizado" | "nao_realizado" | "outras_fontes";
  justificativa: string | null;
  ordem: number;
}

export interface AtividadeLida {
  id: string;
  titulo: string;
  descricao: string | null;
  data_realizacao: string;
  data_inicio: string | null;
  data_fim: string | null;
  local: string | null;
  cidade: string | null;
  estado: string | null;
  publico_atingido: number | null;
  meta_prevista: number | null;
  empregos_diretos: number | null;
  empregos_indiretos: number | null;
  democratizacao_descricao: string | null;
  acessibilidade_descricao: string | null;
  status_realizacao: "realizado" | "nao_realizado";
  justificativa_nao_realizacao: string | null;
  meta_id: string | null;
  local_id: string | null;
  ordem: number;
}

const numeroOuNulo = (valor: number | string | null) => (valor === null || valor === undefined ? null : Number(valor));

/** Um texto longo cortado para caber na resposta; `cortado` avisa que há mais no app. */
function recortar(texto: string | null | undefined, limite: number): { texto: string | null; cortado: boolean } {
  if (texto === null || texto === undefined) return { texto: null, cortado: false };
  return texto.length <= limite ? { texto, cortado: false } : { texto: `${texto.slice(0, limite).trimEnd()}…`, cortado: true };
}

export function metaParaOAssistente(meta: MetaLida, atividades: readonly Pick<AtividadeLida, "meta_id" | "status_realizacao" | "publico_atingido">[]) {
  const previsto = Number(meta.previsto);
  const realizado = numeroOuNulo(meta.realizado);
  const resumo = resumoDaMeta({ id: meta.id, previsto, realizado, justificativa: meta.justificativa }, atividades);
  const justificativa = recortar(meta.justificativa, 600);
  return {
    meta_id: meta.id,
    descricao: meta.descricao,
    unidade: meta.unidade,
    previsto,
    realizado,
    em_texto: { previsto: quantidade(previsto, meta.unidade), realizado: realizado === null ? null : quantidade(realizado, meta.unidade) },
    situacao: resumo.situacao,
    percentual: resumo.percentual,
    falta_justificativa: resumo.faltaJustificativa,
    justificativa: justificativa.texto,
    ...(justificativa.cortado ? { justificativa_cortada: true } : {}),
    atividades_ligadas: resumo.atividades,
    atividades_realizadas: resumo.realizadas,
    publico_nas_atividades: resumo.publico,
  };
}

export function localParaOAssistente(local: LocalLido) {
  return {
    local_id: local.id,
    local: rotuloDoLocal(local),
    espaco: local.espaco,
    periodo: periodoDoLocal(local),
    situacao: local.status,
    situacao_em_texto: STATUS_LOCAL.find(s => s.id === local.status)?.rotulo ?? local.status,
    justificativa: local.justificativa,
  };
}

export function atividadeParaOAssistente(a: AtividadeLida) {
  const descricao = recortar(a.descricao, 300);
  const democratizacao = recortar(a.democratizacao_descricao, 200);
  const acessibilidade = recortar(a.acessibilidade_descricao, 200);
  return {
    atividade_id: a.id,
    titulo: a.titulo,
    data: a.data_realizacao,
    ...(a.data_inicio || a.data_fim ? { periodo: { inicio: a.data_inicio, fim: a.data_fim } } : {}),
    situacao: a.status_realizacao,
    ...(a.status_realizacao === "nao_realizado" ? { justificativa_da_nao_realizacao: a.justificativa_nao_realizacao } : {}),
    descricao: descricao.texto,
    local: a.local,
    cidade: a.cidade,
    estado: a.estado,
    publico_atingido: a.publico_atingido,
    publico_previsto: a.meta_prevista,
    empregos_diretos: a.empregos_diretos,
    empregos_indiretos: a.empregos_indiretos,
    democratizacao: democratizacao.texto,
    acessibilidade: acessibilidade.texto,
    ...(descricao.cortado || democratizacao.cortado || acessibilidade.cortado ? { textos_cortados: true } : {}),
    meta_id: a.meta_id,
    local_id: a.local_id,
  };
}

export async function lerObjeto(admin: Admin, prestacaoId: string, pagina: { limite: number; deslocamento: number }) {
  const [metas, locais, leves, paginaDeAtividades] = await Promise.all([
    lerTodas<MetaLida>(() => admin.from("prestacao_metas").select(COLUNAS_DA_META).eq("prestacao_id", prestacaoId).order("ordem").order("id") as never),
    lerTodas<LocalLido>(() => admin.from("prestacao_locais").select(COLUNAS_DO_LOCAL).eq("prestacao_id", prestacaoId).order("ordem").order("id") as never),
    lerTodas<Pick<AtividadeLida, "meta_id" | "status_realizacao" | "publico_atingido">>(() =>
      admin.from("prestacao_atividades").select("id,meta_id,status_realizacao,publico_atingido").eq("prestacao_id", prestacaoId).order("id") as never),
    admin
      .from("prestacao_atividades")
      .select(COLUNAS_DA_ATIVIDADE, { count: "exact" })
      .eq("prestacao_id", prestacaoId)
      .order("data_realizacao", { ascending: true })
      .order("id", { ascending: true })
      .range(pagina.deslocamento, pagina.deslocamento + pagina.limite - 1),
  ]);
  if (paginaDeAtividades.error) throw erroDoBanco(paginaDeAtividades.error);
  const atividades = (paginaDeAtividades.data ?? []) as unknown as AtividadeLida[];
  const total = paginaDeAtividades.count ?? atividades.length;
  return {
    metas: metas.map(meta => metaParaOAssistente(meta, leves)),
    locais: locais.map(localParaOAssistente),
    atividades: atividades.map(atividadeParaOAssistente),
    total_de_atividades: total,
    proximo_deslocamento: pagina.deslocamento + pagina.limite < total ? pagina.deslocamento + pagina.limite : null,
  };
}
