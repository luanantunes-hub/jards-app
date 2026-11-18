// Um PDF simples só de texto (título, seções com linhas, rodapé), feito no navegador com pdf-lib e as fontes padrão
// do PDF. Serve ao rider, à lista de canais e à energia. Sem rede e sem banco.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type SecaoDoPdf = { titulo: string; linhas: string[] };
/** A imagem do topo (o logo de quem manda a ficha): os bytes e o formato, que o PDF só desenha em PNG ou JPEG. */
export type LogoDoPdf = { bytes: Uint8Array; tipo: "png" | "jpg" };
export type DocumentoDoPdf = { titulo: string; subtitulo?: string; secoes: SecaoDoPdf[]; rodape: string; logoUrl?: string };

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 56;
const SUBSTITUICOES: Record<string, string> = { "≈": "~", "≥": ">=", "≤": "<=", "→": "->", "…": "...", "•": "-", "’": "'", "‘": "'", "“": '"', "”": '"' };

/** O texto só com o que a fonte do PDF sabe escrever (acentos do português valem; o resto vira o parecido ou some). */
export function textoSeguro(texto: string, fonte: PDFFont): string {
  const conhecidos = new Set(fonte.getCharacterSet());
  return Array.from(texto.replace(/\s+/g, " ").trim()).map(c => (conhecidos.has(c.codePointAt(0) ?? 0) ? c : SUBSTITUICOES[c] ?? "")).join("");
}

/** Quebra o texto em linhas que cabem em `largura` pontos. */
export function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura || !atual) atual = tentativa;
    else { linhas.push(atual); atual = palavra; }
  }
  if (atual) linhas.push(atual);
  return linhas.length > 0 ? linhas : [""];
}

/** A altura máxima do logo no topo, em pontos (a largura segue a proporção da imagem). */
const ALTURA_DO_LOGO = 40;

/** Monta o PDF (A4, margens de 56 pt, quebra de página e rodapé com a página). O logo, quando vem, abre a primeira página. */
export async function montarPdf(documento: DocumentoDoPdf, logo?: LogoDoPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const larguraUtil = A4.largura - MARGEM * 2;
  let pagina = pdf.addPage([A4.largura, A4.altura]);
  let y = A4.altura - MARGEM;

  const garantir = (altura: number) => {
    if (y - altura >= MARGEM + 20) return;
    pagina = pdf.addPage([A4.largura, A4.altura]);
    y = A4.altura - MARGEM;
  };
  const escrever = (texto: string, fonte: PDFFont, tamanho: number, opcoes: { recuo?: number; cor?: [number, number, number]; espaco?: number } = {}) => {
    const recuo = opcoes.recuo ?? 0;
    const entrelinha = tamanho * 1.35;
    for (const linha of quebrar(textoSeguro(texto, fonte), fonte, tamanho, larguraUtil - recuo)) {
      garantir(entrelinha);
      y -= entrelinha;
      pagina.drawText(linha, { x: MARGEM + recuo, y, size: tamanho, font: fonte, color: rgb(...(opcoes.cor ?? [0.157, 0.145, 0.145])) });
    }
    y -= opcoes.espaco ?? 0;
  };

  if (logo) {
    // Imagem quebrada não derruba o PDF: sem o logo, o documento sai igual.
    try {
      const imagem = logo.tipo === "png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
      const { width, height } = imagem.scaleToFit(larguraUtil, ALTURA_DO_LOGO);
      y -= height;
      pagina.drawImage(imagem, { x: MARGEM, y, width, height });
      y -= 14;
    } catch { /* segue sem o logo */ }
  }

  escrever(documento.titulo, negrito, 18, { espaco: 4 });
  if (documento.subtitulo) escrever(documento.subtitulo, normal, 10, { cor: [0.4, 0.4, 0.4], espaco: 10 });
  for (const secao of documento.secoes) {
    garantir(40);
    y -= 10;
    escrever(secao.titulo.toUpperCase(), negrito, 9.5, { cor: [0.35, 0.35, 0.35], espaco: 3 });
    pagina.drawLine({ start: { x: MARGEM, y: y + 2 }, end: { x: A4.largura - MARGEM, y: y + 2 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 4;
    if (secao.linhas.length === 0) escrever("—", normal, 10.5, { cor: [0.55, 0.55, 0.55] });
    for (const linha of secao.linhas) escrever(linha, normal, 10.5, { espaco: 1.5 });
  }

  const paginas = pdf.getPages();
  paginas.forEach((p, indice) => {
    const texto = textoSeguro(`${documento.rodape} · página ${indice + 1} de ${paginas.length}`, normal);
    p.drawText(texto, { x: MARGEM, y: MARGEM - 24, size: 8, font: normal, color: rgb(0.55, 0.55, 0.55) });
  });
  return pdf.save();
}
