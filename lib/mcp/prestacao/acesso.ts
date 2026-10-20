import { MODULO_PRESTACAO, PAPEIS_DA_EQUIPE_NA_PRESTACAO } from "@/lib/mcp/prestacao/enums";

export interface MembroDaPrestacao {
  organization_id: string;
  papel: string | null;
  modulos_acesso: string[] | null;
  prestacao_funcao?: string | null;
}

export interface ModulosDaOrganizacao {
  id: string;
  nome?: string | null;
  modulos_ativos: string[] | null;
  modulos_leitura: string[] | null;
}

export interface AcessoNaOrganizacao {
  organizationId: string;
  nome: string | null;
  papel: string;
  funcao: string | null;
  /** Módulo em vigor (teste gratuito, assinatura ou atraso na carência): grava e consulta. Falso = só consulta. */
  emVigor: boolean;
}

export interface AcessoPrestacao {
  /** Organizações em que a pessoa usa a prestação (em vigor ou só para consulta). */
  organizationIds: string[];
  /** As de organizationIds com o módulo em vigor: só nelas o conector grava. */
  emVigorIds: string[];
  porOrganizacao: Record<string, AcessoNaOrganizacao>;
}

/**
 * Onde a pessoa usa a prestação pelo conector. É a regra do banco (can_access_prestacao e as políticas de leitura
 * sem assinatura), porque o conector lê com a chave de serviço, que ignora o RLS: a pessoa é da equipe com o módulo
 * liberado no vínculo dela, e a organização tem o módulo em vigor (modulos_ativos) ou só para consulta (modulos_leitura).
 * Quem não tem o módulo no vínculo (null ou lista sem prestacao) não entra, ao contrário da captação, onde null vale.
 */
export function acessoDaPrestacao(membros: readonly MembroDaPrestacao[], organizacoes: readonly ModulosDaOrganizacao[]): AcessoPrestacao {
  const porId = new Map(organizacoes.map((organizacao) => [organizacao.id, organizacao]));
  const resultado: AcessoPrestacao = { organizationIds: [], emVigorIds: [], porOrganizacao: {} };

  for (const membro of membros) {
    const papel = membro.papel;
    if (!papel || !(PAPEIS_DA_EQUIPE_NA_PRESTACAO as readonly string[]).includes(papel)) continue;
    if (!membro.modulos_acesso?.includes(MODULO_PRESTACAO)) continue;

    const organizacao = porId.get(membro.organization_id);
    if (!organizacao) continue;
    const emVigor = organizacao.modulos_ativos?.includes(MODULO_PRESTACAO) === true;
    const soConsulta = organizacao.modulos_leitura?.includes(MODULO_PRESTACAO) === true;
    if (!emVigor && !soConsulta) continue;
    if (resultado.porOrganizacao[membro.organization_id]) continue;

    resultado.organizationIds.push(membro.organization_id);
    if (emVigor) resultado.emVigorIds.push(membro.organization_id);
    resultado.porOrganizacao[membro.organization_id] = {
      organizationId: membro.organization_id,
      nome: organizacao.nome ?? null,
      papel,
      funcao: membro.prestacao_funcao ?? null,
      emVigor,
    };
  }
  return resultado;
}

/** O papel e a função da pessoa permitem editar a prestação? Espelha auth_prestacao_papel_permite(papel, funcao, 'editar'). */
export function podeEditarNaPrestacao(papel: string): boolean {
  return papel === "admin" || papel === "colaborador" || papel === "visualizador";
}
