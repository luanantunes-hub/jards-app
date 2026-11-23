// Reduz e converte a imagem escolhida ANTES de enviar (o navegador faz o trabalho): no máximo 2000 pixels no maior lado, em WebP (JPEG se o navegador não faz WebP), e redesenhada num canvas, o
// que tira os dados da foto (local, câmera, hora). As peças que mexem no navegador entram por `deps`, para testar a lógica sem navegador.

import { MAX_BYTES_GUARDADO, MAX_LADO, medidasReduzidas, validarArquivo } from "@/lib/ticketeria/imagens";
import type { TipoDeImagem } from "@/lib/ticketeria/estados";

export type ImagemPreparada = { blob: Blob; tipo: TipoDeImagem; largura: number; altura: number };

export type DepsDoNavegador = {
  /** Abre a imagem e devolve as medidas e uma função que a desenha num canvas do tamanho pedido (já com a orientação certa da foto). */
  abrir(arquivo: Blob): Promise<{ largura: number; altura: number; desenhar(largura: number, altura: number): Promise<Blob | null> }>;
};

/** O canvas em WebP (JPEG se o navegador não faz WebP). */
async function canvasEmBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const tipo = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.85));
  return tipo && tipo.type === "image/webp" ? tipo : new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
}

/** A primeira página de um PDF desenhada num canvas (o pdfjs só é carregado aqui, ao escolher um PDF: o resto do app não paga o peso dele), no máximo MAX_LADO no maior lado. */
async function abrirPdf(arquivo: Blob): Promise<Awaited<ReturnType<DepsDoNavegador["abrir"]>>> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  try {
    const documento = await tarefa.promise;
    const pagina = await documento.getPage(1);
    const natural = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: Math.min(4, MAX_LADO / Math.max(natural.width, natural.height)) });
    const origem = document.createElement("canvas");
    origem.width = Math.max(1, Math.ceil(viewport.width));
    origem.height = Math.max(1, Math.ceil(viewport.height));
    const contexto = origem.getContext("2d");
    if (!contexto) throw new Error("sem_canvas");
    contexto.fillStyle = "#fff";
    contexto.fillRect(0, 0, origem.width, origem.height);
    await pagina.render({ canvas: origem, viewport }).promise;
    return {
      largura: origem.width, altura: origem.height,
      async desenhar(largura, altura) {
        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;
        const destino = canvas.getContext("2d");
        if (!destino) return null;
        destino.drawImage(origem, 0, 0, largura, altura);
        return canvasEmBlob(canvas);
      },
    };
  } finally {
    void tarefa.destroy();
  }
}

/** O que o navegador de verdade faz: createImageBitmap (com a orientação da foto) e canvas; PDF, a primeira página. */
export const depsDoNavegador: DepsDoNavegador = {
  async abrir(arquivo) {
    if (arquivo.type === "application/pdf") return abrirPdf(arquivo);
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
        return canvasEmBlob(canvas);
      },
    };
  },
};

export class ErroDaImagem extends Error {}

/** Confere o arquivo, reduz e converte. Lança ErroDaImagem com a frase para a pessoa. */
export async function prepararImagem(arquivo: File, deps: DepsDoNavegador = depsDoNavegador, opcoes: { aceitaPdf?: boolean } = {}): Promise<ImagemPreparada> {
  const regra = validarArquivo(arquivo, opcoes);
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
