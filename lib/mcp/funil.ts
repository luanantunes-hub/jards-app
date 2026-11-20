import { DESFECHOS_INSCRICAO, DESFECHOS_NEGOCIACAO, etapaInicial } from "@/lib/etapas";
import { DEFAULT_ETIQUETAS_CAPTACAO, DEFAULT_ETIQUETAS_INSCRICAO, type Etiqueta } from "@/lib/etiquetas-padrao";
import { CANAIS_PADRAO, ORIGENS_PADRAO, RESULTADOS_PADRAO, type TuplaTaxonomia } from "@/lib/taxonomias-padrao";
import type { Admin } from "@/lib/mcp/crm";
import { ErroMcp, erroDoBanco } from "@/lib/mcp/validacao";

export interface EtapaDoFunil {
  chave: string;
  nome: string;
  /** Etapa que encerra o caso (aprovado, recusado...): tem fluxo próprio no app e não é escolhida ao cadastrar. */
  desfecho: boolean;
}

export interface OpcaoComercial {
  chave: string;
  nome: string;
}

type LinhaEtiqueta = { entidade: string; key: string; label: string; ordem: number };

/**
 * Mesma regra do contexto da tela (contexts/EtiquetasContext.tsx): as etapas padrão, menos as que a organização
 * removeu e com o nome que ela deu; depois as etapas que ela criou, na ordem dela.
 */
export function combinarEtapas(
  padroes: readonly Etiqueta[],
  entidade: string,
  linhas: readonly LinhaEtiqueta[],
  removidas: ReadonlySet<string>,
  desfechos: readonly string[]
): EtapaDoFunil[] {
  const daEntidade = linhas.filter((linha) => linha.entidade === entidade);
  const chavesPadrao = new Set(padroes.map((padrao) => padrao.key));
  const base = padroes
    .filter((padrao) => !removidas.has(`${entidade}:${padrao.key}`))
    .map((padrao) => ({ chave: padrao.key, nome: daEntidade.find((linha) => linha.key === padrao.key)?.label ?? padrao.label }));
  const proprias = daEntidade
    .filter((linha) => !chavesPadrao.has(linha.key) && !removidas.has(`${entidade}:${linha.key}`))
    .sort((a, b) => a.ordem - b.ordem)
    .map((linha) => ({ chave: linha.key, nome: linha.label }));
  return [...base, ...proprias].map((etapa) => ({ ...etapa, desfecho: desfechos.includes(etapa.chave) }));
}

export async function carregarFunil(admin: Admin, orgId: string): Promise<{ negociacao: EtapaDoFunil[]; inscricao: EtapaDoFunil[] }> {
  const [etiquetas, removidas] = await Promise.all([
    admin.from("etiquetas").select("entidade,key,label,ordem").eq("organization_id", orgId).in("entidade", ["captacao", "inscricao"]).order("ordem"),
    admin.from("funil_etapas_removidas").select("entidade,key").eq("organization_id", orgId),
  ]);
  if (etiquetas.error) throw erroDoBanco(etiquetas.error);
  if (removidas.error) throw erroDoBanco(removidas.error);
  const linhas = (etiquetas.data ?? []) as LinhaEtiqueta[];
  const ocultas = new Set((removidas.data ?? []).map((linha) => `${linha.entidade}:${linha.key}`));
  return {
    negociacao: combinarEtapas(DEFAULT_ETIQUETAS_CAPTACAO, "captacao", linhas, ocultas, DESFECHOS_NEGOCIACAO),
    inscricao: combinarEtapas(DEFAULT_ETIQUETAS_INSCRICAO, "inscricao", linhas, ocultas, DESFECHOS_INSCRICAO),
  };
}

type CategoriaComercial = "origem" | "canal" | "resultado";

const PADROES: Record<CategoriaComercial, readonly TuplaTaxonomia[]> = {
  origem: ORIGENS_PADRAO,
  canal: CANAIS_PADRAO,
  resultado: RESULTADOS_PADRAO,
};

type LinhaTaxonomia = { categoria: string; chave: string; label: string; ordem: number; ativo: boolean };

/** Mesma regra do contexto da tela: o que a organização cadastrou vem antes dos padrões que ela não repetiu. */
export function combinarOpcoes(categoria: CategoriaComercial, linhas: readonly LinhaTaxonomia[]): OpcaoComercial[] {
  const padroes = PADROES[categoria].map(([chave, nome], indice) => ({ chave, nome, ordem: (indice + 1) * 10 }));
  const proprias = linhas.filter((linha) => linha.categoria === categoria);
  if (proprias.length === 0) return padroes.map(({ chave, nome }) => ({ chave, nome }));
  const chaves = new Set(proprias.map((linha) => linha.chave));
  return [
    ...proprias.filter((linha) => linha.ativo).map((linha) => ({ chave: linha.chave, nome: linha.label, ordem: linha.ordem })),
    ...padroes.filter((padrao) => !chaves.has(padrao.chave)),
  ]
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ chave, nome }) => ({ chave, nome }));
}

export async function carregarOpcoesComerciais(
  admin: Admin,
  orgId: string
): Promise<Record<CategoriaComercial, OpcaoComercial[]>> {
  const { data, error } = await admin
    .from("crm_taxonomia_opcoes")
    .select("categoria,chave,label,ordem,ativo")
    .eq("organization_id", orgId)
    .in("categoria", ["origem", "canal", "resultado"])
    .order("ordem");
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as LinhaTaxonomia[];
  return {
    origem: combinarOpcoes("origem", linhas),
    canal: combinarOpcoes("canal", linhas),
    resultado: combinarOpcoes("resultado", linhas),
  };
}

/** Confere que a chave é uma opção da organização; a mensagem lista as válidas para o assistente corrigir. */
export function exigirOpcao(valor: string | null, opcoes: readonly OpcaoComercial[], campo: string): string | null {
  if (valor === null) return null;
  if (!opcoes.some((opcao) => opcao.chave === valor)) {
    throw new ErroMcp(400, `${campo} deve ser um destes: ${opcoes.map((opcao) => opcao.chave).join(", ")}.`);
  }
  return valor;
}

/** Etapa de uma negociação nova: a pedida (se existir e estiver em aberto) ou a primeira em aberto. */
export function escolherEtapaInicial(etapas: readonly EtapaDoFunil[], pedida: string | null): string {
  if (pedida) {
    const etapa = etapas.find((item) => item.chave === pedida);
    if (!etapa) throw new ErroMcp(400, `etapa deve ser uma destas: ${etapas.filter((item) => !item.desfecho).map((item) => item.chave).join(", ")}.`);
    if (etapa.desfecho) {
      throw new ErroMcp(400, "Aprovar ou recusar uma negociação só é possível no app (Fechar negócio): escolha uma etapa em aberto.");
    }
    return etapa.chave;
  }
  const inicial = etapaInicial(etapas.map((item) => ({ status: item.chave })), DESFECHOS_NEGOCIACAO, null);
  if (!inicial) throw new ErroMcp(400, "A organização não tem nenhuma etapa em aberto no funil de negociações.");
  return inicial;
}
