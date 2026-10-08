// Captura por e-mail (P5.5): o endereço de cada prestação, que destinatário
// é dela, quais anexos viram despesa e como juntar o XML e o PDF da mesma
// nota. Sem React e sem Supabase.

export const enderecoDeCaptura = (token: string, dominio: string) => `pc-${token}@${dominio.toLowerCase()}`;

/** O endereço puro, de "Nome <a@b>" ou "a@b", em minúsculas. */
export function enderecoPuro(texto: string): string {
  const entre = /<([^<>\s]+@[^<>\s]+)>/.exec(texto);
  return (entre ? entre[1] : texto).trim().toLowerCase();
}

/** Os códigos das prestações entre os destinatários (sem repetir), no domínio de recebimento. */
export function tokensDosDestinatarios(enderecos: readonly string[], dominio: string): string[] {
  const dom = dominio.toLowerCase().replace(/^@/, "");
  const tokens = new Set<string>();
  for (const bruto of enderecos) {
    const endereco = enderecoPuro(bruto);
    const [local, host] = endereco.split("@");
    if (host !== dom || !local) continue;
    // pc-<código>, aceitando um sufixo depois de "+" (pc-abc+notas@).
    const m = /^pc-([a-z0-9]{10})(\+[^@]*)?$/.exec(local);
    if (m) tokens.add(m[1]);
  }
  return [...tokens];
}

export type AnexoRecebido = { id: string; filename: string; content_type: string; content_disposition?: string | null };

const PDF = /pdf$/i;
const XML = /xml$/i;
const IMAGEM = /^image\/(jpe?g|png|webp|heic|heif|gif)$/i;
const EXT_ACEITA = /\.(pdf|xml|jpe?g|png|webp|heic|heif)$/i;
export const MAXIMO_DE_ANEXOS = 10;

export const ehPdf = (a: Pick<AnexoRecebido, "filename" | "content_type">) => PDF.test(a.content_type) || /\.pdf$/i.test(a.filename);
export const ehXmlAnexo = (a: Pick<AnexoRecebido, "filename" | "content_type">) => XML.test(a.content_type) || /\.xml$/i.test(a.filename);

/**
 * Os anexos que podem ser comprovante: PDF, XML e fotos. Imagem "inline" é
 * quase sempre logo ou assinatura do e-mail, e fica de fora.
 */
export function anexosAproveitaveis(anexos: readonly AnexoRecebido[]): AnexoRecebido[] {
  return anexos.filter(a => {
    const imagem = IMAGEM.test(a.content_type);
    if (imagem && a.content_disposition === "inline") return false;
    return ehPdf(a) || ehXmlAnexo(a) || imagem || EXT_ACEITA.test(a.filename);
  }).slice(0, MAXIMO_DE_ANEXOS);
}

/** Uma despesa a criar: o arquivo guardado e, quando há, o XML lido para preencher os dados. */
export type GrupoDeAnexos = { arquivo: AnexoRecebido; xml: AnexoRecebido | null };

/**
 * Nota com XML e PDF no mesmo e-mail (o comum do fornecedor) vira uma despesa
 * só: o PDF é o arquivo e o XML preenche os dados. Nos demais casos, cada
 * anexo é uma despesa; o XML sozinho é o próprio arquivo.
 */
export function agruparAnexos(anexos: readonly AnexoRecebido[]): GrupoDeAnexos[] {
  const xmls = anexos.filter(ehXmlAnexo);
  const pdfs = anexos.filter(ehPdf);
  if (xmls.length === 1 && pdfs.length === 1) {
    return [
      { arquivo: pdfs[0], xml: xmls[0] },
      ...anexos.filter(a => a !== xmls[0] && a !== pdfs[0]).map(a => ({ arquivo: a, xml: null })),
    ];
  }
  return anexos.map(a => ({ arquivo: a, xml: ehXmlAnexo(a) ? a : null }));
}

export const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A lista de remetentes autorizados depois de acrescentar um: em minúsculas, sem repetir. */
export function acrescentarRemetente(lista: readonly string[], novo: string): { lista: string[]; erro: string | null } {
  const email = enderecoPuro(novo);
  if (!EMAIL_VALIDO.test(email) || email.length > 320) return { lista: [...lista], erro: "Informe um e-mail válido." };
  if (lista.includes(email)) return { lista: [...lista], erro: null };
  if (lista.length >= 20) return { lista: [...lista], erro: "São até 20 remetentes autorizados." };
  return { lista: [...lista, email].sort(), erro: null };
}

export type SituacaoDoEmail = "registrado" | "sem_anexo" | "remetente_nao_autorizado" | "falhou";

export function textoDaSituacao(e: { situacao: SituacaoDoEmail; despesas: number; anexos: number }): { texto: string; cor: string } {
  if (e.situacao === "registrado") {
    return { texto: `${e.despesas} ${e.despesas === 1 ? "despesa criada" : "despesas criadas"}`, cor: "#2E8932" };
  }
  if (e.situacao === "sem_anexo") return { texto: "Sem anexo aproveitável", cor: "#6B6B6B" };
  if (e.situacao === "remetente_nao_autorizado") return { texto: "Remetente não autorizado", cor: "#B07A14" };
  return { texto: "Nenhuma despesa criada", cor: "#B23B3B" };
}
