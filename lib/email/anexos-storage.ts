import type { AnexoDoEmail, AnexoResolvido } from "./envio";

const BUCKET = "email-anexos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteComStorage = { storage: any };

/** Baixa o conteúdo de cada anexo do Storage e devolve já em base64, prontos para entrar na mensagem. */
export async function resolverAnexos(cliente: ClienteComStorage, anexos: readonly AnexoDoEmail[]): Promise<AnexoResolvido[]> {
  const resolvidos: AnexoResolvido[] = [];
  for (const anexo of anexos) {
    const { data, error } = await cliente.storage.from(BUCKET).download(anexo.path);
    if (error || !data) throw new Error(`Não encontrei o anexo "${anexo.nome}".`);
    const bytes = Buffer.from(await data.arrayBuffer());
    resolvidos.push({ nome: anexo.nome, tipo: anexo.tipo, conteudoBase64: bytes.toString("base64") });
  }
  return resolvidos;
}

/** Depois que o e-mail sai (ou o agendamento é cancelado), os arquivos no Storage não servem mais pra nada. */
export async function apagarAnexos(cliente: ClienteComStorage, anexos: readonly AnexoDoEmail[]): Promise<void> {
  if (anexos.length === 0) return;
  await cliente.storage.from(BUCKET).remove(anexos.map((anexo) => anexo.path));
}
