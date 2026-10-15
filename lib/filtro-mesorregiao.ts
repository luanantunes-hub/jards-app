// Regras do filtro de mesorregião da tela de Patrocinadores, fora do componente para testar sem React.
import type { OpcaoMultipla } from "./multi-select";

/** Uma linha de fn_mesorregioes_com_empresas: a mesorregião e quantas empresas a aba lista nela. */
export type MesorregiaoComEmpresas = { mesorregiao_id: number; nome: string; uf: string; empresas: number };

export const NOME_DO_ESTADO: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso",
  PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

function nomeDoEstado(uf: string): string {
  return NOME_DO_ESTADO[uf] ?? uf;
}

/**
 * Opções do seletor: só as do estado escolhido (todas quando não há), em ordem de estado e de nome. Com o estado
 * escolhido o título do grupo sai, porque todas são dele. Sem empresas na aba, a opção não pode ser marcada.
 */
export function opcoesDeMesorregiao(lista: readonly MesorregiaoComEmpresas[], uf: string): OpcaoMultipla[] {
  return lista
    .filter((m) => !uf || m.uf === uf)
    .sort((a, b) => nomeDoEstado(a.uf).localeCompare(nomeDoEstado(b.uf), "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((m) => ({
      value: String(m.mesorregiao_id),
      label: m.nome,
      grupo: uf ? undefined : nomeDoEstado(m.uf),
      busca: m.uf,
      contagem: m.empresas,
      disabled: m.empresas === 0,
    }));
}

/** Tira da seleção o que não está entre as opções permitidas; devolve a mesma lista quando nada sai. */
export function podarSelecao(selecionadas: number[], permitidas: readonly OpcaoMultipla[]): number[] {
  const validas = new Set(permitidas.map((o) => o.value));
  const mantidas = selecionadas.filter((id) => validas.has(String(id)));
  return mantidas.length === selecionadas.length ? selecionadas : mantidas;
}

/** Lê "4110,4106" da URL; ignora o que não é código inteiro positivo e não repete. */
export function lerSelecaoDaUrl(valor: string | null): number[] {
  if (!valor) return [];
  const ids = valor
    .split(",")
    .map((parte) => parte.trim())
    .filter((parte) => /^\d+$/.test(parte))
    .map(Number)
    .filter((id) => id > 0);
  return [...new Set(ids)];
}
