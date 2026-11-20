// A folha sem internet (plano do módulo, PD1.13): a última versão que a pessoa convidada abriu fica salva no
// celular, por usuário, para reabrir sem rede ("Salva às 14:32"). Sem service worker: com login, guardar as
// respostas das funções basta. O que foi salvo some quando o servidor diz que o acesso acabou. Sem tela e sem banco.

export type ArmazenamentoSimples = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type Salvo<T> = { salvoEm: number; dados: T };

const PREFIXO = "jards:folha:";
const chaveDe = (usuario: string, nome: string) => `${PREFIXO}${usuario}:${nome}`;

export const CHAVE_DAS_DATAS = "datas";
export const chaveDaData = (dataId: string) => `data:${dataId}`;

/** Guarda o que veio do servidor, com a hora. Armazenamento cheio ou bloqueado não derruba a página. */
export function salvarNoCelular<T>(armazenamento: ArmazenamentoSimples, usuario: string, nome: string, dados: T, agoraMs: number): void {
  try {
    armazenamento.setItem(chaveDe(usuario, nome), JSON.stringify({ salvoEm: agoraMs, dados } satisfies Salvo<T>));
  } catch {
    // sem espaço ou em janela privada: a folha só não fica salva
  }
}

/** O que foi salvo, ou null se não há nada, se está corrompido ou se o armazenamento falha. */
export function lerDoCelular<T>(armazenamento: ArmazenamentoSimples, usuario: string, nome: string): Salvo<T> | null {
  try {
    const bruto = armazenamento.getItem(chaveDe(usuario, nome));
    if (!bruto) return null;
    const valor = JSON.parse(bruto) as Partial<Salvo<T>>;
    return typeof valor.salvoEm === "number" && valor.dados !== undefined ? { salvoEm: valor.salvoEm, dados: valor.dados } : null;
  } catch {
    return null;
  }
}

export function apagarDoCelular(armazenamento: ArmazenamentoSimples, usuario: string, nome: string): void {
  try {
    armazenamento.removeItem(chaveDe(usuario, nome));
  } catch {
    // nada a fazer
  }
}

/** A falha foi de rede (sem internet, servidor fora do ar) e não uma recusa do banco? Só nela vale mostrar o salvo. */
export function falhaDeRede(erro: { message?: string; code?: string } | null | undefined, onLine: boolean): boolean {
  if (!erro) return false;
  if (!onLine) return true;
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(erro.message ?? "");
}

export const CACHE_DA_CASCA = "folha-v1";

/**
 * Os arquivos estáticos do app que a página usou (nome com impressão digital, então nunca mudam), a partir das
 * entradas de desempenho do navegador. A página os guarda no cache da casca depois de carregar online: o que
 * foi baixado antes de o service worker assumir também fica salvo.
 */
export function arquivosDaCasca(urls: readonly string[], origem: string): string[] {
  const prefixo = `${origem}/_next/static/`;
  return [...new Set(urls.filter(url => url.startsWith(prefixo)))];
}
