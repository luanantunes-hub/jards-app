// Prepara imagens para os buckets públicos (limite de 2 MB): lê no navegador,
// reduz o lado maior e reencoda em WEBP (PNG se o navegador não gerar WEBP,
// para não perder a transparência de logos). Assim fotos grandes de celular
// passam sem o usuário precisar redimensionar nada.

export const LIMITE_IMAGEM_BYTES = 2 * 1024 * 1024;
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp"];

export type ImagemPreparada = {
  ok: true;
  arquivo: Blob;
  tipo: string;
  extensao: string;
  reduzida: boolean;
  tamanhoOriginal: number;
};
export type FalhaImagem = { ok: false; mensagem: string };

export function formatarTamanho(bytes: number) {
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

type Fonte = { imagem: CanvasImageSource; largura: number; altura: number; liberar: () => void };

async function decodificar(file: File): Promise<Fonte> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { imagem: bitmap, largura: bitmap.width, altura: bitmap.height, liberar: () => bitmap.close() };
    } catch {
      // alguns navegadores não decodificam via bitmap: tenta pelo <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { imagem: img, largura: img.naturalWidth, altura: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
  } catch (erro) {
    URL.revokeObjectURL(url);
    throw erro;
  }
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, tipo, qualidade));
}

export async function prepararImagem(file: File, ladoMaximo = 512): Promise<ImagemPreparada | FalhaImagem> {
  if (!TIPOS_ACEITOS.includes(file.type)) {
    return { ok: false, mensagem: "Formato não aceito. Use PNG, JPG ou WEBP." };
  }

  let fonte: Fonte;
  try {
    fonte = await decodificar(file);
  } catch {
    return { ok: false, mensagem: "Não conseguimos ler essa imagem. Tente outro arquivo." };
  }

  try {
    if (!fonte.largura || !fonte.altura) {
      return { ok: false, mensagem: "Não conseguimos ler essa imagem. Tente outro arquivo." };
    }
    const escala = Math.min(1, ladoMaximo / Math.max(fonte.largura, fonte.altura));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(fonte.largura * escala));
    canvas.height = Math.max(1, Math.round(fonte.altura * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, mensagem: "Não conseguimos preparar essa imagem. Tente outro arquivo." };
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(fonte.imagem, 0, 0, canvas.width, canvas.height);

    let arquivo = await paraBlob(canvas, "image/webp", 0.9);
    let tipo = "image/webp";
    let extensao = "webp";
    if (!arquivo || arquivo.type !== "image/webp") {
      arquivo = await paraBlob(canvas, "image/png");
      tipo = "image/png";
      extensao = "png";
    }
    if (!arquivo) return { ok: false, mensagem: "Não conseguimos preparar essa imagem. Tente outro arquivo." };
    if (arquivo.size > LIMITE_IMAGEM_BYTES) {
      return { ok: false, mensagem: "A imagem continua acima de 2 MB mesmo reduzida. Tente outra." };
    }
    return { ok: true, arquivo, tipo, extensao, reduzida: file.size > LIMITE_IMAGEM_BYTES, tamanhoOriginal: file.size };
  } finally {
    fonte.liberar();
  }
}

// Erros do Supabase Storage chegam em inglês: traduz para o que a pessoa pode fazer.
export function mensagemErroUpload(erro: { message?: string; statusCode?: string | number } | null | undefined) {
  const texto = (erro?.message ?? "").toLowerCase();
  if (texto.includes("maximum allowed size") || texto.includes("too large") || String(erro?.statusCode) === "413") {
    return "A imagem passou do limite de 2 MB. Tente outra.";
  }
  if (texto.includes("mime") || texto.includes("not supported")) return "Formato não aceito. Use PNG, JPG ou WEBP.";
  if (texto.includes("failed to fetch") || texto.includes("network")) {
    return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  }
  return "Não foi possível enviar a imagem. Tente de novo.";
}
