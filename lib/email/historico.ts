/**
 * Consultas de busca do Gmail para trazer só as mensagens de quem está nos contatos.
 *
 * O Jards não varre a caixa: pede ao Gmail apenas o que tem um endereço de contato no De, Para ou Cc.
 * Cada consulta cobre vários endereços, mantida abaixo de um tamanho seguro para o Gmail aceitar.
 */

const ENDERECO = /^[^\s@"'(){}<>,;:\\]+@[^\s@"'(){}<>,;:\\]+\.[^\s@"'(){}<>,;:\\]+$/;

/** Endereços válidos, em minúsculas e sem repetição, na ordem em que vieram. */
export function enderecosParaBusca(brutos: ReadonlyArray<string | null | undefined>): string[] {
  const vistos = new Set<string>();
  for (const bruto of brutos) {
    const endereco = (bruto ?? "").trim().toLowerCase();
    if (endereco.length <= 254 && ENDERECO.test(endereco)) vistos.add(endereco);
  }
  return [...vistos];
}

function termosDoEndereco(endereco: string): string {
  return `from:${endereco} OR to:${endereco} OR cc:${endereco}`;
}

/**
 * Uma consulta por grupo de endereços: `<periodo> (from:a OR to:a OR cc:a OR from:b …)`.
 * `periodo` é um filtro do Gmail, como `newer_than:180d` ou `after:1763380800`.
 */
export function consultasDeContatos(
  enderecos: readonly string[],
  periodo: string,
  tamanhoMaximo = 900,
): string[] {
  const consultas: string[] = [];
  let termos: string[] = [];
  let tamanho = periodo.length + 4;
  for (const endereco of enderecos) {
    const termo = termosDoEndereco(endereco);
    if (termos.length > 0 && tamanho + termo.length + 4 > tamanhoMaximo) {
      consultas.push(`${periodo} (${termos.join(" OR ")})`);
      termos = [];
      tamanho = periodo.length + 4;
    }
    termos.push(termo);
    tamanho += termo.length + 4;
  }
  if (termos.length > 0) consultas.push(`${periodo} (${termos.join(" OR ")})`);
  return consultas;
}

/** Filtro do Gmail para "desde esta data": o Gmail lê segundos desde 1970. */
export function filtroDesde(data: Date): string {
  return `after:${Math.floor(data.getTime() / 1000)}`;
}
