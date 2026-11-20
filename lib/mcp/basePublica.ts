import type { Admin, Linha } from "@/lib/mcp/crm";
import type { Uf } from "@/lib/mcp/ufs";
import { erroDoBanco } from "@/lib/mcp/validacao";

/** Desbloquear os contatos de uma empresa da base pública custa sempre 1 crédito da organização (e só na primeira vez). */
export const CUSTO_DO_DESBLOQUEIO_EM_CREDITOS = 1;
/** Quantas empresas da base pública uma única chamada em lote aceita. */
export const MAX_EMPRESAS_POR_LOTE = 50;

export interface FiltrosDaBasePublica {
  orgId: string | null;
  busca: string | null;
  cidade: string | null;
  estado: Uf | null;
  setor: string | null;
  limite: number;
  deslocamento: number;
}

export interface EmpresaPublica {
  id: string;
  nome: string;
  site: string | null;
  cidade: string | null;
  estado: string | null;
  setor: string | null;
  tem_detalhe: boolean;
  contatos_disponiveis: number;
  contatos_liberados: boolean;
}

/**
 * Busca na base pública (sem diferenciar acento nem caixa), uma página por vez. `total` é a contagem de todo o
 * resultado, não só desta página.
 */
export async function buscarBasePublica(admin: Admin, filtros: FiltrosDaBasePublica): Promise<{ empresas: EmpresaPublica[]; total: number }> {
  const chamar = async (limite: number, deslocamento: number) => {
    const { data, error } = await admin.rpc("fn_buscar_empresas_publicas", {
      p_organization_id: filtros.orgId,
      p_busca: filtros.busca,
      p_cidade: filtros.cidade,
      p_estado: filtros.estado,
      p_setor: filtros.setor,
      p_limite: limite,
      p_deslocamento: deslocamento,
    });
    if (error) throw erroDoBanco(error);
    return (data ?? []) as Array<EmpresaPublica & { total: number | string }>;
  };

  const linhas = await chamar(filtros.limite, filtros.deslocamento);
  let total = linhas.length > 0 ? Number(linhas[0].total) : 0;
  // Página além do fim do resultado: não há linha para trazer a contagem, então pergunta a primeira.
  if (linhas.length === 0 && filtros.deslocamento > 0) {
    const primeira = await chamar(1, 0);
    total = primeira.length > 0 ? Number(primeira[0].total) : 0;
  }
  const empresas = linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    site: linha.site,
    cidade: linha.cidade,
    estado: linha.estado,
    setor: linha.setor,
    tem_detalhe: linha.tem_detalhe,
    contatos_disponiveis: linha.contatos_disponiveis,
    contatos_liberados: linha.contatos_liberados,
  }));
  return { empresas, total };
}

/** Créditos que custa liberar os contatos desta empresa: 0 se não há contatos ou já estão liberados. */
export function custoParaVerContatos(empresa: Pick<EmpresaPublica, "contatos_disponiveis" | "contatos_liberados">): number {
  return empresa.contatos_disponiveis === 0 || empresa.contatos_liberados ? 0 : CUSTO_DO_DESBLOQUEIO_EM_CREDITOS;
}

export function fichaDaEmpresaPublica(empresa: EmpresaPublica) {
  return {
    id: empresa.id,
    nome: empresa.nome,
    site: empresa.site,
    cidade: empresa.cidade,
    estado: empresa.estado,
    setor: empresa.setor,
    contatos_disponiveis: empresa.contatos_disponiveis,
    contatos_liberados: empresa.contatos_liberados,
    custo_para_ver_contatos: custoParaVerContatos(empresa),
  };
}

export async function creditosDisponiveis(admin: Admin, orgId: string): Promise<number> {
  const { data, error } = await admin.rpc("fn_creditos_disponiveis", { p_organization_id: orgId });
  if (error) throw erroDoBanco(error);
  return typeof data === "number" ? data : 0;
}

/** Empresas da base pública por id, com a situação dos contatos para a organização. */
export async function empresasPublicasPorId(admin: Admin, orgId: string, ids: readonly string[]): Promise<EmpresaPublica[]> {
  if (ids.length === 0) return [];
  const [empresas, contatos, desbloqueios] = await Promise.all([
    admin.from("empresas").select("id,nome,site,cidade,estado,setor,tem_detalhe").in("id", [...ids]),
    admin.from("responsaveis").select("empresa_id").in("empresa_id", [...ids]),
    admin.from("desbloqueios").select("empresa_pub_id").eq("organization_id", orgId).in("empresa_pub_id", [...ids]),
  ]);
  for (const resultado of [empresas, contatos, desbloqueios]) if (resultado.error) throw erroDoBanco(resultado.error);

  const quantidade = new Map<string, number>();
  for (const linha of (contatos.data ?? []) as Linha[]) quantidade.set(linha.empresa_id as string, (quantidade.get(linha.empresa_id as string) ?? 0) + 1);
  const liberadas = new Set(((desbloqueios.data ?? []) as Linha[]).map((linha) => linha.empresa_pub_id as string));

  return ((empresas.data ?? []) as Linha[]).map((linha) => ({
    id: linha.id as string,
    nome: linha.nome as string,
    site: (linha.site as string | null) ?? null,
    cidade: (linha.cidade as string | null) ?? null,
    estado: linha.estado ? String(linha.estado).trim() : null,
    setor: (linha.setor as string | null) ?? null,
    tem_detalhe: Boolean(linha.tem_detalhe),
    contatos_disponiveis: quantidade.get(linha.id as string) ?? 0,
    contatos_liberados: !linha.tem_detalhe || liberadas.has(linha.id as string),
  }));
}
