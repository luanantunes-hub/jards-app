// Regras do MultiSelectDropdown fora do componente, para testar sem React.
import { chaveDoNome } from "./dominio";

export type OpcaoMultipla = {
  value: string;
  label: string;
  /** Opções do mesmo grupo ficam juntas, sob o título dele. */
  grupo?: string;
  /** Texto a mais que a busca também procura (a sigla do estado, por exemplo). */
  busca?: string;
  /** Número mostrado à direita da opção. */
  contagem?: number;
  /** Não dá para marcar; se já estiver marcada, ainda dá para desmarcar. */
  disabled?: boolean;
};

/** Sem acento, em minúsculas e com espaços únicos: o jeito de comparar o que a pessoa digita com os rótulos. */
export function textoDeBusca(valor: string): string {
  return chaveDoNome(valor).replace(/\s+/g, " ");
}

/** Mantém as opções cujo rótulo, grupo ou texto de busca contém o que foi digitado. */
export function filtrarOpcoes<T extends OpcaoMultipla>(opcoes: readonly T[], termo: string): T[] {
  const busca = textoDeBusca(termo);
  if (!busca) return [...opcoes];
  return opcoes.filter((o) => textoDeBusca(`${o.label} ${o.grupo ?? ""} ${o.busca ?? ""}`).includes(busca));
}

/** Junta as opções por grupo, na ordem em que cada grupo aparece; sem grupo, tudo fica num bloco só. */
export function agruparOpcoes<T extends OpcaoMultipla>(opcoes: readonly T[]): { grupo: string | null; itens: T[] }[] {
  const porGrupo = new Map<string | null, T[]>();
  for (const opcao of opcoes) {
    const grupo = opcao.grupo ?? null;
    const itens = porGrupo.get(grupo);
    if (itens) itens.push(opcao);
    else porGrupo.set(grupo, [opcao]);
  }
  return [...porGrupo].map(([grupo, itens]) => ({ grupo, itens }));
}

/** Marca o valor que está desmarcado e desmarca o que está marcado. */
export function alternar(valores: readonly string[], valor: string): string[] {
  return valores.includes(valor) ? valores.filter((v) => v !== valor) : [...valores, valor];
}

/** Texto do botão: o rótulo sem nada escolhido, o nome da única escolhida ou o resumo de várias. */
export function rotuloDoBotao(
  opcoes: readonly { value: string; label: string }[],
  valores: readonly string[],
  placeholder: string,
  rotuloVarias: (quantidade: number) => string,
): string {
  if (valores.length === 0) return placeholder;
  if (valores.length === 1) return opcoes.find((o) => o.value === valores[0])?.label ?? rotuloVarias(1);
  return rotuloVarias(valores.length);
}
