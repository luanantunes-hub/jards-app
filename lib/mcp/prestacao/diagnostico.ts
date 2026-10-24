/** A pasta dos arquivos de teste do diagnóstico de envio: por organização, e nunca na pasta das prestações. */
export function pastaDoDiagnostico(orgId: string): string {
  return `diagnostico-mcp/${orgId}`;
}

/** Onde o arquivo de teste de um diagnóstico fica no bucket. */
export function caminhoDoDiagnostico(orgId: string, arquivoId: string): string {
  return `${pastaDoDiagnostico(orgId)}/${arquivoId}.bin`;
}

/** A pasta do diagnóstico da organização e o nome do arquivo, para listar o tamanho antes de baixar. */
export function pastaENomeDoDiagnostico(orgId: string, arquivoId: string): { pasta: string; nome: string } {
  return { pasta: pastaDoDiagnostico(orgId), nome: `${arquivoId}.bin` };
}

/** Arquivo de teste que ninguém conferiu dentro de um dia é lixo: sai na próxima preparação. */
export const IDADE_MAXIMA_DO_TESTE_MS = 24 * 60 * 60 * 1000;

/** Dos arquivos da pasta de diagnóstico, os que já passaram da idade máxima (nomes, para remover). */
export function arquivosDeTesteVencidos(arquivos: ReadonlyArray<{ name: string; created_at?: string | null }>, agora: number): string[] {
  return arquivos
    .filter((arquivo) => {
      const criado = arquivo.created_at ? new Date(arquivo.created_at).getTime() : NaN;
      return Number.isFinite(criado) && agora - criado > IDADE_MAXIMA_DO_TESTE_MS;
    })
    .map((arquivo) => arquivo.name);
}
