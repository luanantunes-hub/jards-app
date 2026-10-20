import crypto from "crypto";
import { LIMITE_DO_ARQUIVO_BYTES, MAX_ARQUIVOS_POR_ENVIO } from "@/lib/mcp/prestacao/tipos-de-envio";

/** Mesmo teto do app para um arquivo da prestação (PDF, imagem, XML, planilha). */
export const LIMITE_ARQUIVO_BYTES = LIMITE_DO_ARQUIVO_BYTES;
/** Quantos arquivos o ChatGPT entrega por chamada (limite da própria plataforma). */
export const MAX_ARQUIVOS_POR_CHAMADA = MAX_ARQUIVOS_POR_ENVIO;
/** Texto colado no chat no lugar de um arquivo (XML de nota, OFX, CSV...). */
export const MAX_TEXTO_DO_ARQUIVO = 200_000;

const PRAZO_DO_DOWNLOAD_MS = 20_000;
const MAX_REDIRECIONAMENTOS = 3;

export interface ArquivoDoChat {
  nome: string;
  id: string;
  mime_type: string | null;
  download_link: string;
}

/**
 * O que o ChatGPT entrega em `openaiFileIdRefs`: documentado como lista de textos, na prática uma lista de objetos
 * (nome, id, tipo e link de download). Um texto só serve se for o próprio link; um id solto não dá para baixar.
 */
export function lerReferenciasDeArquivo(valor: unknown): ArquivoDoChat[] {
  if (!Array.isArray(valor)) return [];
  const referencias: ArquivoDoChat[] = [];
  for (const item of valor.slice(0, MAX_ARQUIVOS_POR_CHAMADA)) {
    if (typeof item === "string") {
      if (item.startsWith("https://")) referencias.push({ nome: "arquivo", id: "", mime_type: null, download_link: item });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const { name, id, mime_type: mime, download_link: link } = item as Record<string, unknown>;
    if (typeof link !== "string" || !link) continue;
    referencias.push({
      nome: typeof name === "string" && name ? name.slice(0, 300) : "arquivo",
      id: typeof id === "string" ? id.slice(0, 200) : "",
      mime_type: typeof mime === "string" && mime ? mime.slice(0, 100) : null,
      download_link: link,
    });
  }
  return referencias;
}

/** Só https, e nunca um endereço de rede interna ou numérico: o link vem do cliente e o servidor busca por ele. */
export function enderecoPermitido(texto: string): URL | null {
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return null;
  // IPv4 ou IPv6 escritos direto no endereço.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || host.includes(":")) return null;
  return url;
}

export type ResultadoDoDownload = { ok: true; bytes: Buffer; host: string } | { ok: false; erro: string; host: string | null };

/** Baixa o arquivo do link temporário do chat, com teto de tamanho e de tempo, conferindo cada redirecionamento. */
export async function baixarArquivoDoChat(link: string, buscar: typeof fetch = fetch): Promise<ResultadoDoDownload> {
  const inicial = enderecoPermitido(link);
  if (!inicial) return { ok: false, erro: "O link do arquivo não é um endereço https público.", host: null };
  const host = inicial.hostname;
  let atual: URL = inicial;

  try {
    for (let salto = 0; salto <= MAX_REDIRECIONAMENTOS; salto++) {
      const resposta: Response = await buscar(atual, { redirect: "manual", signal: AbortSignal.timeout(PRAZO_DO_DOWNLOAD_MS) });
      if ([301, 302, 303, 307, 308].includes(resposta.status)) {
        const destino = resposta.headers.get("location");
        const proximo: URL | null = destino ? enderecoPermitido(new URL(destino, atual).toString()) : null;
        if (!proximo) return { ok: false, erro: "O link do arquivo redirecionou para um endereço não permitido.", host };
        atual = proximo;
        continue;
      }
      if (!resposta.ok) return { ok: false, erro: `O link do arquivo respondeu ${resposta.status} (talvez tenha passado dos 5 minutos de validade).`, host };

      const declarado = Number(resposta.headers.get("content-length") ?? 0);
      if (declarado > LIMITE_ARQUIVO_BYTES) return { ok: false, erro: "O arquivo passa de 15 MB.", host };
      const lido = await lerCorpoComTeto(resposta, LIMITE_ARQUIVO_BYTES);
      if (!lido) return { ok: false, erro: "O arquivo passa de 15 MB.", host };
      return { ok: true, bytes: lido, host };
    }
    return { ok: false, erro: "Redirecionamentos demais no link do arquivo.", host };
  } catch {
    return { ok: false, erro: "Não foi possível baixar o arquivo (tempo esgotado ou link inválido).", host };
  }
}

async function lerCorpoComTeto(resposta: Response, teto: number): Promise<Buffer | null> {
  if (!resposta.body) {
    const bytes = Buffer.from(await resposta.arrayBuffer());
    return bytes.length > teto ? null : bytes;
  }
  const partes: Buffer[] = [];
  let total = 0;
  const leitor = resposta.body.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > teto) {
      await leitor.cancel().catch(() => undefined);
      return null;
    }
    partes.push(Buffer.from(value));
  }
  return Buffer.concat(partes);
}

/** Impressão digital (SHA-256) completa, em hexadecimal: é o que identifica o mesmo arquivo enviado duas vezes. */
export function impressaoDigital(conteudo: Buffer | string): string {
  return crypto.createHash("sha256").update(conteudo).digest("hex");
}

export type TipoReal = "pdf" | "png" | "jpeg" | "gif" | "webp" | "heic" | "zip" | "xml" | "texto" | "desconhecido";

/** O tipo pelo conteúdo, não pelo nome nem pelo tipo declarado: um .pdf que não começa com %PDF- não é PDF. */
export function tipoPeloConteudo(bytes: Buffer): TipoReal {
  const inicio = bytes.subarray(0, 16);
  if (inicio.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (inicio.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (inicio.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (inicio.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
  if (inicio.subarray(0, 4).toString("latin1") === "RIFF" && inicio.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (inicio.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|hevc|mif1)/.test(inicio.subarray(8, 12).toString("latin1"))) return "heic";
  if (inicio.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "zip";

  const amostra = bytes.subarray(0, 2048);
  if (amostra.includes(0)) return "desconhecido";
  const texto = amostra.toString("utf8").replace(/^﻿/, "").trimStart();
  if (texto.startsWith("<?xml") || /^<[A-Za-z]/.test(texto)) return "xml";
  return "texto";
}
