/**
 * O que a prestação aceita receber como arquivo, em módulo puro (sem Node): o servidor do conector e a página de envio,
 * que roda no navegador, usam a mesma regra em vez de cada um ter a sua.
 */

export const DESTINOS_DE_ENVIO = ["despesa", "evidencia"] as const;
export type DestinoDeEnvio = (typeof DESTINOS_DE_ENVIO)[number];

/** Mesmo teto do app para um arquivo da prestação (PDF, imagem, XML, planilha). */
export const LIMITE_DO_ARQUIVO_BYTES = 15 * 1024 * 1024;
/** Quantos arquivos cabem num envio: uma chamada ao assistente, ou um link de envio. */
export const MAX_ARQUIVOS_POR_ENVIO = 10;

/** Pelo nome, só para recusar cedo; quem decide de verdade é o conteúdo do arquivo (tipoPeloConteudo). */
export const ACEITO_PELO_NOME: Record<DestinoDeEnvio, RegExp> = {
  despesa: /\.(pdf|xml|jpe?g|png|webp|heic|heif)$/i,
  evidencia: /\.(pdf|jpe?g|png|gif|webp|heic|heif)$/i,
};

export const FRASE_ACEITA: Record<DestinoDeEnvio, string> = {
  despesa: "PDF, XML ou foto (JPG, PNG, WEBP ou HEIC)",
  evidencia: "PDF ou foto (JPG, PNG, GIF, WEBP ou HEIC)",
};

/** O atributo accept do seletor de arquivos da página de envio. */
export const ACCEPT_DO_SELETOR: Record<DestinoDeEnvio, string> = {
  despesa: ".pdf,.xml,image/*",
  evidencia: ".pdf,image/*",
};

export const ROTULO_DO_DESTINO: Record<DestinoDeEnvio, string> = {
  despesa: "Notas e comprovantes de despesa",
  evidencia: "Evidências do que foi realizado",
};

/** Por que este arquivo, escolhido na página, não pode seguir; null quando pode. */
export function problemaDoArquivo(destino: DestinoDeEnvio, nome: string, tamanho: number): string | null {
  if (!ACEITO_PELO_NOME[destino].test(nome.trim())) return `Aceitamos ${FRASE_ACEITA[destino]}.`;
  if (tamanho <= 0) return "O arquivo está vazio.";
  if (tamanho > LIMITE_DO_ARQUIVO_BYTES) return "O arquivo passa de 15 MB.";
  return null;
}

const EXTENSAO_DO_TIPO: Record<string, string> = {
  "application/pdf": "pdf",
  "application/xml": "xml",
  "text/xml": "xml",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

/**
 * O nome com que o arquivo escolhido na página segue. Alguns celulares entregam a foto sem extensão: aí vale o tipo que o
 * navegador informou. Quem decide de verdade o que o arquivo é continua sendo o conteúdo, conferido no servidor.
 */
export function nomeParaEnvio(nome: string, tipoMime: string): string {
  const limpo = nome.trim() || "arquivo";
  if (/\.[A-Za-z0-9]{1,8}$/.test(limpo)) return limpo;
  const extensao = EXTENSAO_DO_TIPO[tipoMime.toLowerCase()];
  return extensao ? `${limpo}.${extensao}` : limpo;
}
