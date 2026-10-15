// Caminhos dos arquivos da produção no bucket "documentos" (PD0.14).
//
// Fonte única para o app (via lib/producao/armazenamento.ts) e para as edge
// functions. Sem imports, para rodar igual no Deno, no Node e no navegador.
//
// Formato: {organizationId}/producoes/{temporadaId}/{pasta}/{arquivoId}.{ext}
// A primeira pasta precisa ser o ID da organização e a segunda, `producoes`: é o
// que as regras do bucket (migration producao_arquivos_armazenamento) leem para
// dar ou negar o acesso. A pasta é uma das nove abaixo e a extensão, uma das
// aceitas. Tudo em minúsculas, sem outra forma: um objeto, um único jeito de
// escrever o caminho dele.
//
// As duas listas (pastas e extensões) moram só aqui. O banco as repete em
// `fn_producao_caminho_partes` (a mesma expressão, PADRAO_DO_CAMINHO) e nas
// restrições de `producao_arquivos`; tests/producao-arquivos-sql.test.ts compara
// as duas pontas, e acrescentar uma pasta ou uma extensão pede uma migration
// (create or replace da função) e a mudança aqui.

/** O bucket que guarda os arquivos da produção, ao lado dos da prestação. */
export const BUCKET_DOS_ARQUIVOS = "documentos";

/** O segundo segmento do caminho: o que separa a produção da prestação, dos fornecedores e do resto. */
export const RAIZ_DOS_ARQUIVOS = "producoes";

/**
 * As pastas fixas de uma temporada. `pessoas` guarda o documento de uma pessoa
 * (passaporte, RG, saúde): só o admin e quem vê o dinheiro da produção a abrem.
 */
export type PastaDeArquivo =
  | "datas"
  | "pessoas"
  | "acordos"
  | "plantas"
  | "itens"
  | "documentos"
  | "deslocamentos"
  | "hospedagem"
  | "recebidos";

// A lista sai do objeto abaixo: esquecer uma pasta do tipo, ou sobrar uma, não compila.
const PASTAS_POR_ID: Record<PastaDeArquivo, true> = {
  datas: true,
  pessoas: true,
  acordos: true,
  plantas: true,
  itens: true,
  documentos: true,
  deslocamentos: true,
  hospedagem: true,
  recebidos: true,
};
export const PASTAS_DE_ARQUIVO: readonly PastaDeArquivo[] = Object.keys(PASTAS_POR_ID) as PastaDeArquivo[];

/** As pastas de dado pessoal: o banco as abre só ao admin e a quem tem a permissão `dinheiro`. */
export const PASTAS_SENSIVEIS: readonly PastaDeArquivo[] = ["pessoas"];

/**
 * As extensões aceitas (em minúsculas). Documentos, planilhas, apresentações,
 * fotos, plantas de CAD, áudio, vídeo e pacote compactado. Ficam de fora de
 * propósito o que o navegador abriria como página ou programa no endereço do
 * armazenamento (html, svg, js) e os executáveis. O bucket não limita o tipo do
 * arquivo; esta lista, repetida no banco, é o único freio.
 */
export const EXTENSOES_ACEITAS = [
  "pdf", "doc", "docx", "odt", "rtf", "txt",
  "xls", "xlsx", "ods", "csv",
  "ppt", "pptx", "odp",
  "jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "tif", "tiff",
  "dwg", "dxf",
  "mp3", "wav", "m4a", "mp4", "mov",
  "zip",
] as const;
export type ExtensaoAceita = (typeof EXTENSOES_ACEITAS)[number];

const UUID_MINUSCULO = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * A forma de um caminho, em texto: o app a compila em uma expressão regular e a
 * migration a escreve igual em `fn_producao_caminho_partes`. Âncoras nas duas
 * pontas, quatro identificadores em minúsculas, a raiz, a pasta e a extensão da
 * lista: sem `..`, sem barra a mais ou a menos, sem maiúscula, sem espaço.
 */
export const PADRAO_DO_CAMINHO =
  `^(${UUID_MINUSCULO})/${RAIZ_DOS_ARQUIVOS}/(${UUID_MINUSCULO})/(${PASTAS_DE_ARQUIVO.join("|")})/(${UUID_MINUSCULO})\\.(${EXTENSOES_ACEITAS.join("|")})$`;

const FORMA_DO_CAMINHO = new RegExp(PADRAO_DO_CAMINHO);

export type CaminhoProducao = {
  organizationId: string;
  temporadaId: string;
  pasta: PastaDeArquivo;
  arquivoId: string;
  extensao: ExtensaoAceita;
};

const UUID_QUALQUER_CAIXA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_QUALQUER_CAIXA.test(valor);
}

export function ehPastaDeArquivo(valor: unknown): valor is PastaDeArquivo {
  return typeof valor === "string" && (PASTAS_DE_ARQUIVO as readonly string[]).includes(valor);
}

export function pastaEhSensivel(pasta: PastaDeArquivo): boolean {
  return PASTAS_SENSIVEIS.includes(pasta);
}

/** Extensão em minúsculas, só letras e números; "bin" quando não houver uma utilizável. */
export function extensaoDoArquivo(nome: string): string {
  const partes = nome.split(".");
  const ext = partes.length > 1 ? partes[partes.length - 1].toLowerCase() : "";
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
}

export function extensaoAceita(extensao: unknown): extensao is ExtensaoAceita {
  return typeof extensao === "string" && (EXTENSOES_ACEITAS as readonly string[]).includes(extensao);
}

/**
 * Monta o caminho de um arquivo novo. O nome original não entra no caminho
 * (fica só na tabela), para não expor dados pessoais nem quebrar a URL. Recusa
 * (com erro) identificador que não é UUID, pasta que não é uma das fixas e
 * extensão fora da lista: quem chama confere a extensão antes, com
 * `extensaoAceita(extensaoDoArquivo(nome))`, para dizer à pessoa o que houve.
 */
export function montarCaminhoProducao(params: {
  organizationId: string;
  temporadaId: string;
  pasta: PastaDeArquivo;
  nomeOriginal: string;
  arquivoId?: string;
}): string {
  const { organizationId, temporadaId, pasta, nomeOriginal } = params;
  const arquivoId = params.arquivoId ?? globalThis.crypto.randomUUID();
  if (!ehUuid(organizationId)) throw new Error("Organização inválida para o caminho do arquivo");
  if (!ehUuid(temporadaId)) throw new Error("Temporada inválida para o caminho do arquivo");
  if (!ehUuid(arquivoId)) throw new Error("Identificador de arquivo inválido");
  if (!ehPastaDeArquivo(pasta)) throw new Error("Pasta desconhecida para o caminho do arquivo");
  const extensao = extensaoDoArquivo(nomeOriginal);
  if (!extensaoAceita(extensao)) throw new Error("Tipo de arquivo não aceito na produção");
  return [
    organizationId.toLowerCase(),
    RAIZ_DOS_ARQUIVOS,
    temporadaId.toLowerCase(),
    pasta,
    `${arquivoId.toLowerCase()}.${extensao}`,
  ].join("/");
}

/** Lê um caminho no formato acima; devolve null para qualquer outro formato. */
export function lerCaminhoProducao(caminho: unknown): CaminhoProducao | null {
  if (typeof caminho !== "string") return null;
  const achado = FORMA_DO_CAMINHO.exec(caminho);
  if (!achado) return null;
  const [, organizationId, temporadaId, pasta, arquivoId, extensao] = achado;
  return {
    organizationId,
    temporadaId,
    pasta: pasta as PastaDeArquivo,
    arquivoId,
    extensao: extensao as ExtensaoAceita,
  };
}
