// A biblioteca de imagens do site (construtor, passo 5; desenho aprovado pelo dono em 20/11/2026): as regras de envio (tipos, tamanhos, limite), as contas de redimensionar, o nome e o caminho do
// arquivo e os textos da tela. Só lógica, sem banco, sem tela e sem servidor (roda no navegador e nos testes). O redimensionamento de verdade (canvas) está em imagens-navegador.ts.

import { TIPOS_DE_IMAGEM, type TipoDeImagem } from "@/lib/ticketeria/estados";

export const ESPACO_DAS_IMAGENS = "ticketeria-site";
/** O maior arquivo que a pessoa escolhe (antes de reduzir). */
export const MAX_BYTES_ESCOLHIDO = 15 * 1024 * 1024;
/** O maior arquivo que o espaço aceita (depois de reduzir): o mesmo limite do banco. */
export const MAX_BYTES_GUARDADO = 3 * 1024 * 1024;
/** A maior largura (e altura) depois de reduzir. */
export const MAX_LADO = 2000;
export const MAX_IMAGENS_POR_ORGANIZACAO = 200;

const EXTENSAO: Record<TipoDeImagem, "webp" | "jpg" | "png"> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const extensaoDoTipo = (tipo: TipoDeImagem) => EXTENSAO[tipo];

/** Os tipos que a pessoa pode escolher no arquivo (o que a tela converte para WebP): JPG, PNG e WebP. */
export const TIPOS_ESCOLHIVEIS: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

export type LeituraDoArquivo = { ok: true } | { ok: false; erro: string };

/** O arquivo que a pessoa escolheu cabe nas regras? (tipo, tamanho). */
export function validarArquivo(arquivo: { type: string; size: number }): LeituraDoArquivo {
  if (!TIPOS_ESCOLHIVEIS.includes(arquivo.type)) return { ok: false, erro: "Escolha uma imagem JPG, PNG ou WebP. GIF e SVG não são aceitos." };
  if (!(arquivo.size > 0)) return { ok: false, erro: "Esse arquivo está vazio." };
  if (arquivo.size > MAX_BYTES_ESCOLHIDO) return { ok: false, erro: `A imagem tem mais de ${MAX_BYTES_ESCOLHIDO / 1024 / 1024} MB. Escolha uma menor.` };
  return { ok: true };
}

/** As medidas depois de reduzir: o maior lado nunca passa de `maximo`, a proporção se mantém, e imagem menor que o máximo não é ampliada. */
export function medidasReduzidas(largura: number, altura: number, maximo: number = MAX_LADO): { largura: number; altura: number } {
  if (!(largura > 0) || !(altura > 0)) return { largura: 1, altura: 1 };
  const escala = Math.min(1, maximo / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

/** O nome mostrado na biblioteca: o do arquivo sem a extensão, sem caminho, até 120 letras; sem nome, "imagem". */
export function nomeDaImagem(nomeDoArquivo: string): string {
  const base = (nomeDoArquivo.split(/[\\/]/).pop() ?? "").replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 120).trim();
  return base === "" ? "imagem" : base;
}

/** O caminho do arquivo no espaço: `<organização>/<imagem>.<extensão>` (a primeira pasta é a organização, que é o que a regra do storage confere). Nulo se um dos ids não é um UUID. */
export function caminhoDaImagem(organizationId: string, imagemId: string, tipo: TipoDeImagem): string | null {
  const org = organizationId.toLowerCase(), imagem = imagemId.toLowerCase();
  return UUID.test(org) && UUID.test(imagem) ? `${org}/${imagem}.${EXTENSAO[tipo]}` : null;
}

/** O endereço público de um arquivo do espaço, a partir do endereço do projeto (NEXT_PUBLIC_SUPABASE_URL). */
export function urlPublicaDaImagem(urlDoProjeto: string, caminho: string): string {
  return `${urlDoProjeto.replace(/\/+$/, "")}/storage/v1/object/public/${ESPACO_DAS_IMAGENS}/${caminho.split("/").map(encodeURIComponent).join("/")}`;
}

/** "180 KB" ou "1,2 MB". */
export function tamanhoEmTexto(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export type ImagemDaBiblioteca = { id: string; caminho: string; nome: string; tipo: TipoDeImagem; bytes: number; largura: number; altura: number; created_at: string };

/** As linhas da tabela, lidas com cuidado (a mais nova primeiro). */
export function lerImagens(linhas: unknown): ImagemDaBiblioteca[] {
  if (!Array.isArray(linhas)) return [];
  const lista: ImagemDaBiblioteca[] = [];
  for (const x of linhas) {
    const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.caminho !== "string" || typeof r.nome !== "string" || !(TIPOS_DE_IMAGEM as readonly unknown[]).includes(r.tipo) || typeof r.bytes !== "number" || typeof r.largura !== "number" || typeof r.altura !== "number" || typeof r.created_at !== "string") continue;
    lista.push({ id: r.id, caminho: r.caminho, nome: r.nome, tipo: r.tipo as TipoDeImagem, bytes: r.bytes, largura: r.largura, altura: r.altura, created_at: r.created_at });
  }
  return lista.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

/** "1600 × 900 · 180 KB". */
export const descricaoDaImagem = (i: Pick<ImagemDaBiblioteca, "largura" | "altura" | "bytes">) => `${i.largura} × ${i.altura} · ${tamanhoEmTexto(i.bytes)}`;

/** O erro de enviar ou apagar, numa frase. */
export function mensagemDoErroDeImagem(erro: { code?: string; message?: string; statusCode?: string | number }): string {
  const m = erro.message ?? "";
  if (erro.code === "42501" || /row-level security|new row violates|not authorized|unauthorized|403/i.test(m) || String(erro.statusCode ?? "") === "403") return `Você não pode mudar as imagens desta loja, ou ela já tem ${MAX_IMAGENS_POR_ORGANIZACAO} imagens.`;
  if (/too large|payload|413|exceeded the maximum/i.test(m) || String(erro.statusCode ?? "") === "413") return "A imagem ficou grande demais depois de reduzir. Escolha outra.";
  if (/mime|not supported|invalid_mime/i.test(m)) return "Esse tipo de imagem não é aceito. Use JPG, PNG ou WebP.";
  return "Não foi possível enviar a imagem. Tente de novo.";
}
