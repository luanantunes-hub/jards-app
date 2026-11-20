// Reduz e converte a imagem escolhida ANTES de enviar (o navegador faz o trabalho): no máximo 2000 pixels no maior lado, em WebP (JPEG se o navegador não faz WebP), e redesenhada num canvas, o
// que tira os dados da foto (local, câmera, hora). As peças que mexem no navegador entram por `deps`, para testar a lógica sem navegador.

import { MAX_BYTES_GUARDADO, MAX_LADO, medidasReduzidas, validarArquivo } from "@/lib/ticketeria/imagens";
import type { TipoDeImagem } from "@/lib/ticketeria/estados";

export type ImagemPreparada = { blob: Blob; tipo: TipoDeImagem; largura: number; altura: number };

export type DepsDoNavegador = {
  /** Abre a imagem e devolve as medidas e uma função que a desenha num canvas do tamanho pedido (já com a orientação certa da foto). */
  abrir(arquivo: Blob): Promise<{ largura: number; altura: number; desenhar(largura: number, altura: number): Promise<Blob | null> }>;
};

/** O que o navegador de verdade faz: createImageBitmap (com a orientação da foto) e canvas. */
export const depsDoNavegador: DepsDoNavegador = {
  async abrir(arquivo) {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    return {
      largura: bitmap.width, altura: bitmap.height,
      async desenhar(largura, altura) {
        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;
        const contexto = canvas.getContext("2d");
        if (!contexto) return null;
        contexto.drawImage(bitmap, 0, 0, largura, altura);
        const tipo = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.85));
        return tipo && tipo.type === "image/webp" ? tipo : new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
      },
    };
  },
};

export class ErroDaImagem extends Error {}

/** Confere o arquivo, reduz e converte. Lança ErroDaImagem com a frase para a pessoa. */
export async function prepararImagem(arquivo: File, deps: DepsDoNavegador = depsDoNavegador): Promise<ImagemPreparada> {
  const regra = validarArquivo(arquivo);
  if (!regra.ok) throw new ErroDaImagem(regra.erro);
  let aberta;
  try { aberta = await deps.abrir(arquivo); } catch { throw new ErroDaImagem("Não foi possível abrir essa imagem. Ela pode estar corrompida."); }
  const { largura, altura } = medidasReduzidas(aberta.largura, aberta.altura, MAX_LADO);
  const blob = await aberta.desenhar(largura, altura);
  if (!blob) throw new ErroDaImagem("Não foi possível reduzir essa imagem neste navegador.");
  if (blob.size > MAX_BYTES_GUARDADO) throw new ErroDaImagem("A imagem continua grande demais depois de reduzir. Escolha outra.");
  const tipo: TipoDeImagem = blob.type === "image/jpeg" ? "image/jpeg" : "image/webp";
  return { blob, tipo, largura, altura };
}
