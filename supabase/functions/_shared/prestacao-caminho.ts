// Caminhos dos arquivos da prestação de contas no bucket "documentos".
//
// Fonte única para o app (via lib/prestacao/armazenamento.ts) e para as edge
// functions. Sem imports, para rodar igual no Deno, no Node e no navegador.
//
// Formato: {organizationId}/prestacoes/{prestacaoId}/{pasta}/{arquivoId}.{ext}
// A primeira pasta precisa ser o ID da organização: é o que as políticas do
// bucket exigem para upload, leitura e exclusão.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOME_ARQUIVO = /^[0-9a-f-]{36}\.[a-z0-9]{1,8}$/;

export type PastaPrestacao =
  | { tipo: "comprovantes" }
  | { tipo: "orcamento" }
  | { tipo: "alteracoes" }
  | { tipo: "extratos" }
  | { tipo: "evidencias" }
  | { tipo: "atividade"; atividadeId: string };

export type CaminhoPrestacao = {
  organizationId: string;
  prestacaoId: string;
  pasta: PastaPrestacao;
  arquivo: string;
};

type OrgRef = { organization_id?: string | null } | null | undefined;

export type PrestacaoComOrganizacao = {
  organization_id?: string | null;
  projeto?: OrgRef;
  captacao?: OrgRef;
} | null | undefined;

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

/** Extensão em minúsculas, só letras e números; "bin" quando não houver uma utilizável. */
export function extensaoDoArquivo(nome: string): string {
  const partes = nome.split(".");
  const ext = partes.length > 1 ? partes[partes.length - 1].toLowerCase() : "";
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
}

function segmentoDaPasta(pasta: PastaPrestacao): string {
  if (pasta.tipo === "atividade") {
    if (!ehUuid(pasta.atividadeId)) throw new Error("Atividade inválida para o caminho do arquivo");
    return `atividades/${pasta.atividadeId.toLowerCase()}`;
  }
  return pasta.tipo;
}

/**
 * Monta o caminho de um arquivo novo. O nome original não entra no caminho
 * (fica só na tabela), para não expor dados pessoais nem quebrar a URL.
 */
export function montarCaminhoPrestacao(params: {
  organizationId: string;
  prestacaoId: string;
  pasta: PastaPrestacao;
  nomeOriginal: string;
  arquivoId?: string;
}): string {
  const { organizationId, prestacaoId, pasta, nomeOriginal } = params;
  const arquivoId = params.arquivoId ?? globalThis.crypto.randomUUID();
  if (!ehUuid(organizationId)) throw new Error("Organização inválida para o caminho do arquivo");
  if (!ehUuid(prestacaoId)) throw new Error("Prestação inválida para o caminho do arquivo");
  if (!ehUuid(arquivoId)) throw new Error("Identificador de arquivo inválido");
  return [
    organizationId.toLowerCase(),
    "prestacoes",
    prestacaoId.toLowerCase(),
    segmentoDaPasta(pasta),
    `${arquivoId.toLowerCase()}.${extensaoDoArquivo(nomeOriginal)}`,
  ].join("/");
}

/** Lê um caminho no formato acima; devolve null para qualquer outro formato. */
export function lerCaminhoPrestacao(caminho: unknown): CaminhoPrestacao | null {
  if (typeof caminho !== "string") return null;
  const partes = caminho.split("/");
  const [organizationId, raiz, prestacaoId] = partes;
  if (!ehUuid(organizationId) || raiz !== "prestacoes" || !ehUuid(prestacaoId)) return null;

  let pasta: PastaPrestacao;
  let arquivo: string;
  if (partes.length === 5 && (partes[3] === "comprovantes" || partes[3] === "orcamento" || partes[3] === "alteracoes" || partes[3] === "extratos" || partes[3] === "evidencias")) {
    pasta = { tipo: partes[3] };
    arquivo = partes[4];
  } else if (partes.length === 6 && partes[3] === "atividades" && ehUuid(partes[4])) {
    pasta = { tipo: "atividade", atividadeId: partes[4] };
    arquivo = partes[5];
  } else {
    return null;
  }

  if (!NOME_ARQUIVO.test(arquivo) || !ehUuid(arquivo.slice(0, 36))) return null;
  return { organizationId, prestacaoId, pasta, arquivo };
}

/**
 * Organização dona da prestação. Enquanto `prestacoes_contas.organization_id`
 * não existir em todas as linhas, cai para a organização do projeto ou da
 * captação vinculados. Consulta esperada:
 * `select("*, projeto:projeto_id(organization_id), captacao:captacao_id(organization_id)")`.
 */
export function organizacaoDaPrestacao(prestacao: PrestacaoComOrganizacao): string | null {
  const candidatos = [
    prestacao?.organization_id,
    prestacao?.projeto?.organization_id,
    prestacao?.captacao?.organization_id,
  ];
  return candidatos.find(ehUuid) ?? null;
}

export const SELECT_ORGANIZACAO_DA_PRESTACAO =
  "*, projeto:projeto_id(organization_id), captacao:captacao_id(organization_id)";
