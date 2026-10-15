/**
 * Grade de combinações de módulos para os testes de acesso: tudo o que as colunas do banco podem trazer
 * (nulo, vazio, um módulo, vários, o que a organização tem só para leitura) combinado com o que o vínculo
 * da pessoa permite. Os testes comparam o comportamento de antes e o de agora em cada combinação.
 */

/** O que `organizations.modulos_ativos` pode trazer. */
export const COLUNAS_ATIVOS: readonly unknown[] = [
  null,
  [],
  ["captacao"],
  ["captacao", "prestacao"],
  ["captacao", "producao"],
  ["captacao", "prestacao", "producao"],
  ["prestacao"],
];

/** O que `organizations.modulos_leitura` pode trazer (contrato que acabou, só para consultar). */
export const COLUNAS_LEITURA: readonly unknown[] = [null, [], ["prestacao"], ["producao"]];

/** O que `organization_members.modulos_acesso` pode trazer. */
export const COLUNAS_ACESSO: readonly unknown[] = [
  null,
  [],
  ["captacao"],
  ["prestacao"],
  ["producao"],
  ["captacao", "prestacao"],
  ["captacao", "producao"],
  ["prestacao", "producao"],
  ["captacao", "prestacao", "producao"],
];

/** Uma linha de `organization_members` com a organização embutida, como o PostgREST devolve. */
export type LinhaDeVinculo = {
  modulos_acesso: unknown;
  organizations: { modulos_ativos: unknown; modulos_leitura: unknown } | null;
};

/** Todos os vínculos possíveis com uma organização (252). */
export function linhasDeVinculo(): LinhaDeVinculo[] {
  const linhas: LinhaDeVinculo[] = [];
  for (const ativos of COLUNAS_ATIVOS) {
    for (const leitura of COLUNAS_LEITURA) {
      for (const acesso of COLUNAS_ACESSO) {
        linhas.push({ modulos_acesso: acesso, organizations: { modulos_ativos: ativos, modulos_leitura: leitura } });
      }
    }
  }
  return linhas;
}
